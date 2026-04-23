/**
 * Derived values on top of `CountryData`. Every function here is pure — given
 * the same country and inputs, it returns the same output — so callers can
 * use them inside RSC and client components alike without worrying about
 * fetching order.
 *
 * These are Phase-5.3 placeholders. The real scoring lives in the pipeline
 * and will be baked into each region's `score` field; until the API wires
 * through per-month regional scores, we estimate from the national averages
 * so the SSR pages have something credible to render.
 */

import { clampScore } from "./scoring";
import type { CountryData } from "./types";

/**
 * National per-month score. Leans on the simple heuristic:
 *   • +points for moderate temperature (15–24°C ideal)
 *   • −points for high rainfall
 *   • +points for sunshine
 * Bounded to 0–100. Purely illustrative; real scores come from preferences.
 */
export function estimateMonthScore(country: CountryData, monthIdx: number): number {
  const t = country.climate.t[monthIdx];
  const r = country.climate.r[monthIdx];
  const s = country.climate.s[monthIdx];

  const tScore = 100 - Math.min(100, Math.abs(t - 20) * 5);
  const rScore = 100 - Math.min(100, r * 0.6);
  const sScore = 50 + Math.min(50, (s - 4) * 10);

  const raw = tScore * 0.5 + rScore * 0.3 + sScore * 0.2;
  return Math.round(clampScore(raw));
}

/**
 * Rank of a month among the year. 1 = best, 12 = worst. Stable tie-break
 * favours earlier months.
 */
export function monthRank(country: CountryData, monthIdx: number): number {
  const scores = country.climate.t.map((_, i) => ({
    i,
    score: estimateMonthScore(country, i),
  }));
  scores.sort((a, b) => (b.score - a.score) || (a.i - b.i));
  const rank = scores.findIndex((x) => x.i === monthIdx) + 1;
  return rank;
}
