/**
 * Country registry — every ISO-3166-1 alpha-2 code a tile feature can carry,
 * with the name and URL slug the site uses for it.
 *
 * The table itself lives in `countries.generated.ts` and is derived from the
 * same Natural Earth admin-0 layer the pipeline builds the tiles' `country`
 * level from (`pipeline/scripts/generate_country_registry.py`). It used to be
 * nine hand-typed entries, which is why clicking the map did nothing for all
 * but nine countries: the click handler looked the feature's `iso_a2` up here
 * and silently gave up on a miss.
 *
 * Do not hand-edit the generated file — regenerate it and review the diff.
 */

import { GENERATED_COUNTRIES } from "./countries.generated";

export type CountryRef = {
  slug: string;
  name: string;
  iso2: string;
  region: string;
};

export const COUNTRIES: readonly CountryRef[] = GENERATED_COUNTRIES;

// Lookups are on the map's hover/click path, which fires on every pointer
// move over a polygon — a linear scan of 237 entries per event is avoidable
// work, so both indexes are built once at module load.
const BY_SLUG: ReadonlyMap<string, CountryRef> = new Map(
  COUNTRIES.map((c) => [c.slug, c]),
);

const BY_ISO2: ReadonlyMap<string, CountryRef> = new Map(
  COUNTRIES.map((c) => [c.iso2, c]),
);

export function findCountry(slug: string): CountryRef | undefined {
  return BY_SLUG.get(slug);
}

/**
 * Resolve a feature's `iso_a2` to a country. Returns `undefined` for the
 * codeless polygons the pipeline paints but deliberately leaves unroutable
 * (Somaliland, Northern Cyprus, the Siachen Glacier), and for the empty string
 * those features carry.
 */
export function findCountryByIso2(iso2: string): CountryRef | undefined {
  if (!iso2) return undefined;
  return BY_ISO2.get(iso2.toUpperCase());
}
