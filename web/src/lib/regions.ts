/**
 * Region helpers. Regions live inside a `CountryData` as `RegionRow[]` —
 * name, URL slug, and the region's own 12-month temperature, rainfall and
 * sunshine. These helpers resolve a region from a slug and score it.
 *
 * Scoring goes through `preferenceScore`, the same function the map's paint
 * expression and the national score use, so a region card and the polygon
 * under the cursor agree. Where the pipeline has no per-region rainfall or
 * sunshine, the country's own series stands in for that variable — which is
 * a visible approximation rather than a different rule.
 */

import { DEFAULT_PREFERENCES, preferenceScore, type WeatherPreferences } from "./scoring";
import type { CountryData, Monthly, RegionRow } from "./types";

/**
 * URL slug for a region name. Strips diacritics, lowercases, hyphenates.
 * Mirrors `slugify` in `pipeline/processing/country_registry.py`, which is
 * what actually assigns `RegionRow.slug`; this is the fallback for a fixture
 * or an older payload that carries none.
 */
export function regionSlug(name: string): string {
  return name
    .normalize("NFD")
    // Drop the combining marks NFD just split off, so "Áncash" and "Ancash"
    // reach the same URL. `\p{Mn}` is the Unicode category rather than a
    // hand-written codepoint range: the range form has to be spelled with
    // literal combining characters or escapes, and both are easy for an
    // editor or a merge to mangle into something that silently matches less.
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The region's canonical URL segment. Prefers the slug the pipeline assigned,
 * because that is the one it de-duplicated: two admin-1 units in one country
 * can share a name once diacritics are stripped, and slugging the name here
 * would make the second of them unreachable.
 */
export function regionHref(region: RegionRow): string {
  return region.slug ?? regionSlug(region.name);
}

export function findRegion(country: CountryData, slug: string): RegionRow | null {
  return country.regions.find((r) => regionHref(r) === slug) ?? null;
}

/**
 * Resolve a region by its admin-1 polygon id (`adm1_code`).
 *
 * This is the map's way in: a clicked feature knows its polygon id and its
 * name, but not the slug — which the pipeline de-duplicates, so two regions
 * whose names slug identically differ only by a suffix the tiles never saw.
 * Returns `null` for a payload published before regions carried the code, and
 * the caller falls back to the slug.
 */
export function findRegionByCode(
  country: CountryData,
  code: string,
): RegionRow | null {
  if (!code) return null;
  return country.regions.find((r) => r.code === code) ?? null;
}

/** Annual temperature range for the region sparkline caption. */
export function regionTempRange(region: RegionRow): { low: number; high: number } {
  return { low: Math.min(...region.tl), high: Math.max(...region.tl) };
}

/**
 * Per-month score for a region, 0–100, or `null` when nothing is known.
 * Rainfall and sunshine fall back to the country mean for a region the
 * pipeline has no per-region series for.
 */
export function regionMonthScore(
  country: CountryData,
  region: RegionRow,
  monthIdx: number,
  prefs: WeatherPreferences = DEFAULT_PREFERENCES,
): number | null {
  return preferenceScore(
    {
      t: region.tl[monthIdx],
      r: region.rl?.[monthIdx] ?? country.climate.rDay[monthIdx],
      s: region.sl?.[monthIdx] ?? country.climate.s[monthIdx],
    },
    prefs,
  );
}

export function estimateRegionMonthScore(
  country: CountryData,
  region: RegionRow,
  monthIdx: number,
): number {
  return regionMonthScore(country, region, monthIdx) ?? 0;
}

/** Rank of a month for the region. 1 = best, 12 = worst. Stable tie-break. */
export function regionMonthRank(
  country: CountryData,
  region: RegionRow,
  monthIdx: number,
): number {
  const scores = region.tl.map((_, i) => ({
    i,
    score: estimateRegionMonthScore(country, region, i),
  }));
  scores.sort((a, b) => (b.score - a.score) || (a.i - b.i));
  return scores.findIndex((x) => x.i === monthIdx) + 1;
}

/** 12-element array of per-month scores. Used by the best-month picker. */
export function regionMonthlyScores(
  country: CountryData,
  region: RegionRow,
): Monthly {
  const out = region.tl.map((_, i) => estimateRegionMonthScore(country, region, i));
  return out as unknown as Monthly;
}

/** Top-N month indices (best first). Stable tie-break favours earlier months. */
export function regionBestMonthIndices(
  country: CountryData,
  region: RegionRow,
  n = 3,
): number[] {
  const scored = region.tl.map((_, i) => ({
    i,
    score: estimateRegionMonthScore(country, region, i),
  }));
  scored.sort((a, b) => (b.score - a.score) || (a.i - b.i));
  return scored.slice(0, n).map((s) => s.i);
}
