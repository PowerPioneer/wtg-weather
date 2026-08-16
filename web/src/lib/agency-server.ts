/**
 * The agency surfaces' data, read server-side from `/api/orgs/*`.
 *
 * These were fixture-backed until WS-C. What they replace is worth restating,
 * because the shape of this module is a reaction to it: `/account/clients/[id]`
 * resolved its client from the *URL* through `findClientRecord`, keyed by
 * nothing but the id — so any agency-entitled user could open
 * `/account/clients/cli_westfield_8421` and read a fabricated client's name,
 * email, phone and advisor notes.
 *
 * The rule that replaces it: **every read here is scoped by the caller's org
 * and carries the caller's session cookie**, so the API decides. A client id
 * belonging to another agency answers 404 there and `null` here — the id is
 * not the grant, the membership is.
 *
 * Read on the server rather than in the browser because these lists *are* the
 * page: the dashboard and the client record paint in the first response and
 * stay readable with JS off. The mutations (invite, revoke, create client, add
 * note) are the islands.
 */

import "server-only";
import { cookies } from "next/headers";

import { findCountryByIso2 } from "./countries";
import { INTERNAL_API_URL, USE_MOCK_DATA } from "./env";
import { MONTH_NAMES, MONTH_SLUGS } from "./months";
import type {
  AccountRole,
  AgencyAccount,
  ClientNote,
  ClientRecord,
  ClientSummary,
  ClientTrip,
  PendingInvite,
  TeamMember,
} from "./types";

const SESSION_COOKIE = "wtg_session";

/**
 * An agency with no data yet — and, with `WTG_USE_MOCK_DATA` set, the whole of
 * what the fixture path offers. The agency fixtures are gone rather than
 * ported: they described a shape the API cannot answer for (an activity feed,
 * invoices, per-agent trip counts), so keeping them would have meant
 * maintaining a second view model whose only job was to look convincing.
 */
export const EMPTY_AGENCY_ACCOUNT: AgencyAccount = {
  team: [],
  invites: [],
  clients: [],
  seatsUsed: 0,
  seatsPending: 0,
  seatCap: 0,
};

const ROLES: readonly AccountRole[] = ["owner", "admin", "agent", "member"];

