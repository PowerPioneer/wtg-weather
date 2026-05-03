/**
 * MapLibre style builder. Produces a single style JSON keyed to the current
 * display mode, selected month, and signed PMTiles URLs. Paint expressions
 * read `feature.properties.<prop>_<mm>` directly so a mode / month change is
 * a `setPaintProperty` call — never a tile refetch.
 *
 * Source-layer names (`country`, `admin1`, `admin2`) are produced by the
 * pipeline's tippecanoe invocation (see `pipeline/src/wtg_pipeline/tiles/`).
 */

import type { StyleSpecification, ExpressionSpecification } from "maplibre-gl";

import {
  DISPLAY_MODES,
  modeProperty,
  type DisplayMode,
  type DisplayModeId,
} from "./display-modes";

export const FREE_SOURCE_ID = "wtg-free";
export const PREMIUM_SOURCE_ID = "wtg-premium";

export const COUNTRY_FILL_LAYER = "wtg-country-fill";
export const COUNTRY_LINE_LAYER = "wtg-country-line";
export const ADMIN1_FILL_LAYER = "wtg-admin1-fill";
export const ADMIN1_LINE_LAYER = "wtg-admin1-line";
// Mosaic layers paint admin-1 polygons of climatically-incoherent countries
// (Phase 3a suppression list) at country-level zoom — those countries have
// no country-level row in the tiles, so without this they'd render as holes.
export const ADMIN1_MOSAIC_FILL_LAYER = "wtg-admin1-mosaic-fill";
export const ADMIN1_MOSAIC_LINE_LAYER = "wtg-admin1-mosaic-line";
export const ADMIN2_FILL_LAYER = "wtg-admin2-fill";
export const ADMIN2_LINE_LAYER = "wtg-admin2-line";

export const FILL_LAYER_IDS = [
  COUNTRY_FILL_LAYER,
  ADMIN1_MOSAIC_FILL_LAYER,
  ADMIN1_FILL_LAYER,
  ADMIN2_FILL_LAYER,
] as const;

// Mirror of `pipeline/src/wtg_pipeline/processing/country_rules.py`
// `SUPPRESSED_COUNTRIES`. Keep in sync when entries are added/removed.
export const SUPPRESSED_COUNTRIES: readonly string[] = [
  "RU",
  "CA",
  "US",
  "CN",
  "AU",
  "BR",
  "IN",
  "AR",
  "KZ",
  "CL",
];

// Zoom thresholds must match the tippecanoe `-Z/-z` flags in pipeline/CLAUDE.md.
const ZOOM_COUNTRY_MAX = 3.5;
const ZOOM_ADMIN1_MIN = 3.0;
const ZOOM_ADMIN1_MAX = 6.5;
const ZOOM_ADMIN2_MIN = 6.0;

const SURFACE_BG = "#F7F6F2";
const WATER = "#E4E8EC";
const LINE_COLOR = "#0F1B2D";
const MISSING_FILL = "#D9D5C8";

/** Build the fill-color expression for a given mode + month. */
export function buildFillColorExpression(
  modeId: DisplayModeId,
  month: number,
): ExpressionSpecification {
  const mode = DISPLAY_MODES[modeId];
  const prop = modeProperty(mode, month);
  // `['get']` returns null for missing. MapLibre's `to-number` converts null
  // to 0, so we have to inject the sentinel via `coalesce` before conversion;
  // otherwise blank polygons silently fall into the lowest bin.
  const raw: ExpressionSpecification = [
    "to-number",
    ["coalesce", ["get", prop], -9999],
  ];

  if (mode.kind === "qualitative") {
    // Preferences score 0-100 → 4 Atlas bins. Mirrors scoring.ts SCORE_BINS.
    return [
      "case",
      ["==", raw, -9999],
      MISSING_FILL,
      [
        "step",
        raw,
        "#7A2E2E", // avoid   (< 50)
        50,
        "#B8610E", // acceptable (50–69)
        70,
        "#0072B2", // good (70–84)
        85,
        "#0B6E5F", // perfect (≥85)
      ],
    ];
  }

  if (mode.kind === "ordinal-safety") {
    // Safety 1-4 → discrete bins. -9999 (missing) → neutral grey.
    return [
      "case",
      ["==", raw, -9999],
      MISSING_FILL,
      ["step", raw, "#4A5568", 2, "#B8763E", 3, "#B8610E", 4, "#7A2E2E"],
    ];
  }

  // Sequential / diverging / diverging-ocean share the same shape: 5-colour
  // ramp with 4 numeric stops.
  if ("ramp" in mode.legend) {
    const { ramp, stops } = mode.legend;
    if (ramp.length !== stops.length + 1) {
      throw new Error(`mode ${modeId}: ramp/stops length mismatch`);
    }
    const expr: (string | number | ExpressionSpecification)[] = [
      "step",
      raw,
      ramp[0],
    ];
    for (let i = 0; i < stops.length; i++) {
      expr.push(stops[i], ramp[i + 1]);
    }
    return [
      "case",
      ["==", raw, -9999],
      MISSING_FILL,
      expr as unknown as ExpressionSpecification,
    ];
  }

  return MISSING_FILL as unknown as ExpressionSpecification;
}

/** Opacity expression for land polygons. SST dims land; others render at 1. */
export function buildFillOpacityExpression(modeId: DisplayModeId): number {
  return DISPLAY_MODES[modeId].kind === "diverging-ocean" ? 0.25 : 1;
}

