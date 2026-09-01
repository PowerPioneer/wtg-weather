/**
 * `/account`'s data, read server-side.
 *
 * The page rendered `lib/mock-data.ts` unconditionally: every signed-in user
 * whose id matched no fixture — which is all of them — got
 * `EMPTY_CONSUMER_ACCOUNT`, so the account surface was an empty state with
 * good manners. The trips / favourites / alerts routers have existed and been
 * tested the whole time; nothing called them.
 *
 * Read here rather than in the browser because the lists are the page: an RSC
 * read keeps `/account` rendering with zero client JS, and the mutations
 * (WS-A.5, WS-A.6) are the parts that become islands.
 *
 * The API speaks in ISO-2 codes and month numbers. Turning those into names,
 * scores and "3 regions match" needs the published country payload, so each
 * distinct country referenced by the user's rows is fetched once and shared
 * across all three lists.
 */

import "server-only";
import { cookies } from "next/headers";

import { getCountry } from "./api-client";
import { findCountryByIso2 } from "./countries";
import { monthScore } from "./country-derive";
import { INTERNAL_API_URL, USE_MOCK_DATA } from "./env";
import { MONTH_NAMES, MONTH_SLUGS } from "./months";
import { regionMonthScore } from "./regions";
import {
  DEFAULT_PREFERENCES,
  SAFETY_LIMIT_LABEL,
  clampSafetyMax,
  parseWeatherPreferences,
  rainLevelForCeiling,
  type WeatherPreferences,
} from "./scoring";
import type {
  AccountAlert,
  AccountFavourite,
  AccountTrip,
  ConsumerAccount,
  CountryData,
} from "./types";

const SESSION_COOKIE = "wtg_session";

/** A region counts as "matching" at the same threshold the legend calls Good. */
const MATCH_THRESHOLD = 70;

type RawTrip = {
  id: string;
  title: string;
  country_iso2: string | null;
  region_code: string | null;
  month: number | null;
  preferences: Record<string, unknown>;
};

type RawFavourite = {
  id: string;
  country_iso2: string;
  region_code: string | null;
};

type RawAlert = {
  id: string;
  country_iso2: string | null;
  region_code: string | null;
  month: number | null;
  preferences: Record<string, unknown>;
  active: boolean;
};

/**
 * GET one of the user's collections, forwarding their session cookie to the
 * internal API. Returns `null` when there is no session or the API refuses it
 * — the caller redirects rather than rendering someone else's empty account.
 */
