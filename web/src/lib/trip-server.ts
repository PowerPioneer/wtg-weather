/**
 * `/trip/[id]` and `/trip/share/[token]`, read server-side.
 *
 * The page called `findTripData(id)` — one hard-coded honeymoon in Peru,
 * belonging to a fixture user. Every real trip 404'd and the fixture one was
 * reachable by anybody, signed in or not.
 *
 * There are two readers here and they are not the same request:
 *
 *   - {@link getOwnTrip} forwards the session cookie to the owner-scoped
 *     `GET /api/trips/{id}`, which answers 404 — not 403 — for a trip the
 *     caller does not own.
 *   - {@link getSharedTrip} calls `GET /api/trips/shared/{token}`, which needs
 *     no session because the token *is* the grant. Its payload is narrower by
 *     design: no trip id, no client id.
 *
 * Both then assemble the same view, because the difference between the owner's
 * page and the public one is the controls around it, not the climate in it.
 */

import "server-only";
import { cookies } from "next/headers";

import { getCountry } from "./api-client";
import { findCountryByIso2 } from "./countries";
import { monthScore } from "./country-derive";
import { INTERNAL_API_URL } from "./env";
import { MONTH_NAMES, MONTH_SLUGS, type MonthSlug } from "./months";
import { findRegionByCode, regionHref, regionMonthScore } from "./regions";
import {
  DEFAULT_PREFERENCES,
  isDefaultPreferences,
  parseWeatherPreferences,
  type WeatherPreferences,
} from "./scoring";
import type { CountryData, RegionRow } from "./types";

const SESSION_COOKIE = "wtg_session";

/** How many ranked regions the trip page lists. */
const DESTINATION_COUNT = 10;

export type TripDestinationRow = {
  rank: number;
  name: string;
  /** Region page, or null where the country has no published page. */
  href: string | null;
  score: number;
  /** Formatted for the trip's month. Empty string where the series is absent. */
  temp: string;
  rain: string;
  sun: string;
};

export type TripView = {
  /** Null on the shared view: the public payload carries no id, deliberately. */
  id: string | null;
  title: string;
  countryName: string | null;
  countrySlug: string | null;
  /** Set when the trip names one region rather than a whole country. */
  regionName: string | null;
  monthName: string | null;
  monthSlug: MonthSlug | null;
  /** The trip's own score for its month, or null when it has no month. */
  score: number | null;
  preferences: WeatherPreferences;
  /** Whether those are the pipeline's defaults — the page says which. */
  usesDefaultPreferences: boolean;
  destinations: readonly TripDestinationRow[];
  /** Owner view only: null until the trip is shared. */
  shareToken: string | null;
  /**
   * The agency client this trip is filed against, if any. Owner view only —
   * `TripPublicRead` deliberately omits it, because which of an agency's
   * clients a trip was built for is the agency's business and not the
   * recipient's.
   */
  clientId: string | null;
};

type RawTrip = {
  id?: string;
  title?: string;
  country_iso2?: string | null;
  region_code?: string | null;
  month?: number | null;
  preferences?: Record<string, unknown>;
  share_token?: string | null;
  client_id?: string | null;
};

function fmt(value: number | undefined, unit: string): string {
  return value === undefined || !Number.isFinite(value)
    ? ""
    : `${Math.round(value * 10) / 10} ${unit}`;
}

/**
 * The country's admin-1 rows, ranked for the trip's month under the trip's
 * preferences. This is the trip: a saved question ("Peru, April, this kind of
 * weather") re-answered against whatever the pipeline published last, which is
 * why it is computed here rather than stored at save time.
 */
