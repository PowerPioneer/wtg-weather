/**
 * Which countries the static route tree and the sitemap are generated for.
 *
 * The registry (`countries.ts`) is the whole world — it has to be, because the
 * map has to resolve every ISO-2 code a painted polygon can carry. Pages are a
 * different question: `/[country]` sets `dynamicParams = false`, so a slug that
 * is generated but has no data behind it becomes a build-time 404, and the
 * sitemap would advertise thousands of them.
 *
 * So route generation is gated on the data path rather than on the registry.
 * While the SSR pages run on fixtures (`USE_MOCK_DATA`) that is the three
 * mocked countries; when the real `/v1/countries/{slug}` endpoint lands and the
 * flag goes off, this widens to the full registry with no further change here.
 */

import { COUNTRIES, type CountryRef } from "./countries";
import { USE_MOCK_DATA } from "./env";
import { mockCountrySlugs } from "./mock-data";

export function routableCountries(): readonly CountryRef[] {
  if (!USE_MOCK_DATA) return COUNTRIES;
  const mocked = new Set(mockCountrySlugs());
  return COUNTRIES.filter((country) => mocked.has(country.slug));
}
