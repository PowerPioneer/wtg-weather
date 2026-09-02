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
import {
  BUCKET_SCORES,
  DEFAULT_PREFERENCES,
  SCORE_HEX,
  isDefaultPreferences,
  preferenceRanges,
  type WeatherPreferences,
} from "./scoring";

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

// Outline drawn around the clicked polygon. One layer per level because a
// layer can only read one source-layer; all three filter on the same `id`
// property, whose values are namespaced per level by the pipeline (ADM0_A3 /
// adm1_code / geoBoundaries id) so one id can never match two of them.
export const COUNTRY_SELECTED_LAYER = "wtg-country-selected";
export const ADMIN1_SELECTED_LAYER = "wtg-admin1-selected";
export const ADMIN2_SELECTED_LAYER = "wtg-admin2-selected";

export const SELECTED_LAYER_IDS = [
  COUNTRY_SELECTED_LAYER,
  ADMIN1_SELECTED_LAYER,
  ADMIN2_SELECTED_LAYER,
] as const;

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

// Zoom thresholds must match the tippecanoe `-Z/-z` flags and the per-feature
// `tippecanoe.minzoom` hints in pipeline/CLAUDE.md.
//
// The admin-1 → admin-2 handover is at 7.0, not 6.5, and that is measured
// rather than chosen. MapLibre serves map zoom 6.0–6.99 from the archive's
// *z6* tiles, and a z6 tile cannot hold the admin-2 layer: tile 6/32/21 was
// built with 92 of the 189 Dutch municipalities that intersect it, leaving
// 32.8% of the country's area with no admin-2 polygon at all. Under the old
// 6.5 handover that band had admin-2 as its only fill, so a third of the
// Netherlands rendered as bare background — the "regions disappear at certain
// zoom levels" holes. Admin-1 is intact at every zoom (its ~10% shortfall
// against geoBoundaries is the two datasets disagreeing about where the
// IJsselmeer is, and does not move with zoom), so it is what covers the band.
//
// The pipeline stops emitting admin-2 into z6 tiles at all (`LEVEL_MIN_ZOOM`
// in build_geojson.py); these two constants and that hint are one decision.
const ZOOM_COUNTRY_MAX = 3.5;
const ZOOM_ADMIN1_MIN = 3.0;
const ZOOM_ADMIN1_MAX = 7.0;
const ZOOM_ADMIN2_MIN = 7.0;

const SURFACE_BG = "#F7F6F2";
const WATER = "#E4E8EC";
const LINE_COLOR = "#0F1B2D";
const MISSING_FILL = "#D9D5C8";

const MISSING_SENTINEL = -9999;

/**
 * The "Avoid" fill, reused by the safety veto. Read from the shared palette
 * rather than repeating the literal below it: the veto and the bottom bin have
 * to be the same colour, because to a traveller they are the same verdict.
 */
const SCORE_AVOID_HEX = SCORE_HEX.avoid;

/**
 * The 0–100 preference score, computed inside the expression from the feature's
 * own `t_<mm>` / `r_<mm>` / `s_<mm>` properties.
 *
 * This is what makes a preference change a `setPaintProperty` call instead of a
 * tile rebuild: the ingredients are already baked into every polygon, so the
 * whole scoring rule can be pushed down into the paint. It reproduces
 * `scoreBucket` in `lib/scoring.ts` — count how many of the three variables
 * miss their range, and by how much — and returns the same bucket centroids.
 *
 * A variable the tier or level does not carry is skipped rather than counted as
 * a miss; a feature carrying none of the three returns the missing sentinel so
 * the caller paints it grey instead of scoring it zero.
 */
