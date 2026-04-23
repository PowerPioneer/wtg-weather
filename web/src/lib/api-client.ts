/**
 * Typed fetch wrappers for the FastAPI backend.
 *
 * - Server Components call `apiGet(path)` which talks to `INTERNAL_API_URL`
 *   (docker-network hostname, never leaves the cluster).
 * - Client Components call `publicApi<T>(path)` which hits the same host the
 *   page was served from, via the public `/api/*` proxy in Caddy.
 *
 * Both paths fall back to mock data when `USE_MOCK_DATA` is true — the web
 * scaffold must render with zero network in dev even before the API is up.
 */

import { INTERNAL_API_URL, USE_MOCK_DATA } from "./env";
import { findCountryData } from "./mock-data";
import { findRegion } from "./regions";
import type { CountryData, RegionRow, SessionUser } from "./types";

type FetchInit = Omit<RequestInit, "body"> & {
  /** Next revalidation window in seconds. Defaults to 30 days for SSR pages. */
  revalidate?: number;
};

async function serverFetch(path: string, init: FetchInit = {}): Promise<Response> {
  const { revalidate = 60 * 60 * 24 * 30, ...rest } = init;
  const url = `${INTERNAL_API_URL}${path}`;
  return fetch(url, {
    ...rest,
    next: { revalidate },
    headers: {
      accept: "application/json",
      ...(rest.headers ?? {}),
    },
  });
}

/**
 * Fetch a country payload for SSR. In dev / preview, returns mock fixtures.
 * Returns `null` if the country is unknown — callers should `notFound()`.
 */
export async function getCountry(slug: string): Promise<CountryData | null> {
  if (USE_MOCK_DATA) return findCountryData(slug);
  const res = await serverFetch(`/v1/countries/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getCountry(${slug}) failed: ${res.status}`);
  return (await res.json()) as CountryData;
}

/**
 * Fetch a region (admin-1) under a country. Mock path resolves via the country
 * fixture; real path will call `/v1/countries/:country/regions/:region` once
 * the pipeline ships per-region climatology. Returns `null` if either the
 * country or the region is unknown — callers should `notFound()`.
 */
export async function getRegion(
  countrySlug: string,
  regionSlugParam: string,
): Promise<{ country: CountryData; region: RegionRow } | null> {
  if (USE_MOCK_DATA) {
    const country = findCountryData(countrySlug);
    if (!country) return null;
    const region = findRegion(country, regionSlugParam);
    return region ? { country, region } : null;
  }
  const res = await serverFetch(
    `/v1/countries/${encodeURIComponent(countrySlug)}/regions/${encodeURIComponent(regionSlugParam)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `getRegion(${countrySlug},${regionSlugParam}) failed: ${res.status}`,
    );
  }
  return (await res.json()) as { country: CountryData; region: RegionRow };
}

/**
 * Client-side fetch against the public `/api/*` path. Unused in Phase 5.3a
 * but kept here so component authors have the one-and-only browser helper.
 */
export async function publicApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...init,
    headers: {
      accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`publicApi(${path}) failed: ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Browser-side `/api/me` fetch. Returns `null` on 401 (unauthenticated) so
 * the `useSession` hook can distinguish "not signed in" from "request failed".
 */
export async function fetchMe(): Promise<SessionUser | null> {
  const res = await fetch("/api/me", {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`fetchMe failed: ${res.status}`);
  return (await res.json()) as SessionUser;
}

export type TileTier = "free" | "premium";

export type TileUrlResponse = {
  /** The signed HTTPS URL — pass to MapLibre as `pmtiles://${url}`. */
  url: string;
  /** Unix seconds; the caller is responsible for re-requesting before this time. */
  expiresAt: number;
};

/**
 * `/api/tiles/url?tier=...` — signed, 15-minute URL for the requested PMTiles.
 *
 * Returns:
 *   - the {@link TileUrlResponse} on success (200)
 *   - `"forbidden"` when the session lacks the required entitlement (403) —
 *     callers must fall back to the free tier and surface an upgrade prompt.
 *   - throws for anything else.
 */
export async function fetchTileUrl(
  tier: TileTier,
): Promise<TileUrlResponse | "forbidden"> {
  const res = await fetch(`/api/tiles/url?tier=${tier}`, {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (res.status === 403) return "forbidden";
  if (!res.ok) throw new Error(`fetchTileUrl(${tier}) failed: ${res.status}`);
  return (await res.json()) as TileUrlResponse;
}

/**
 * Kick off a magic-link sign-in. FastAPI sends the email; the browser just
 * posts the address and redirects to `/login/sent`. Returns `"invalid"` on
 * 400 (malformed email), `"rate-limited"` on 429, throws on anything else.
 *
 * The response body is intentionally ignored — the token lives in the email,
 * not the response, so there's nothing useful to return.
 */
export type OnboardingKind = "consumer" | "agency";

export type OnboardingState = {
  kind: OnboardingKind | null;
  step: number;
  completed: boolean;
  data: Record<string, unknown>;
};

export type OnboardingPatch = Partial<{
  kind: OnboardingKind;
  step: number;
  completed: boolean;
  data: Record<string, unknown>;
}>;

export async function fetchOnboarding(): Promise<OnboardingState | null> {
  const res = await fetch("/api/onboarding", {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`fetchOnboarding failed: ${res.status}`);
  return (await res.json()) as OnboardingState;
}

export async function patchOnboarding(
  patch: OnboardingPatch,
): Promise<OnboardingState> {
  const res = await fetch("/api/onboarding", {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`patchOnboarding failed: ${res.status}`);
  return (await res.json()) as OnboardingState;
}

export async function postMagicLink(
  email: string,
): Promise<"ok" | "invalid" | "rate-limited"> {
  const res = await fetch("/api/auth/magic-link", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ email }),
  });
  if (res.ok) return "ok";
  if (res.status === 400 || res.status === 422) return "invalid";
  if (res.status === 429) return "rate-limited";
  throw new Error(`postMagicLink failed: ${res.status}`);
}