async function getOwn<T>(path: string): Promise<T[] | null> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return null;

  const res = await fetch(`${INTERNAL_API_URL}${path}`, {
    headers: {
      accept: "application/json",
      cookie: `${SESSION_COOKIE}=${session}`,
    },
    // Per-user data. Caching it would be caching one user's trips for the next.
    cache: "no-store",
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  const body: unknown = await res.json();
  return Array.isArray(body) ? (body as T[]) : [];
}

/** Fetch each referenced country once; a 404 or a failure is simply absent. */
async function loadCountries(
  iso2s: Iterable<string>,
): Promise<Map<string, CountryData>> {
  const slugs = new Map<string, string>();
  for (const iso2 of iso2s) {
    const ref = findCountryByIso2(iso2);
    if (ref) slugs.set(iso2.toUpperCase(), ref.slug);
  }
  const loaded = await Promise.all(
    [...slugs].map(async ([iso2, slug]) => {
      const data = await getCountry(slug).catch(() => null);
      return data ? ([iso2, data] as const) : null;
    }),
  );
  return new Map(loaded.filter((x): x is readonly [string, CountryData] => x !== null));
}

function prefsOf(raw: Record<string, unknown>): WeatherPreferences {
  return parseWeatherPreferences(raw) ?? DEFAULT_PREFERENCES;
}

/**
 * How many of a country's admin-1 rows clear the match threshold that month.
 * Through `regionMonthScore` so this number agrees with the region cards on
 * the country page — it falls back to the country series for a region the
 * pipeline has no rainfall or sunshine for, rather than scoring it on
 * temperature alone.
 */
function matchingRegions(
  country: CountryData,
  monthIdx: number,
  prefs: WeatherPreferences,
): number {
  return country.regions.filter((region) => {
    const score = regionMonthScore(country, region, monthIdx, prefs);
    return score !== null && score >= MATCH_THRESHOLD;
  }).length;
}

function toTrip(raw: RawTrip, countries: Map<string, CountryData>): AccountTrip {
  const iso2 = raw.country_iso2?.toUpperCase() ?? null;
  const ref = iso2 ? findCountryByIso2(iso2) : undefined;
  const country = iso2 ? countries.get(iso2) : undefined;
  const monthIdx = raw.month === null ? null : raw.month - 1;
  const prefs = prefsOf(raw.preferences);

  return {
    id: raw.id,
    title: raw.title,
    countryName: ref?.name ?? null,
    countrySlug: ref?.slug ?? null,
    monthName: monthIdx === null ? null : MONTH_NAMES[MONTH_SLUGS[monthIdx]!],
    monthSlug: monthIdx === null ? null : MONTH_SLUGS[monthIdx]!,
    // Null rather than 0 where we cannot say: an unpublished country, or a
    // whole-year trip with no month to score. Zero is a claim about the
    // weather; absence is a claim about our data.
    score: country && monthIdx !== null ? monthScore(country, monthIdx, prefs) : null,
    matchingRegions:
      country && monthIdx !== null ? matchingRegions(country, monthIdx, prefs) : null,
  };
}

function toFavourite(
  raw: RawFavourite,
  countries: Map<string, CountryData>,
): AccountFavourite {
  const iso2 = raw.country_iso2.toUpperCase();
  const ref = findCountryByIso2(iso2);
  const country = countries.get(iso2);
  const region = raw.region_code
    ? country?.regions.find((r) => r.code === raw.region_code)
    : undefined;

  return {
    id: raw.id,
    name: region?.name ?? ref?.name ?? iso2,
    // A favourited region links to its own page; a favourited country to its.
    href: ref
      ? region?.slug
        ? `/${ref.slug}/${region.slug}`
        : `/${ref.slug}`
      : null,
    sub: region ? (ref?.name ?? iso2) : (ref ? country?.region ?? "" : ""),
    // The pipeline's own top-three, not a number we recomputed — the country
    // page prints the same list.
    best: country?.bestMonths.slice(0, 2).map((m) => m.month).join(" · ") || null,
  };
}

function toAlert(raw: RawAlert, countries: Map<string, CountryData>): AccountAlert {
  const iso2 = raw.country_iso2?.toUpperCase() ?? null;
  const ref = iso2 ? findCountryByIso2(iso2) : undefined;
  const country = iso2 ? countries.get(iso2) : undefined;
  const region = raw.region_code
    ? country?.regions.find((r) => r.code === raw.region_code)
    : undefined;
  const monthIdx = raw.month === null ? null : raw.month - 1;
  const monthName = monthIdx === null ? null : MONTH_NAMES[MONTH_SLUGS[monthIdx]!];
  const where = region?.name ?? ref?.name ?? "Anywhere";
  const prefs = prefsOf(raw.preferences);

  return {
    id: raw.id,
    // Assembled from the alert's own fields, so it always describes what the
    // job will actually check. A stored label would drift the moment the
    // definition changed.
    label: monthName ? `${where} in ${monthName}` : where,
    // Metric on purpose: this string is assembled on the server, and the
    // visitor's unit is only known in the browser. Rainfall reads as its level
    // rather than its ceiling, which is the vocabulary the control now uses.
    conditions: [
      `days ${prefs.dayMin}–${prefs.dayMax} °C`,
      `nights ${prefs.nightMin}–${prefs.nightMax} °C`,
      `${rainLevelForCeiling(prefs.rainMax).label.toLowerCase()} or drier`,
      `over ${prefs.sunMin} h sun`,
      `advisories to ${SAFETY_LIMIT_LABEL[clampSafetyMax(prefs.safetyMax)].toLowerCase()}`,
    ].join(" · "),
    active: raw.active,
  };
}

export const EMPTY_ACCOUNT: ConsumerAccount = {
  trips: [],
  favourites: [],
  alerts: [],
};

/**
 * The signed-in user's trips, favourites and alerts.
 *
 * Returns `null` when the API rejects the session, which the page turns into a
 * redirect to sign-in. Every other failure throws — an account page that
 * silently renders "no trips" to someone who has three is worse than an error.
 */
export async function getConsumerAccount(): Promise<ConsumerAccount | null> {
  if (USE_MOCK_DATA) return EMPTY_ACCOUNT;

  const [trips, favourites, alerts] = await Promise.all([
    getOwn<RawTrip>("/api/trips"),
    getOwn<RawFavourite>("/api/favourites"),
    getOwn<RawAlert>("/api/alerts"),
  ]);
  if (trips === null || favourites === null || alerts === null) return null;

  const iso2s = new Set<string>();
  for (const t of trips) if (t.country_iso2) iso2s.add(t.country_iso2.toUpperCase());
  for (const f of favourites) iso2s.add(f.country_iso2.toUpperCase());
  for (const a of alerts) if (a.country_iso2) iso2s.add(a.country_iso2.toUpperCase());
  const countries = await loadCountries(iso2s);

  return {
    trips: trips.map((t) => toTrip(t, countries)),
    favourites: favourites.map((f) => toFavourite(f, countries)),
    alerts: alerts.map((a) => toAlert(a, countries)),
  };
}
