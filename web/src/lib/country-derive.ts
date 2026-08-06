/**
 * Derived values on top of `CountryData`. Every function here is pure — given
 * the same country and inputs, it returns the same output — so callers can use
 * them inside RSC and client components alike without worrying about fetching
 * order.
 *
 * These used to be a hand-rolled heuristic ("+points for moderate temperature,
 * −points for rain") that agreed with nothing else in the app. `web/CLAUDE.md`
 * says scoring is "shared between the map paint expressions and the SSR pages",
 * and it now is: both go through `preferenceScore`, which reproduces the
 * pipeline's `polygon_score` bucket for bucket. A country page and the map now
 * put the same number on the same month.
 */

import { DEFAULT_PREFERENCES, preferenceScore, type WeatherPreferences } from "./scoring";
import type { CountryData } from "./types";

/**
 * National match score for one month, 0–100, or `null` when the country
 * carries no series for it. The three inputs are the three the rule consults;
 * rainfall is read from `rDay` because the rule is expressed in mm/day and
 * `r` is the same series scaled up to a monthly total for display.
 */
export function monthScore(
  country: CountryData,
  monthIdx: number,
  prefs: WeatherPreferences = DEFAULT_PREFERENCES,
): number | null {
  const c = country.climate;
  return preferenceScore(
    { t: c.t[monthIdx], r: c.rDay[monthIdx], s: c.s[monthIdx] },
    prefs,
  );
}

/** Same, with `null` flattened to 0 for callers that must render a number. */
export function estimateMonthScore(country: CountryData, monthIdx: number): number {
  return monthScore(country, monthIdx) ?? 0;
}

/**
 * Rank of a month among the year. 1 = best, 12 = worst. Stable tie-break
 * favours earlier months.
 *
 * The score has only four distinct values (the rule buckets rather than
 * grades), so ties are the common case rather than the edge case — which is
 * why the tie-break is part of the contract and not an implementation detail.
 */
export function monthRank(country: CountryData, monthIdx: number): number {
  const scores = country.climate.t.map((_, i) => ({
    i,
    score: estimateMonthScore(country, i),
  }));
  scores.sort((a, b) => (b.score - a.score) || (a.i - b.i));
  return scores.findIndex((x) => x.i === monthIdx) + 1;
}
