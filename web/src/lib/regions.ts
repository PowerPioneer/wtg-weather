/**
 * Region helpers. Regions live inside a `CountryData` as `RegionRow[]`
 * (name + score + 12-month temperature). These helpers slug the name into
 * a URL-safe form, look up a region from a slug, and derive per-month
 * scoring / ranking the same way `country-derive.ts` does for countries.
 *
 * When the pipeline ships per-region rainfall and sunshine (Phase 6+), the
 * derivation here is replaced by real fields on the API response; until then
 * we blend the region's temperature profile with the country's rainfall and
 * sunshine so the page has something credible to show.
 */

import { clampScore } from "./scoring";
import type { CountryData, Monthly, RegionRow } from "./types";

/**
 * URL slug for a region name. Strips diacritics, lowercases, hyphenates.
 * Stable across restarts — safe to use in `generateStaticParams`.
 */
export function regionSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function findRegion(country: CountryData, slug: string): RegionRow | null {
  return country.regions.find((r) => regionSlug(r.name) === slug) ?? null;
}

/** Annual temperature range for the region sparkline caption. */
export function regionTempRange(region: RegionRow): { low: number; high: number } {
  return { low: Math.min(...region.tl), high: Math.max(...region.tl) };
}

/**
 * Per-month score for a region. Mirrors `estimateMonthScore` in
 * `country-derive.ts` but reads the region's own temperature; rainfall and
 * sunshine fall back to the country mean until the pipeline ships them
 * per-region.
 */
export function estimateRegionMonthScore(
  country: CountryData,
  region: RegionRow,
  monthIdx: number,
): number {
  const t = region.tl[monthIdx];
  const r = country.climate.r[monthIdx];
  const s = country.climate.s[monthIdx];

  const tScore = 100 - Math.min(100, Math.abs(t - 20) * 5);
  const rScore = 100 - Math.min(100, r * 0.6);
  const sScore = 50 + Math.min(50, (s - 4) * 10);

  const raw = tScore * 0.5 + rScore * 0.3 + sScore * 0.2;
  return Math.round(clampScore(raw));
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