function rankDestinations(
  country: CountryData,
  monthIdx: number,
  prefs: WeatherPreferences,
  hasCountryPage: boolean,
): TripDestinationRow[] {
  return country.regions
    .map((region: RegionRow) => ({
      region,
      score: regionMonthScore(country, region, monthIdx, prefs),
    }))
    .filter((r): r is { region: RegionRow; score: number } => r.score !== null)
    // Ties are the common case — the rule buckets rather than grades — so the
    // name breaks them and the order is stable between renders.
    .sort((a, b) => b.score - a.score || a.region.name.localeCompare(b.region.name))
    .slice(0, DESTINATION_COUNT)
    .map((r, i) => ({
      rank: i + 1,
      name: r.region.name,
      href:
        hasCountryPage && country.slug
          ? `/${country.slug}/${regionHref(r.region)}`
          : null,
      score: r.score,
      temp: fmt(r.region.tl[monthIdx], "°C"),
      rain: fmt(r.region.rl?.[monthIdx] ?? country.climate.rDay[monthIdx], "mm/day"),
      sun: fmt(r.region.sl?.[monthIdx] ?? country.climate.s[monthIdx], "hr/day"),
    }));
}

async function assemble(raw: RawTrip): Promise<TripView> {
  const iso2 = raw.country_iso2?.toUpperCase() ?? null;
  const ref = iso2 ? findCountryByIso2(iso2) : undefined;
  const country = ref ? await getCountry(ref.slug).catch(() => null) : null;

  const monthIdx = raw.month == null ? null : raw.month - 1;
  const prefs = parseWeatherPreferences(raw.preferences) ?? DEFAULT_PREFERENCES;
  const region =
    country && raw.region_code ? findRegionByCode(country, raw.region_code) : null;

  // A trip that names a region is scored on that region; one that names only a
  // country is scored nationally. Both go through the rule the map paints
  // with, so the number here is the colour the user clicked on.
  const score =
    country && monthIdx !== null
      ? region
        ? regionMonthScore(country, region, monthIdx, prefs)
        : monthScore(country, monthIdx, prefs)
      : null;

  return {
    id: raw.id ?? null,
    title: raw.title ?? "Untitled trip",
    countryName: ref?.name ?? null,
    // Only link where the country actually has a published page — the registry
    // covers every polygon, the page tree does not.
    countrySlug: country ? ref?.slug ?? null : null,
    regionName: region?.name ?? null,
    monthName: monthIdx === null ? null : MONTH_NAMES[MONTH_SLUGS[monthIdx]!],
    monthSlug: monthIdx === null ? null : MONTH_SLUGS[monthIdx]!,
    score,
    preferences: prefs,
    usesDefaultPreferences: isDefaultPreferences(prefs),
    destinations:
      country && monthIdx !== null
        ? rankDestinations(country, monthIdx, prefs, Boolean(ref))
        : [],
    shareToken: raw.share_token ?? null,
    clientId: raw.client_id ?? null,
  };
}

/** One-line summary for `<meta description>` and the OG card. */
export function describeTrip(trip: TripView): string {
  const where = [trip.regionName, trip.countryName].filter(Boolean).join(", ");
  const parts = [where || "Climate-matched trip", trip.monthName].filter(Boolean);
  const ranked =
    trip.destinations.length > 0
      ? ` ${trip.destinations.length} regions ranked by weather fit.`
      : "";
  return `${parts.join(" · ")}.${ranked}`;
}

async function fetchJson(path: string, cookie?: string): Promise<unknown | null> {
  const res = await fetch(`${INTERNAL_API_URL}${path}`, {
    headers: {
      accept: "application/json",
      ...(cookie ? { cookie } : {}),
    },
    cache: "no-store",
  });
  // 404 covers both "no such trip" and "not yours" — the API does not
  // distinguish them, and neither should the page.
  if (res.status === 404 || res.status === 401) return null;
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

/** The caller's own trip. Null when there is no session, or it isn't theirs. */
export async function getOwnTrip(id: string): Promise<TripView | null> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return null;
  const raw = await fetchJson(
    `/api/trips/${encodeURIComponent(id)}`,
    `${SESSION_COOKIE}=${session}`,
  );
  return raw ? assemble(raw as RawTrip) : null;
}

/** A shared trip, by its token. No session involved — the token is the grant. */
export async function getSharedTrip(token: string): Promise<TripView | null> {
  const raw = await fetchJson(`/api/trips/shared/${encodeURIComponent(token)}`);
  return raw ? assemble(raw as RawTrip) : null;
}
