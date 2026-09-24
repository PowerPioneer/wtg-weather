/**
 * Country search — the one way into the site besides the map and SEO.
 *
 * Pure and synchronous: it runs on the `/search` server route against the
 * routable set, and needs nothing from the network beyond that list. The
 * header's typeahead is a native `<datalist>`, so no client code calls this.
 */

import type { CountryRef } from "./countries";

/** Lower-case, strip diacritics and punctuation: "Côte d'Ivoire" → "cote divoire". */
export function normaliseQuery(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Countries matching `query`, best first.
 *
 * Rank, highest first: exact name, exact ISO-2 code, name starts with the
 * query, a word in the name starts with it ("congo" finds "Republic of the
 * Congo"), substring anywhere. Ties keep alphabetical order. An empty or
 * one-character query matches nothing — one letter would list a third of the
 * world, which is the `/countries` page's job.
 */
export function searchCountries(
  query: string,
  countries: readonly CountryRef[],
  limit = 20,
): CountryRef[] {
  const q = normaliseQuery(query);
  if (q.length < 2) return [];

  const scored: { country: CountryRef; score: number }[] = [];
  for (const country of countries) {
    const name = normaliseQuery(country.name);
    let score = 0;
    if (name === q) score = 5;
    else if (q.length === 2 && country.iso2.toLowerCase() === q) score = 4;
    else if (name.startsWith(q)) score = 3;
    else if (name.split(" ").some((word) => word.startsWith(q))) score = 2;
    else if (name.includes(q)) score = 1;
    if (score > 0) scored.push({ country, score });
  }

  return scored
    .sort(
      (a, b) =>
        b.score - a.score || a.country.name.localeCompare(b.country.name),
    )
    .slice(0, limit)
    .map((s) => s.country);
}

/**
 * Where a search should go without showing a list: the exact-name match, or
 * the only match. `null` means show the list.
 */
export function directHit(
  query: string,
  matches: readonly CountryRef[],
): CountryRef | null {
  if (matches.length === 1) return matches[0];
  const q = normaliseQuery(query);
  return matches.find((c) => normaliseQuery(c.name) === q) ?? null;
}
