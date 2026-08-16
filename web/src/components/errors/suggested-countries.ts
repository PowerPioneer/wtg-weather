import { routableCountries } from "@/lib/country-routes";
import { FEATURED_CANDIDATES } from "@/lib/featured";
import type { Suggestion } from "./not-found-view";

/**
 * Countries worth offering someone who has landed on a 404.
 *
 * Deliberately cheap. `featuredCountries()` ranks its shortlist by real
 * current-month scores, which costs one payload fetch per candidate — fine on
 * the landing page, wrong on an error path that exists to be fast and to work
 * when things are already going badly. This reads the published index only
 * (one request, cached for an hour) and takes the shortlist in its listed
 * order.
 *
 * Intersecting with the published index is the load-bearing part: the whole
 * point of the page is that a link 404'd, so offering another link that 404s
 * would be a poor apology. An unreachable API yields `[]` and the 404 renders
 * with its fixed links alone.
 */
export async function suggestedCountries(limit = 8): Promise<Suggestion[]> {
  const published = await routableCountries().catch(() => []);
  if (published.length === 0) return [];

  const byslug = new Map(published.map((c) => [c.slug, c]));
  return FEATURED_CANDIDATES.filter((slug) => byslug.has(slug))
    .slice(0, limit)
    .map((slug) => ({ slug, name: byslug.get(slug)!.name }));
}