function asRole(value: unknown): AccountRole {
  return ROLES.find((r) => r === value) ?? "member";
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * GET an org-scoped resource with the caller's session attached.
 *
 * `null` covers every refusal the pages care about: no session, a rejected
 * one, or a resource the caller is not a member of (the API answers 404 for
 * both "gone" and "not yours", deliberately). Callers turn that into a
 * redirect or a `notFound()`; nothing here invents an empty result to paper
 * over an authorisation failure.
 */
async function orgGet<T>(path: string): Promise<T | null> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return null;

  const res = await fetch(`${INTERNAL_API_URL}${path}`, {
    headers: {
      accept: "application/json",
      cookie: `${SESSION_COOKIE}=${session}`,
    },
    // Per-user, per-org. Caching it would be caching one agency's clients for
    // the next request, which may be another agency's.
    cache: "no-store",
  }).catch(() => null);

  if (!res) return null;
  if (res.status === 401 || res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

type RawMember = {
  id: string;
  user_id: string;
  role: string;
  email: string;
  name: string | null;
  created_at: string;
};

type RawInvite = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
};

type RawClient = {
  id: string;
  name: string;
  email: string | null;
  notes: string | null;
  trip_count: number;
  created_at: string | null;
};

type RawOrg = {
  id: string;
  name: string;
  plan: string;
  seat_cap: number;
  seats_used: number;
  seats_pending: number;
};

type RawClientTrip = {
  id: string;
  title: string;
  country_iso2: string | null;
  month: number | null;
  owner_name: string | null;
  owner_email: string;
  shared: boolean;
  updated_at: string;
};

type RawNote = {
  id: string;
  body: string;
  author_name: string | null;
  author_email: string | null;
  created_at: string;
};

function toMember(raw: RawMember, meId: string | null): TeamMember {
  return {
    id: raw.id,
    userId: raw.user_id,
    name: str(raw.name),
    email: raw.email,
    role: asRole(raw.role),
    joinedAt: str(raw.created_at),
    you: raw.user_id === meId,
  };
}

function toInvite(raw: RawInvite): PendingInvite {
  return {
    id: raw.id,
    email: raw.email,
    role: asRole(raw.role),
    expiresAt: str(raw.expires_at),
    invitedAt: str(raw.created_at),
  };
}

function toClientSummary(raw: RawClient): ClientSummary {
  return {
    id: raw.id,
    name: raw.name,
    email: str(raw.email),
    trips: num(raw.trip_count),
    createdAt: str(raw.created_at),
  };
}

/**
 * The org's dashboard: members, open invitations, clients, seat usage.
 *
 * Never null for a member of the org — an agency with no clients yet is an
 * empty dashboard, not an error. Null means the API refused the read, which
 * the page turns into a redirect: rendering an empty team to somebody whose
 * session just expired would be a lie about their organization.
 *
 * `userId` identifies the caller so their own row can be marked and protected;
 * the API does not stamp it, because "which of these is you" is a question
 * only the caller's own session answers.
 */
export async function getAgencyAccount(
  orgId: string,
  userId?: string | null,
): Promise<AgencyAccount | null> {
  if (USE_MOCK_DATA) return EMPTY_AGENCY_ACCOUNT;

  const base = `/api/orgs/${encodeURIComponent(orgId)}`;
  const [org, members, invites, clients] = await Promise.all([
    orgGet<RawOrg>(base),
    orgGet<RawMember[]>(`${base}/memberships`),
    orgGet<RawInvite[]>(`${base}/invites`),
    orgGet<RawClient[]>(`${base}/clients`),
  ]);
  if (!org || !members || !invites || !clients) return null;

  return {
    team: members.map((m) => toMember(m, userId ?? null)),
    invites: invites.map(toInvite),
    clients: clients.map(toClientSummary),
    seatsUsed: num(org.seats_used),
    seatsPending: num(org.seats_pending),
    seatCap: num(org.seat_cap),
  };
}

/**
 * Just the org's client list — what the trip page needs to offer an
 * assignment picker, without pulling the members and invitations with it.
 *
 * Empty (not null) when the read fails: a trip page whose assign control is
 * missing options is a degraded control, and taking the whole trip down
 * because the client list did not load would be worse.
 */
export async function getAgencyClients(
  orgId: string,
): Promise<readonly ClientSummary[]> {
  if (USE_MOCK_DATA) return [];
  const clients = await orgGet<RawClient[]>(
    `/api/orgs/${encodeURIComponent(orgId)}/clients`,
  ).catch(() => null);
  return (clients ?? []).map(toClientSummary);
}

/**
 * One client record, with its assigned trips and note timeline.
 *
 * Takes the org explicitly — the fixture lookup took only an id, which is
 * exactly how the id became the grant. `null` means "not yours or not there",
 * which the page turns into a 404 without distinguishing the two, because the
 * API deliberately does not either.
 */
export async function getClientRecord(
  orgId: string,
  clientId: string,
): Promise<ClientRecord | null> {
  if (USE_MOCK_DATA) return null;

  const base = `/api/orgs/${encodeURIComponent(orgId)}/clients/${encodeURIComponent(clientId)}`;
  const [client, trips, notes] = await Promise.all([
    orgGet<RawClient>(base),
    orgGet<RawClientTrip[]>(`${base}/trips`),
    orgGet<RawNote[]>(`${base}/notes`),
  ]);
  if (!client) return null;

  return {
    id: client.id,
    name: client.name,
    email: str(client.email),
    profileNotes: str(client.notes),
    createdAt: str(client.created_at),
    trips: (trips ?? []).map(toClientTrip),
    notes: (notes ?? []).map(toNote),
  };
}

function toClientTrip(raw: RawClientTrip): ClientTrip {
  const iso2 = raw.country_iso2?.toUpperCase() ?? null;
  const ref = iso2 ? findCountryByIso2(iso2) : undefined;
  const monthIdx = raw.month === null ? null : raw.month - 1;
  return {
    id: raw.id,
    title: raw.title,
    countryName: ref?.name ?? null,
    countrySlug: ref?.slug ?? null,
    monthName: monthIdx === null ? null : MONTH_NAMES[MONTH_SLUGS[monthIdx]!],
    // The author, by name if they have given one — an address is a poor label
    // in a table, but it is the only thing that always exists.
    agent: str(raw.owner_name) ?? raw.owner_email,
    updatedAt: raw.updated_at,
    shared: raw.shared === true,
  };
}

function toNote(raw: RawNote): ClientNote {
  return {
    id: raw.id,
    author: str(raw.author_name) ?? str(raw.author_email),
    when: raw.created_at,
    body: raw.body,
  };
}
