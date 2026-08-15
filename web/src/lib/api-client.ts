/**
 * Typed fetch wrappers for the FastAPI backend.
 *
 * - Server Components call `apiGet(path)` which talks to `INTERNAL_API_URL`
 *   (docker-network hostname, never leaves the cluster).
 * - Client Components call `publicApi<T>(path)` which hits the same host the
 *   page was served from, via the public `/api/*` proxy in Caddy.
 *
 * The SSR data path (`getCountryIndex` / `getCountry` / `getRegion`) falls back
 * to the fixtures when `USE_MOCK_DATA` is set, so `pnpm dev` renders the page
 * tree with no API running. That flag is opt-in — see `env.ts` for why it used
 * to be the other way round and what it cost.
 */

import { INTERNAL_API_URL, USE_MOCK_DATA } from "./env";
import type { CountryRef } from "./countries";
import { findCountryData, mockCountryRefs } from "./mock-data";
import { findRegion } from "./regions";
import { parseSessionUser } from "./session-user";
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
 * Every country the pipeline has published a payload for.
 *
 * This is the route manifest, not a convenience: `/[country]` sets
 * `dynamicParams = false`, so a slug that `generateStaticParams` emits and the
 * API cannot answer for becomes a 404 page baked into the build, plus a line
 * in the sitemap advertising it. Generating from this list instead of from the
 * country registry makes the two sets identical by construction.
 *
 * Throws rather than degrading: an empty list here is a site with no country
 * pages at all, which is not something a build should complete quietly.
 */
export async function getCountryIndex(): Promise<readonly CountryRef[]> {
  if (USE_MOCK_DATA) return mockCountryRefs();
  const res = await serverFetch("/v1/countries", { revalidate: 60 * 60 });
  if (!res.ok) {
    throw new Error(
      `getCountryIndex failed: ${res.status}. The API serves this from the ` +
        `pipeline's \`wtg publish api-data\` bundle; check that it is mounted.`,
    );
  }
  return (await res.json()) as readonly CountryRef[];
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
 * Fetch a region (admin-1) under a country. The mock path resolves via the
 * country fixture. Returns `null` if either the country or the region is
 * unknown — callers should `notFound()`.
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
 *
 * Parsed, not cast: this is the one payload whose shape decides what the UI
 * unlocks, and a cast would let a malformed body through as a `SessionUser`
 * whose `plan` is `undefined`.
 */
export async function fetchMe(): Promise<SessionUser | null> {
  const res = await fetch("/api/me", {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`fetchMe failed: ${res.status}`);
  return parseSessionUser(await res.json());
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
 *   - `"forbidden"` when the request is refused for want of a session or an
 *     entitlement — 401 (not signed in) and 403 (signed in, not entitled) are
 *     the same thing to the caller: fall back to the free tier and surface an
 *     upgrade prompt.
 *   - throws for anything else.
 *
 * Treating 401 as fatal took the whole map down: an anonymous visitor was
 * asking for premium tiles, the API correctly answered 401, and the thrown
 * error blanked a map whose free tiles had already loaded fine.
 */
export async function fetchTileUrl(
  tier: TileTier,
): Promise<TileUrlResponse | "forbidden"> {
  const res = await fetch(`/api/tiles/url?tier=${tier}`, {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (res.status === 401 || res.status === 403) return "forbidden";
  if (!res.ok) throw new Error(`fetchTileUrl(${tier}) failed: ${res.status}`);
  const raw = (await res.json()) as { url: string; expires_at: number };
  return { url: raw.url, expiresAt: raw.expires_at };
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
