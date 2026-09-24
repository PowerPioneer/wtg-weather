/**
 * Reading `/compare`'s query string. Pure, so the page stays thin and the
 * parsing is tested without rendering anything.
 *
 * The form is a plain GET with text inputs (typeahead is the header's
 * `<datalist>`), so `a` and `b` arrive as whatever the traveller typed — a
 * name, a slug, or a fragment. Each is resolved against the routable set: a
 * slug exactly, otherwise through the same search the header uses, and only
 * when that search is unambiguous. A guess would compare the wrong country.
 */

import type { CountryRef } from "./countries";
import { directHit, searchCountries } from "./country-search";
import { MONTH_SLUGS, isMonthSlug, monthIndex, type MonthSlug } from "./months";

export type CompareParams = {
  a: CountryRef | null;
  b: CountryRef | null;
  /** What was typed, echoed back into the form when it did not resolve. */
  aQuery: string;
  bQuery: string;
  month: MonthSlug;
  monthIdx: number;
};

type Raw = string | string[] | undefined;

function first(value: Raw): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function resolveCountry(
  query: string,
  countries: readonly CountryRef[],
): CountryRef | null {
  if (!query) return null;
  const bySlug = countries.find((c) => c.slug === query.toLowerCase());
  if (bySlug) return bySlug;
  return directHit(query, searchCountries(query, countries));
}

export function parseCompareParams(
  params: { a?: Raw; b?: Raw; month?: Raw },
  countries: readonly CountryRef[],
  now: Date = new Date(),
): CompareParams {
  const aQuery = first(params.a);
  const bQuery = first(params.b);
  const rawMonth = first(params.month).toLowerCase();
  // Default to the current month: "where is better right now" is the
  // question most people arrive with.
  const month = isMonthSlug(rawMonth) ? rawMonth : MONTH_SLUGS[now.getUTCMonth()];
  return {
    a: resolveCountry(aQuery, countries),
    b: resolveCountry(bQuery, countries),
    aQuery,
    bQuery,
    month,
    monthIdx: monthIndex(month),
  };
}
