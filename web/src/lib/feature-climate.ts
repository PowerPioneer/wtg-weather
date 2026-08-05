/**
 * Reading climate out of a clicked/hovered map feature.
 *
 * The tiles already carry everything the hover card and the climate panel
 * show — `web/CLAUDE.md` is explicit that the browser never fetches climate
 * data, it is baked into the PMTiles — so these helpers are the whole data
 * path for the map's interaction UX. What the pipeline writes per feature
 * (`pipeline/src/wtg_pipeline/tiles/build_geojson.py`):
 *
 *   id, iso_a2, admin1_code, name, level          — identity
 *   t_01…t_12, r_, s_, w_ (+ premium snow_/sst_/hum_/heat_)  — p50, display units
 *   t2m_p10_01 / t2m_p50_01 / t2m_p90_01, …       — full percentile triplet
 *   pref_01…pref_12                               — baked default-preference score
 *   safety                                        — advisory level (WS-4)
 *
 * Feature properties arrive as `unknown`, and a property that is missing from
 * the tier or the level is a normal case rather than an error — everything
 * here returns `null` instead of throwing or coercing.
 */

import { DISPLAY_MODES, modeProperty, type DisplayModeId } from "./display-modes";

export type FeatureLevel = "country" | "admin1" | "admin2";

export type FeatureIdentity = {
  /** Polygon id — `ADM0_A3` / `adm1_code` / geoBoundaries id, namespaced per level. */
  id: string;
  /** Feature's own name: the country, region or district. */
  name: string;
  /** ISO-3166-1 alpha-2, or `""` for the polygons the pipeline leaves unroutable. */
  iso2: string;
  level: FeatureLevel;
  /** ISO-3166-2 region code where the pipeline has one. */
  admin1Code: string;
};

/** 12 values, January first. `null` where the tier or level has no data. */
export type MonthlySeries = readonly (number | null)[];

export type MonthlyBands = {
  p10: MonthlySeries;
  p50: MonthlySeries;
  p90: MonthlySeries;
};

export type FeatureProperties = Record<string, unknown>;

const LEVELS: readonly FeatureLevel[] = ["country", "admin1", "admin2"];

function readString(props: FeatureProperties, key: string): string {
  const value = props[key];
  return typeof value === "string" ? value : "";
}

/** Numeric property, or `null` when absent, non-finite, or not a number. */
export function readNumber(
  props: FeatureProperties,
  key: string,
): number | null {
  const value = props[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function monthKey(prefix: string, month: number): string {
  return `${prefix}_${String(month).padStart(2, "0")}`;
}

export function readFeatureIdentity(
  props: FeatureProperties | null | undefined,
): FeatureIdentity | null {
  if (!props) return null;
  const id = readString(props, "id");
  if (!id) return null;
  const rawLevel = readString(props, "level");
  const level = (LEVELS as readonly string[]).includes(rawLevel)
    ? (rawLevel as FeatureLevel)
    : "country";
  return {
    id,
    name: readString(props, "name"),
    iso2: readString(props, "iso_a2").toUpperCase(),
    level,
    admin1Code: readString(props, "admin1_code"),
  };
}

/** 12 monthly values for a short property alias (`t`, `r`, `s`, `w`, …). */
export function readMonthlySeries(
  props: FeatureProperties,
  prefix: string,
): MonthlySeries | null {
  const out: (number | null)[] = [];
  let found = false;
  for (let month = 1; month <= 12; month++) {
    const value = readNumber(props, monthKey(prefix, month));
    if (value != null) found = true;
    out.push(value);
  }
  return found ? out : null;
}

/**
 * The p10 / p50 / p90 triplet for a raw ERA5 variable (`t2m`, `tp`, …).
 * Returns `null` unless all three are present for at least one month — a
 * partial band would draw a chart that lies about its own uncertainty.
 */
export function readMonthlyBands(
  props: FeatureProperties,
  variable: string,
): MonthlyBands | null {
  const p10 = readMonthlySeries(props, `${variable}_p10`);
  const p50 = readMonthlySeries(props, `${variable}_p50`);
  const p90 = readMonthlySeries(props, `${variable}_p90`);
  if (!p10 || !p50 || !p90) return null;
  return { p10, p50, p90 };
}

/**
 * The baked default-preference score (0–100) for one month.
 *
 * This is `pref_<mm>`, computed by the pipeline from `DEFAULT_PREFERENCES`.
 * Once WS-3 lands client-side scoring, the panel and the hover card should
 * take their score from the same expression the paint uses instead.
 */
export function readPreferenceScore(
  props: FeatureProperties,
  month: number,
): number | null {
  return readNumber(props, monthKey("pref", month));
}

/** Value the active display mode paints for this feature, in display units. */
export function readModeValue(
  props: FeatureProperties,
  modeId: DisplayModeId,
  month: number,
): number | null {
  return readNumber(props, modeProperty(DISPLAY_MODES[modeId], month));
}

/** Feature properties as a plain record — MapLibre types them loosely. */
export function featureProperties(feature: {
  properties?: unknown;
}): FeatureProperties {
  const props = feature.properties;
  if (props && typeof props === "object") return props as FeatureProperties;
  return {};
}
