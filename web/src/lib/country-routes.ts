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
 * The published countries, or `[]` when the API is not reachable.
 *
 * A production build is expected to reach it: `infra/scripts/setup-build-builder.sh`
 * puts the buildx builder on the compose network so `http://api:8000` resolves
 * during `docker build`, and the whole country tree pre-renders into the image.
 *
 * A connection failure is still not fatal, because the site is correct without
 * it — the pages render on first request and cache from there, which is what
 * `dynamicParams` and `revalidate` are for. Failing the build would mean a
 * `pnpm build` on a laptop with no stack up could not produce an image at all.
 * It is loud rather than silent because the difference it makes (every first
 * visitor paying for a render) is invisible from the outside.
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
      "[country-routes] the API is not reachable, so country pages will be " +
        "rendered on demand rather than pre-rendered. In a production build " +
        "this means the builder is not on the compose network — see " +
        "infra/scripts/setup-build-builder.sh.",
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