export type StyleInput = {
  /** Signed pmtiles URL for country + admin-1 (free tier). */
  freeTilesUrl: string;
  /** Signed pmtiles URL for admin-2 (premium). Pass `null` to disable the layer. */
  premiumTilesUrl: string | null;
  /** Active display mode. Default: `preferences`. */
  mode: DisplayModeId;
  /** 1-indexed month. Default: current month. */
  month: number;
};

export function buildMapStyle(input: StyleInput): StyleSpecification {
  const { freeTilesUrl, premiumTilesUrl, mode, month } = input;
  const fillColor = buildFillColorExpression(mode, month);
  const fillOpacity = buildFillOpacityExpression(mode);

  const sources: StyleSpecification["sources"] = {
    [FREE_SOURCE_ID]: {
      type: "vector",
      url: `pmtiles://${freeTilesUrl}`,
      attribution: "© ERA5 · geoBoundaries · Natural Earth",
    },
  };

  if (premiumTilesUrl) {
    sources[PREMIUM_SOURCE_ID] = {
      type: "vector",
      url: `pmtiles://${premiumTilesUrl}`,
      attribution: "Premium tier",
    };
  }

  const suppressedFilter: ExpressionSpecification = [
    "in",
    ["get", "iso_a2"],
    ["literal", SUPPRESSED_COUNTRIES],
  ];

  const layers: StyleSpecification["layers"] = [
    { id: "wtg-background", type: "background", paint: { "background-color": WATER } },
    {
      id: COUNTRY_FILL_LAYER,
      type: "fill",
      source: FREE_SOURCE_ID,
      "source-layer": "country",
      maxzoom: ZOOM_COUNTRY_MAX,
      paint: {
        "fill-color": fillColor,
        "fill-opacity": fillOpacity,
        "fill-antialias": true,
      },
    },
    {
      id: COUNTRY_LINE_LAYER,
      type: "line",
      source: FREE_SOURCE_ID,
      "source-layer": "country",
      maxzoom: ZOOM_COUNTRY_MAX,
      paint: { "line-color": LINE_COLOR, "line-opacity": 0.3, "line-width": 0.6 },
    },
    // Mosaic: render admin-1 polygons of suppressed countries at country zoom
    // so they don't appear as holes where the country row was deliberately
    // dropped by the Phase 3a aggregation rules.
    {
      id: ADMIN1_MOSAIC_FILL_LAYER,
      type: "fill",
      source: FREE_SOURCE_ID,
      "source-layer": "admin1",
      maxzoom: ZOOM_ADMIN1_MIN,
      filter: suppressedFilter,
      paint: {
        "fill-color": fillColor,
        "fill-opacity": fillOpacity,
        "fill-antialias": true,
      },
    },
    {
      id: ADMIN1_MOSAIC_LINE_LAYER,
      type: "line",
      source: FREE_SOURCE_ID,
      "source-layer": "admin1",
      maxzoom: ZOOM_ADMIN1_MIN,
      filter: suppressedFilter,
      paint: { "line-color": LINE_COLOR, "line-opacity": 0.2, "line-width": 0.4 },
    },
    {
      id: ADMIN1_FILL_LAYER,
      type: "fill",
      source: FREE_SOURCE_ID,
      "source-layer": "admin1",
      minzoom: ZOOM_ADMIN1_MIN,
      maxzoom: ZOOM_ADMIN1_MAX,
      paint: {
        "fill-color": fillColor,
        "fill-opacity": fillOpacity,
        "fill-antialias": true,
      },
    },
    {
      id: ADMIN1_LINE_LAYER,
      type: "line",
      source: FREE_SOURCE_ID,
      "source-layer": "admin1",
      minzoom: ZOOM_ADMIN1_MIN,
      maxzoom: ZOOM_ADMIN1_MAX,
      paint: { "line-color": LINE_COLOR, "line-opacity": 0.35, "line-width": 0.6 },
    },
  ];

  if (premiumTilesUrl) {
    layers.push(
      {
        id: ADMIN2_FILL_LAYER,
        type: "fill",
        source: PREMIUM_SOURCE_ID,
        "source-layer": "admin2",
        minzoom: ZOOM_ADMIN2_MIN,
        paint: {
          "fill-color": fillColor,
          "fill-opacity": fillOpacity,
          "fill-antialias": true,
        },
      },
      {
        id: ADMIN2_LINE_LAYER,
        type: "line",
        source: PREMIUM_SOURCE_ID,
        "source-layer": "admin2",
        minzoom: ZOOM_ADMIN2_MIN,
        paint: { "line-color": LINE_COLOR, "line-opacity": 0.4, "line-width": 0.5 },
      },
    );
  }

  return {
    version: 8,
    name: "Atlas Climate",
    sources,
    layers,
    // Light background shown briefly before tiles load.
    metadata: { "wtg:surface": SURFACE_BG },
  } satisfies StyleSpecification;
}

/** Exposed so the canvas can update paint live without rebuilding the style. */
export function activeFillLayerIds(premium: boolean): readonly string[] {
  // Without premium tiles, only the admin-2 layer is absent — strip it off
  // the end and return the rest (country + mosaic + admin1).
  return premium ? FILL_LAYER_IDS : FILL_LAYER_IDS.slice(0, -1);
}

export type Mode = DisplayMode;
