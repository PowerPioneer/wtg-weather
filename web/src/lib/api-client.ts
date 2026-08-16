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
import type {
  AccountPlan,
  AccountRole,
  CountryData,
  RegionRow,
  SessionUser,
} from "./types";

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

// ─── Account resources: trips, favourites, alerts ────────────────────
//
// Browser-side and cookie-authenticated, which `web/CLAUDE.md` allows: "the
// user's own trips/favourites" is on the short list of things the browser may
// fetch. Everything climate-shaped still comes from the tiles or from SSR.
//
// The API speaks snake_case; these wrappers are the *only* place that knows
// it. Each response is mapped field by field rather than cast, because RC-6
// was a path/shape mismatch that fixtures hid for months — a cast would let
// `country_iso2` arrive and `countryIso2` render as undefined, indefinitely.

/** A non-OK response from the API, carrying the status the caller must branch on. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly detail?: string,
  ) {
    super(`${path} failed: ${status}${detail ? ` (${detail})` : ""}`);
    this.name = "ApiError";
  }
}

/** 401 means "sign in", not "something broke" — every account surface branches on it. */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** 404 is also how the API says "not yours": another user's trip id is not found. */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

async function accountFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const hasBody = init.body !== undefined;
  const res = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...init,
    headers: {
      accept: "application/json",
      ...(hasBody ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new ApiError(res.status, path, await readDetail(res));
  return res;
}

/** FastAPI puts its error message in `detail`; anything else is not worth guessing at. */
async function readDetail(res: Response): Promise<string | undefined> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "detail" in body) {
      const detail = (body as { detail: unknown }).detail;
      if (typeof detail === "string") return detail;
    }
  } catch {
    /* not JSON — the status is the whole story */
  }
  return undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * A saved trip, as `TripRead` returns it.
 *
 * `preferences` is `dict[str, Any]` on the API and stays a loose record here:
 * it holds a {@link WeatherPreferences} today, and a trip saved under an older
 * shape must still list and delete rather than fail to parse.
 */
export type TripRecord = {
  id: string;
  title: string;
  countryIso2: string | null;
  regionCode: string | null;
  /** 1–12, or null for a whole-year trip. */
  month: number | null;
  preferences: Record<string, unknown>;
  clientId: string | null;
};

export type TripInput = {
  title: string;
  countryIso2?: string | null;
  regionCode?: string | null;
  month?: number | null;
  preferences?: Record<string, unknown>;
  clientId?: string | null;
};

export type TripPatch = Partial<TripInput>;

function toTrip(raw: unknown): TripRecord {
  const r = record(raw);
  return {
    id: str(r.id) ?? "",
    title: str(r.title) ?? "",
    countryIso2: str(r.country_iso2),
    regionCode: str(r.region_code),
    month: num(r.month),
    preferences: record(r.preferences),
    clientId: str(r.client_id),
  };
}

/** Drop `undefined` keys so a PATCH sends only what the caller meant to change. */
function tripBody(input: TripPatch): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.title = input.title;
  if (input.countryIso2 !== undefined) body.country_iso2 = input.countryIso2;
  if (input.regionCode !== undefined) body.region_code = input.regionCode;
  if (input.month !== undefined) body.month = input.month;
  if (input.preferences !== undefined) body.preferences = input.preferences;
  if (input.clientId !== undefined) body.client_id = input.clientId;
  return body;
}

export async function listTrips(): Promise<TripRecord[]> {
  const res = await accountFetch("/trips");
  const body: unknown = await res.json();
  return Array.isArray(body) ? body.map(toTrip) : [];
}

export async function getTrip(id: string): Promise<TripRecord> {
  const res = await accountFetch(`/trips/${encodeURIComponent(id)}`);
  return toTrip(await res.json());
}

export async function createTrip(input: TripInput): Promise<TripRecord> {
  const res = await accountFetch("/trips", {
    method: "POST",
    body: JSON.stringify(tripBody(input)),
  });
  return toTrip(await res.json());
}

