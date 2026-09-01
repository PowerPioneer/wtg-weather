/**
 * "Where should I go in April?" — the published countries ranked for one
 * month, for the `/best-weather-in/[month]` pages.
 *
 * The rank is the same `monthScore` the map, the country pages and the
 * featured grid use: the pipeline's `polygon_score` rule, reproduced bucket
 * for bucket. Nothing here invents a second opinion about how good a month is,
 * and the number these pages print is that score.
 *
 * ── The tie-break, and why it needs one ──────────────────────────────────
 *
 * `preferenceScore` buckets rather than grades: it returns one of exactly four
 * values (25 / 60 / 75 / 90). In a good month for travel, dozens of countries
 * score 90. "Top 15 by score" is therefore "15 of the countries that scored
 * 90", and if the only tie-break is the slug, the page is a list of the
 * alphabetically luckiest — Australia, Belize, Chile — which is a worse answer
 * than the data can give.
 *
 * So ties break on {@link comfortMargin}: how far inside the preferred ranges
 * a country actually sits, measured against the *same three ranges the scoring
 * rule uses* and no others. A country in the middle of the comfortable band
 * outranks one clinging to its edge. This is ordering only — it is never
 * displayed, never stored, and never changes a score. The visible number stays
 * the bucket score, so a country listed here and opened on its own page shows
 * the same figure, which is the property `web/CLAUDE.md` cares about.
 *
 * Slug remains the final tie-break so the ordering is total and a rebuild with
 * identical data produces an identical page.
 */

import { getCountry } from "./api-client";
import { routableCountries } from "./country-routes";
import { monthScore } from "./country-derive";
import { MONTH_NAMES, MONTH_SLUGS, monthIndex, type MonthSlug } from "./months";
import {
  DEFAULT_PREFERENCES,
  preferenceRanges,
  type ScoredAlias,
  type WeatherPreferences,
} from "./scoring";
import type { CountryData } from "./types";

/** How many countries a month page lists. */
export const TOP_N = 15;

export type RankedCountry = {
  slug: string;
  name: string;
  region: string;
  /** 1-based position in the list. */
  rank: number;
  /** 0–100, the bucketed score — the same one every other surface shows. */
  score: number;
  /** °C mean for the month. */
  temp: number;
  /** mm for the month, for display. */
  rain: number;
  /** Sunshine hours per day. */
  sun: number;
};

/**
 * How comfortably a country's month sits inside the preferred ranges, roughly
 * −1 (far outside) to 1 (dead centre of all three).
 *
 * Ordering only — see the note at the top of this file. For each scored
 * variable it takes the distance to the nearer edge of the preferred range,
 * positive inside and negative outside, normalised by the range's half-width
 * so temperature in °C and rainfall in mm/day are comparable, and averages
 * across the variables the country actually carries.
 */
export function comfortMargin(
  country: CountryData,
  monthIdx: number,
  prefs: WeatherPreferences = DEFAULT_PREFERENCES,
): number {
  const c = country.climate;
  const values: Record<ScoredAlias, number | undefined> = {
    t: c.tMax[monthIdx],
    tmin: c.tMin[monthIdx],
    r: c.rDay[monthIdx],
    s: c.s[monthIdx],
  };

  let total = 0;
  let counted = 0;
  for (const range of preferenceRanges(prefs)) {
    const value = values[range.alias];
    if (value == null || !Number.isFinite(value)) continue;
    const half = (range.hi - range.lo) / 2;
    if (half <= 0) continue;
    const depth = Math.min(value - range.lo, range.hi - value);
    total += Math.max(-1, Math.min(1, depth / half));
    counted += 1;
  }
  return counted === 0 ? -1 : total / counted;
}

/** Thrown when the published index is empty at request time — see the page. */
export class NoPublishedCountriesError extends Error {
  constructor() {
    super(
      "the published country index is empty, so a month page would rank nothing",
    );
    this.name = "NoPublishedCountriesError";
  }
}

/**
 * The month's ranking, best first.
 *
 * Costs one index request plus one payload per published country — the index
 * carries slug/name/iso2/region only, so a score means reading the payload.
 * That is ~237 requests for a cold render, and near zero after: `getCountry`
 * fetches with a 30-day revalidation, so the twelve month pages of a build
 * share one pass over the countries rather than doing twelve, and a monthly
 * revalidation of one page re-uses whatever the others already warmed.
 *
 * Requests run in a small pool rather than all at once. 237 simultaneous
 * fetches at the internal API, times however many of these pages Next chooses
 * to prerender in parallel, is a self-inflicted load spike during exactly the
 * build the API also has the country tree to serve.
 *
 * Throws {@link NoPublishedCountriesError} on an empty index. A page that
 * ranks nothing is not a page, and `revalidate` would then cache the empty
 * version of it for a month; better to fail into the error boundary and be
 * re-asked. The build path never reaches this — `generateStaticParams` emits
 * no months when the API is unreachable.
 */
export async function topCountriesForMonth(
  month: MonthSlug,
  limit: number = TOP_N,
  prefs: WeatherPreferences = DEFAULT_PREFERENCES,
): Promise<RankedCountry[]> {
  const published = await routableCountries();
  if (published.length === 0) throw new NoPublishedCountriesError();

  const idx = monthIndex(month);

  const scored = await mapPool(published, 8, async (ref) => {
    // One missing payload must not blank the page. `getCountry` returns null
    // on 404 and throws otherwise; both mean "not in this ranking".
    const data = await getCountry(ref.slug).catch(() => null);
    if (!data) return null;
    const score = monthScore(data, idx, prefs);
    if (score === null) return null;
    return {
      slug: ref.slug,
      name: data.name,
      region: ref.region,
      score,
      margin: comfortMargin(data, idx, prefs),
      temp: data.climate.t[idx]!,
      rain: data.climate.r[idx]!,
      sun: data.climate.s[idx]!,
    };
  });

  return scored
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.margin - a.margin ||
        a.slug.localeCompare(b.slug),
    )
    .slice(0, limit)
    // `margin` is dropped here on purpose: it ordered the list and has no
    // business on a page, where the only number shown is the bucket score.
    .map((c, i) => ({
      slug: c.slug,
      name: c.name,
      region: c.region,
      rank: i + 1,
      score: c.score,
      temp: c.temp,
      rain: c.rain,
      sun: c.sun,
    }));
}

/** `Promise.all` with a ceiling on how many run at once. Order is preserved. */
async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]!);
      }
    },
  );
  await Promise.all(workers);
  return out;
}

/** `/best-weather-in/<slug>` for every month — the route's static params. */
export function monthLandingPaths(): { month: MonthSlug }[] {
  return MONTH_SLUGS.map((month) => ({ month }));
}

export function monthLandingHref(month: MonthSlug): string {
  return `/best-weather-in/${month}`;
}

export function monthLandingTitle(month: MonthSlug): string {
  return `Best weather in ${MONTH_NAMES[month]}`;
}