export function buildPreferenceScoreExpression(
  prefs: WeatherPreferences,
  month: number,
): ExpressionSpecification {
  const mm = String(month).padStart(2, "0");

  const present: ExpressionSpecification[] = [];
  const missedBuffer: ExpressionSpecification[] = [];
  const missedRange: ExpressionSpecification[] = [];

  for (const range of preferenceRanges(prefs)) {
    const key = `${range.alias}_${mm}`;
    const has: ExpressionSpecification = ["has", key];
    // `to-number` of an absent property is 0, which is a perfectly plausible
    // temperature — every comparison below is therefore gated on `has`.
    const value: ExpressionSpecification = ["to-number", ["get", key]];
    const inRange: ExpressionSpecification = [
      "all",
      [">=", value, range.lo],
      ["<=", value, range.hi],
    ];
    const inBuffer: ExpressionSpecification = [
      "all",
      [">=", value, range.lo - range.buffer],
      ["<=", value, range.hi + range.buffer],
    ];

    present.push(["case", has, 1, 0]);
    missedBuffer.push(["case", ["all", has, ["!", inBuffer]], 1, 0]);
    missedRange.push(["case", ["all", has, inBuffer, ["!", inRange]], 1, 0]);
  }

  const evaluated: ExpressionSpecification = ["+", ...present];
  const outOfBuffer: ExpressionSpecification = ["+", ...missedBuffer];
  const inBufferOnly: ExpressionSpecification = ["+", ...missedRange];

  return [
    "case",
    ["==", evaluated, 0],
    MISSING_SENTINEL,
    [">=", outOfBuffer, 2],
    BUCKET_SCORES[0],
    ["==", outOfBuffer, 1],
    BUCKET_SCORES[1],
    [">=", inBufferOnly, 1],
    BUCKET_SCORES[2],
    BUCKET_SCORES[3],
  ];
}

/**
 * The traveller's safety veto, as a boolean expression.
 *
 * True for a polygon whose baked `safety` level is worse than they accept.
 * `has` guards the comparison because `to-number` of an absent property is 0,
 * and a country no government lists carries no `safety` property at all — that
 * is "unlisted", not "level 0", and it must pass the gate rather than fail it.
 */
export function buildSafetyVetoExpression(
  prefs: WeatherPreferences,
): ExpressionSpecification {
  return [
    "all",
    ["has", "safety"],
    [">", ["to-number", ["get", "safety"]], prefs.safetyMax],
  ];
}

