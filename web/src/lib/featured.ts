/**
 * The landing page's "featured countries" grid.
 *
 * This shipped fixture-backed: `/` built its grid from `mockCountrySlugs()`
 * *directly*, not gated on `WTG_USE_MOCK_DATA`, so production's front door
 * showed Peru, Japan and Iceland — three fixtures — regardless of what the
 * pipeline had published. The flag was fixed in WS-5; this call site was
 * simply never routed through it.
 *
 * Selection has two parts, and they answer different questions:
 *
 *   1. *Which countries are eligible* — {@link FEATURED_CANDIDATES}, an
 *      editorial shortlist, intersected with the published index. The
 *      intersection is the load-bearing half: a slug the API cannot answer for
 *      is a card linking to a 404, and the shortlist is hand-kept while the
 *      published set moves with the pipeline.
 *   2. *Which of those to show* — real current-month scores from the same
 *      `monthScore` the country pages and the map use.
 *
 * Ranking the whole published set would be more principled and is what the
 * plan suggests, but `/v1/countries` carries only slug/name/iso2/region: a
 * score means fetching all ~237 country payloads on every revalidation of the
 * landing page. A shortlist keeps that at a dozen. Everything shown is real
 * either way; the shortlist decides what is on the shelf, not what the numbers
 * say.
 */

import { getCountry } from "./api-client";
import { routableCountries } from "./country-routes";
import { monthScore } from "./country-derive";
import { MONTH_NAMES, MONTH_SLUGS, type MonthSlug } from "./months";

/**
 * Eligible countries, in no particular order — the scores below decide the
 * order. Spread across regions so the grid doesn't read as one continent.
 *
 * Adding a slug here is safe: an unpublished one is dropped. Removing one only
 * changes what is featured.
 */
export const FEATURED_CANDIDATES: readonly string[] = [
  "australia",
  "chile",
  "colombia",
  "costa-rica",
  "croatia",
  "greece",
  "iceland",
  "indonesia",
  "italy",
  "japan",
  "kenya",
  "mexico",
  "morocco",
  "namibia",
  "new-zealand",
  "norway",
  "peru",
  "portugal",
  "south-africa",
  "spain",
  "sri-lanka",
  "thailand",
  "turkey",
  "vietnam",
];

/** Three across on desktop, two rows. */
export const FEATURED_COUNT = 6;

export type FeaturedCountry = {
  slug: string;
  name: string;
  region: string;
  month: MonthSlug;
  monthName: string;
  /** 0–100 match for {@link FeaturedCountry.month}, default preferences. */
  score: number;
};

/**
 * The grid, ranked by how well each country matches default preferences in
 * `monthIdx`.
 *
 * Deterministic: same month and same published index in, same grid out. Ties
 * break on slug, which matters more than it sounds — the scoring rule buckets
 * rather than grades, so it emits four distinct values and ties are the common
 * case. Without the tie-break the grid would reshuffle on every rebuild.
 *
 * Returns `[]` when the API is unreachable, which is the same "render on
 * demand instead" posture `routableCountries` takes; the caller renders the
 * rest of the page.
 */
export async function featuredCountries(monthIdx: number): Promise<FeaturedCountry[]> {
  const published = await routableCountries();
  if (published.length === 0) return [];

  const byslug = new Map(published.map((c) => [c.slug, c]));
  const eligible = FEATURED_CANDIDATES.filter((slug) => byslug.has(slug));

  const month = MONTH_SLUGS[((monthIdx % 12) + 12) % 12]!;
  const monthName = MONTH_NAMES[month];

  const loaded = await Promise.all(
    eligible.map(async (slug) => {
      // One unpublished payload must not blank the whole grid. `getCountry`
      // returns null on 404 and throws on anything else; both mean "no card".
      const data = await getCountry(slug).catch(() => null);
      if (!data) return null;
      const score = monthScore(data, MONTH_SLUGS.indexOf(month));
      if (score === null) return null;
      const ref = byslug.get(slug)!;
      return {
        slug,
        name: data.name,
        region: ref.region,
        month,
        monthName,
        score,
      } satisfies FeaturedCountry;
    }),
  );

  return loaded
    .filter((c): c is FeaturedCountry => c !== null)
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
    .slice(0, FEATURED_COUNT);
}