export async function updateTrip(id: string, patch: TripPatch): Promise<TripRecord> {
  const res = await accountFetch(`/trips/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(tripBody(patch)),
  });
  return toTrip(await res.json());
}

export async function deleteTrip(id: string): Promise<void> {
  await accountFetch(`/trips/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/**
 * Mint a share token, or return the one this trip already has. Idempotent, so
 * pressing "share" twice hands back the same link rather than invalidating the
 * one already sent.
 */
export async function shareTrip(id: string): Promise<string> {
  const res = await accountFetch(`/trips/${encodeURIComponent(id)}/share`, {
    method: "POST",
  });
  const body = (await res.json()) as { share_token?: unknown };
  const token = str(body.share_token);
  if (!token) throw new ApiError(500, `/trips/${id}/share`, "no token returned");
  return token;
}

/** Revoke the share link. The existing URL 404s from here on. */
export async function unshareTrip(id: string): Promise<void> {
  await accountFetch(`/trips/${encodeURIComponent(id)}/share`, { method: "DELETE" });
}

export type FavouriteRecord = {
  id: string;
  countryIso2: string;
  regionCode: string | null;
};

function toFavourite(raw: unknown): FavouriteRecord {
  const r = record(raw);
  return {
    id: str(r.id) ?? "",
    countryIso2: str(r.country_iso2) ?? "",
    regionCode: str(r.region_code),
  };
}

export async function listFavourites(): Promise<FavouriteRecord[]> {
  const res = await accountFetch("/favourites");
  const body: unknown = await res.json();
  return Array.isArray(body) ? body.map(toFavourite) : [];
}

export async function createFavourite(input: {
  countryIso2: string;
  regionCode?: string | null;
}): Promise<FavouriteRecord> {
  const res = await accountFetch("/favourites", {
    method: "POST",
    body: JSON.stringify({
      country_iso2: input.countryIso2,
      region_code: input.regionCode ?? null,
    }),
  });
  return toFavourite(await res.json());
}

export async function deleteFavourite(id: string): Promise<void> {
  await accountFetch(`/favourites/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export type AlertRecord = {
  id: string;
  countryIso2: string | null;
  regionCode: string | null;
  month: number | null;
  preferences: Record<string, unknown>;
  active: boolean;
};

function toAlert(raw: unknown): AlertRecord {
  const r = record(raw);
  return {
    id: str(r.id) ?? "",
    countryIso2: str(r.country_iso2),
    regionCode: str(r.region_code),
    month: num(r.month),
    preferences: record(r.preferences),
    // Absent means active: `AlertRead.active` is non-optional on the API, so a
    // missing value is a bug rather than an off switch, and silently showing
    // an alert as off is the more confusing failure.
    active: r.active !== false,
  };
}

export async function listAlerts(): Promise<AlertRecord[]> {
  const res = await accountFetch("/alerts");
  const body: unknown = await res.json();
  return Array.isArray(body) ? body.map(toAlert) : [];
}

export async function createAlert(input: {
  countryIso2?: string | null;
  regionCode?: string | null;
  month?: number | null;
  preferences?: Record<string, unknown>;
}): Promise<AlertRecord> {
  const res = await accountFetch("/alerts", {
    method: "POST",
    body: JSON.stringify({
      country_iso2: input.countryIso2 ?? null,
      region_code: input.regionCode ?? null,
      month: input.month ?? null,
      preferences: input.preferences ?? {},
    }),
  });
  return toAlert(await res.json());
}

export async function setAlertActive(id: string, active: boolean): Promise<AlertRecord> {
  const res = await accountFetch(`/alerts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
  return toAlert(await res.json());
}

export async function deleteAlert(id: string): Promise<void> {
  await accountFetch(`/alerts/${encodeURIComponent(id)}`, { method: "DELETE" });
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


// ─── Agency: orgs, seats, invitations, clients ───────────────────────
//
// Browser-side and cookie-authenticated. These are the *mutations* — the
// dashboard's lists are read server-side in `lib/agency-server.ts` so the page
// paints without JS, and these run behind the buttons that change them.
//
// Same discipline as the account resources above: the API speaks snake_case
// and this file is the only place that knows it, and every response is mapped
// field by field rather than cast.

/** 409 is a *state*, not a breakage: at the cap, already invited, already a member. */
export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

/**
 * The API's detail strings for the three conflicts an invite can hit. Matched
 * rather than guessed at, because they mean different things to the person
 * pressing the button: one of them is an upgrade prompt and the other two are
 * corrections.
 */
export const SEAT_CAP_DETAIL = "seat cap reached";
export const ALREADY_MEMBER_DETAIL = "already a member";
export const ALREADY_INVITED_DETAIL = "invitation already pending";

/** True when a refusal is "you are out of seats", which the UI answers with the upgrade path. */
export function isSeatCapReached(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.detail === SEAT_CAP_DETAIL
  );
}

export type OrgRecord = {
  id: string;
  name: string;
  plan: AccountPlan;
  seatCap: number;
  seatsUsed: number;
  seatsPending: number;
};

function toOrg(raw: unknown): OrgRecord {
  const r = record(raw);
  const plans: readonly AccountPlan[] = [
    "free",
    "consumer_premium",
    "agency_starter",
    "agency_pro",
    "agency_enterprise",
  ];
  return {
    id: str(r.id) ?? "",
    name: str(r.name) ?? "",
    // Same rule as `session-user.ts`: an unrecognised plan is free, never the
    // other way round.
    plan: plans.find((p) => p === r.plan) ?? "free",
    seatCap: num(r.seat_cap) ?? 0,
    seatsUsed: num(r.seats_used) ?? 0,
    seatsPending: num(r.seats_pending) ?? 0,
  };
}

/**
 * Create the organization the agency wizard collects a name for.
 *
 * It starts on the free plan with one seat — the caller's. The plan moves only
 * when a signature-verified Paddle webhook says so, which is why checkout is
 * the wizard's next step and not something this call can shortcut.
 */
export async function createOrg(name: string): Promise<OrgRecord> {
  const res = await accountFetch("/orgs", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return toOrg(await res.json());
}

export async function getOrg(orgId: string): Promise<OrgRecord> {
  const res = await accountFetch(`/orgs/${encodeURIComponent(orgId)}`);
  return toOrg(await res.json());
}

export type InviteRecord = {
  id: string;
  email: string;
  role: AccountRole;
  expiresAt: string | null;
  invitedAt: string | null;
};

const ROLE_VALUES: readonly AccountRole[] = ["owner", "admin", "agent", "member"];

function toInvite(raw: unknown): InviteRecord {
  const r = record(raw);
  return {
    id: str(r.id) ?? "",
    email: str(r.email) ?? "",
    role: ROLE_VALUES.find((v) => v === r.role) ?? "member",
    expiresAt: str(r.expires_at),
    invitedAt: str(r.created_at),
  };
}

/**
 * Offer a seat. The token goes to the invitee's mailbox and is never returned
 * here — an owner who could read it could spend it, or hand it to somebody the
 * invitation was not addressed to, which is the whole check.
 *
 * Throws `ApiError` 409 for the three refusals; use {@link isSeatCapReached} to
 * tell the upgrade path apart from a correction.
 */
export async function inviteAgent(
  orgId: string,
  input: { email: string; role?: AccountRole },
): Promise<InviteRecord> {
  const res = await accountFetch(`/orgs/${encodeURIComponent(orgId)}/invites`, {
    method: "POST",
    body: JSON.stringify({ email: input.email, role: input.role ?? "agent" }),
  });
  return toInvite(await res.json());
}

export async function revokeInvite(orgId: string, inviteId: string): Promise<void> {
  await accountFetch(
    `/orgs/${encodeURIComponent(orgId)}/invites/${encodeURIComponent(inviteId)}`,
    { method: "DELETE" },
  );
}

/** Remove a member. The API refuses for the owner's own membership (400). */
export async function removeMember(
  orgId: string,
  membershipId: string,
): Promise<void> {
  await accountFetch(
    `/orgs/${encodeURIComponent(orgId)}/memberships/${encodeURIComponent(membershipId)}`,
    { method: "DELETE" },
  );
}

export type ClientRecordSummary = {
  id: string;
  name: string;
  email: string | null;
  notes: string | null;
  trips: number;
  createdAt: string | null;
};

function toClient(raw: unknown): ClientRecordSummary {
  const r = record(raw);
  return {
    id: str(r.id) ?? "",
    name: str(r.name) ?? "",
    email: str(r.email),
    notes: str(r.notes),
    trips: num(r.trip_count) ?? 0,
    createdAt: str(r.created_at),
  };
}

export async function listClients(orgId: string): Promise<ClientRecordSummary[]> {
  const res = await accountFetch(`/orgs/${encodeURIComponent(orgId)}/clients`);
  const body: unknown = await res.json();
  return Array.isArray(body) ? body.map(toClient) : [];
}

export async function createClient(
  orgId: string,
  input: { name: string; email?: string | null; notes?: string | null },
): Promise<ClientRecordSummary> {
  const res = await accountFetch(`/orgs/${encodeURIComponent(orgId)}/clients`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      email: input.email || null,
      notes: input.notes || null,
    }),
  });
  return toClient(await res.json());
}

export async function updateClient(
  orgId: string,
  clientId: string,
  patch: { name?: string; email?: string | null; notes?: string | null },
): Promise<ClientRecordSummary> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.email !== undefined) body.email = patch.email || null;
  if (patch.notes !== undefined) body.notes = patch.notes || null;
  const res = await accountFetch(
    `/orgs/${encodeURIComponent(orgId)}/clients/${encodeURIComponent(clientId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  return toClient(await res.json());
}

/** Deleting a client unassigns its trips; it does not delete an agent's work. */
export async function deleteClient(orgId: string, clientId: string): Promise<void> {
  await accountFetch(
    `/orgs/${encodeURIComponent(orgId)}/clients/${encodeURIComponent(clientId)}`,
    { method: "DELETE" },
  );
}

export type ClientNoteRecord = {
  id: string;
  body: string;
  author: string | null;
  createdAt: string;
};

function toClientNote(raw: unknown): ClientNoteRecord {
  const r = record(raw);
  return {
    id: str(r.id) ?? "",
    body: str(r.body) ?? "",
    author: str(r.author_name) ?? str(r.author_email),
    createdAt: str(r.created_at) ?? "",
  };
}

export async function addClientNote(
  orgId: string,
  clientId: string,
  body: string,
): Promise<ClientNoteRecord> {
  const res = await accountFetch(
    `/orgs/${encodeURIComponent(orgId)}/clients/${encodeURIComponent(clientId)}/notes`,
    { method: "POST", body: JSON.stringify({ body }) },
  );
  return toClientNote(await res.json());
}

export async function deleteClientNote(
  orgId: string,
  clientId: string,
  noteId: string,
): Promise<void> {
  await accountFetch(
    `/orgs/${encodeURIComponent(orgId)}/clients/${encodeURIComponent(clientId)}/notes/${encodeURIComponent(noteId)}`,
    { method: "DELETE" },
  );
}

export type AcceptedInvite = {
  organizationId: string;
  organizationName: string;
  role: AccountRole;
};

/**
 * Spend an invitation token.
 *
 * This is an authentication call: on success the API sets a session cookie for
 * the address the invitation was mailed to — not for whoever happens to be
 * signed in — so the caller is the invitee from here on. Refusals are
 * meaningful and distinct: 404 (unknown, forged or revoked), 409 (already
 * used, or the org has run out of seats since), 400 (expired).
 */
export async function acceptInvite(token: string): Promise<AcceptedInvite> {
  const res = await accountFetch("/invites/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  const r = record(await res.json());
  return {
    organizationId: str(r.organization_id) ?? "",
    organizationName: str(r.organization_name) ?? "",
    role: ROLE_VALUES.find((v) => v === r.role) ?? "member",
  };
}