/** Build the fill-color expression for a given mode + month. */
export function buildFillColorExpression(
  modeId: DisplayModeId,
  month: number,
  preferences: WeatherPreferences = DEFAULT_PREFERENCES,
): ExpressionSpecification {
  const mode = DISPLAY_MODES[modeId];
  const prop = modeProperty(mode, month);
  // `['get']` returns null for missing. MapLibre's `to-number` converts null
  // to 0, so we have to inject the sentinel via `coalesce` before conversion;
  // otherwise blank polygons silently fall into the lowest bin.
  const raw: ExpressionSpecification = [
    "to-number",
    ["coalesce", ["get", prop], MISSING_SENTINEL],
  ];

  if (mode.kind === "qualitative") {
    // Default preferences read the score the pipeline already baked in — it is
    // the same number by construction (see scoring.ts), and one `get` beats
    // twelve comparisons per polygon per frame.
    const score: ExpressionSpecification = isDefaultPreferences(preferences)
      ? raw
      : buildPreferenceScoreExpression(preferences, month);

    // Preferences score 0-100 → 4 Atlas bins. Mirrors scoring.ts SCORE_BINS,
    // with the safety veto ahead of the ramp and the missing test ahead of
    // both: a polygon carrying no climate series stays grey even when it is
    // over the traveller's advisory limit, because "we have nothing to say
    // about this place" outranks "avoid it" — the same order `scoreBucket`
    // applies, which returns `null` before it considers the veto.
    return [
      "case",
      ["==", score, MISSING_SENTINEL],
      MISSING_FILL,
      buildSafetyVetoExpression(preferences),
      SCORE_AVOID_HEX,
      [
        "step",
        score,
        "#7A2E2E", // avoid   (< 50)
        50,
        "#B55F0E", // acceptable (50–69)
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
      ["==", raw, MISSING_SENTINEL],
      MISSING_FILL,
      ["step", raw, "#4A5568", 2, "#9B6434", 3, "#B55F0E", 4, "#7A2E2E"],
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
      ["==", raw, MISSING_SENTINEL],
      MISSING_FILL,
      expr as unknown as ExpressionSpecification,
    ];
  }

  return MISSING_FILL as unknown as ExpressionSpecification;
}

/**
 * Filter for the selection outline layers. `null` selects nothing: every
 * feature carries a non-empty `id`, so the empty string matches none of them.
 */
export function buildSelectionFilter(
  featureId: string | null,
): ExpressionSpecification {
  return ["==", ["get", "id"], featureId ?? ""];
}

/** Opacity expression for land polygons. SST dims land; others render at 1. */
export function buildFillOpacityExpression(modeId: DisplayModeId): number {
  return DISPLAY_MODES[modeId].kind === "diverging-ocean" ? 0.25 : 1;
}

export type StyleInput = {
  /** Signed pmtiles URL for the free archive — country + admin-1, free variables. */
  freeTilesUrl: string;
  /**
   * Signed pmtiles URL for the premium archive — country + admin-1 + admin-2,
   * all variables. When present it supersedes `freeTilesUrl` for every layer,
   * because the premium-only variables exist nowhere else. Pass `null` for an
   * unentitled or denied session to fall back to the free archive.
   */
  premiumTilesUrl: string | null;
  /** Active display mode. Default: `preferences`. */
  mode: DisplayModeId;
  /** 1-indexed month. Default: current month. */
  month: number;
  /**
   * The user's weather preferences. Only the `preferences` mode reads them,
   * and only to build a paint expression — a preference change never touches
   * the sources, so the canvas updates paint in place rather than restyling.
   */
  preferences?: WeatherPreferences;
};

export function buildMapStyle(input: StyleInput): StyleSpecification {
  const {
    freeTilesUrl,
    premiumTilesUrl,
    mode,
    month,
    preferences = DEFAULT_PREFERENCES,
  } = input;
  const fillColor = buildFillColorExpression(mode, month, preferences);
  const fillOpacity = buildFillOpacityExpression(mode);

  // A layer can only read properties from its own source — MapLibre has no
  // cross-source join — and the premium-only variables (snow, SST, heat index,
  // humidity) exist solely in the premium archive. So an entitled user has to
  // read country and admin-1 from the premium archive too, or those variables
  // paint missing-grey everywhere above admin-2 zoom.
  //
  // The premium archive carries country and admin-1 as well as admin-2 (the
  // pipeline refuses to build it otherwise), so this needs no extra data. When
  // premium is absent or denied, everything falls back to the free archive and
  // the map degrades to the free variable set rather than breaking.
  const baseSourceId = premiumTilesUrl ? PREMIUM_SOURCE_ID : FREE_SOURCE_ID;

  const sources: StyleSpecification["sources"] = premiumTilesUrl
    ? {
        [PREMIUM_SOURCE_ID]: {
          type: "vector",
          url: `pmtiles://${premiumTilesUrl}`,
          attribution: "© ERA5 · geoBoundaries · Natural Earth",
        },
      }
    : {
        [FREE_SOURCE_ID]: {
          type: "vector",
          url: `pmtiles://${freeTilesUrl}`,
          attribution: "© ERA5 · geoBoundaries · Natural Earth",
        },
      };

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
      source: baseSourceId,
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
      source: baseSourceId,
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
      source: baseSourceId,
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
      source: baseSourceId,
      "source-layer": "admin1",
      maxzoom: ZOOM_ADMIN1_MIN,
      filter: suppressedFilter,
      paint: { "line-color": LINE_COLOR, "line-opacity": 0.2, "line-width": 0.4 },
    },
    {
      id: ADMIN1_FILL_LAYER,
      type: "fill",
      source: baseSourceId,
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
      source: baseSourceId,
      "source-layer": "admin1",
      minzoom: ZOOM_ADMIN1_MIN,
      maxzoom: ZOOM_ADMIN1_MAX,
      paint: { "line-color": LINE_COLOR, "line-opacity": 0.35, "line-width": 0.6 },
    },
    {
      id: COUNTRY_SELECTED_LAYER,
      type: "line",
      source: baseSourceId,
      "source-layer": "country",
      maxzoom: ZOOM_COUNTRY_MAX,
      filter: buildSelectionFilter(null),
      paint: { "line-color": LINE_COLOR, "line-width": 2, "line-opacity": 1 },
    },
    {
      // No `minzoom`: a suppressed country's admin-1 polygons are also what
      // the mosaic paints below the admin-1 handover zoom, and a click there
      // has to outline something.
      id: ADMIN1_SELECTED_LAYER,
      type: "line",
      source: baseSourceId,
      "source-layer": "admin1",
      maxzoom: ZOOM_ADMIN1_MAX,
      filter: buildSelectionFilter(null),
      paint: { "line-color": LINE_COLOR, "line-width": 2, "line-opacity": 1 },
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
      {
        id: ADMIN2_SELECTED_LAYER,
        type: "line",
        source: PREMIUM_SOURCE_ID,
        "source-layer": "admin2",
        minzoom: ZOOM_ADMIN2_MIN,
        filter: buildSelectionFilter(null),
        paint: { "line-color": LINE_COLOR, "line-width": 2, "line-opacity": 1 },
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
