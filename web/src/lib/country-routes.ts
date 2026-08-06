/**
 * Which countries the static route tree and the sitemap are generated for.
 *
 * The registry (`countries.ts`) is the whole world — it has to be, because the
 * map must resolve every ISO-2 code a painted polygon can carry. Pages are a
 * different question: a slug that is generated but has no data behind it is a
 * page that 404s, and a line in the sitemap advertising it.
 *
 * So route generation is gated on the data path, and specifically on the
 * *published* set rather than the registry: `/v1/countries` lists exactly the
 * countries the pipeline could build a complete climate series for, which is
 * not quite the registry (a polygon with no ERA5 coverage is painted but has
 * nothing to say on a page). Reading the index makes the two sets identical by
 * construction instead of by hope.
 */

import { getCountryIndex } from "./api-client";
import type { CountryRef } from "./countries";

/**
 * The published countries, or `[]` when the API is not reachable *yet*.
 *
 * `pnpm build` runs inside `docker build`, which is not on the compose network
 * — `http://api:8000` does not resolve there, and it is not supposed to. So a
 * connection failure is a normal condition for this call, not an error: the
 * pages it would have pre-rendered simply render on first request instead and
 * cache from there, which is what `dynamicParams` and `revalidate` are for.
 * Build the image with the API reachable (a dev machine, or CI with the stack
 * up) and the whole tree is pre-rendered as before.
 *
 * A *reachable* API answering badly is a different thing entirely and is left
 * to throw: a 503 means the published bundle is not mounted, and quietly
 * shipping a site with no country pages is how the mock data path went
 * unnoticed in production for a whole phase.
 */
export async function routableCountries(): Promise<readonly CountryRef[]> {
  try {
    return await getCountryIndex();
  } catch (error) {
    if (!isConnectionFailure(error)) throw error;
    console.warn(
      "[country-routes] the API is not reachable; country pages will be " +
        "rendered on demand rather than pre-rendered. This is expected " +
        "during `docker build` and a problem anywhere else.",
    );
    return [];
  }
}

/**
 * Whether this is "nothing answered" rather than "something answered badly".
 * `fetch` reports the former as a TypeError wrapping a Node system error, so
 * the code hides one level down.
 */
function isConnectionFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = error.cause;
  const code =
    cause && typeof cause === "object" && "code" in cause
      ? String((cause as { code: unknown }).code)
      : "";
  return (
    error.name === "TypeError" ||
    ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT"].includes(code)
  );
}
