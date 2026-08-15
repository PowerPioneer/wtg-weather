/**
 * The session contract: `/api/me` in, {@link SessionUser} out.
 *
 * This module is deliberately isomorphic — no `server-only`, no `next/headers`
 * — because both halves of the app need the *same* answer. `lib/session.ts`
 * (RSC) and `hooks/use-session.ts` (browser) each fetch `/api/me` over a
 * different transport and then both land here. Two parsers would be two
 * vocabularies, which is the bug this replaces: the API has always spoken
 * `consumer_premium` and the web's `SessionUser` claimed `premium`, so
 * `getEntitlement` was reading a plan string that no API response ever
 * contained. It resolved correctly only because it asked `plan !== "free"`,
 * which is true of every string the API could have sent, including a
 * misspelling.
 *
 * The vocabulary is now the API's, everywhere. `web/src/lib/types.ts` holds
 * the types; the runtime guards live here.
 */

import type {
  AccountPlan,
  AccountRole,
  Entitlement,
  SessionOrg,
  SessionUser,
} from "./types";

const PLANS = [
  "free",
  "consumer_premium",
  "agency_starter",
  "agency_pro",
  "agency_enterprise",
] as const satisfies readonly AccountPlan[];

const ROLES = ["owner", "admin", "agent", "member"] as const satisfies readonly AccountRole[];

/**
 * Which plans unlock what. An explicit table rather than `plan !== "free"`:
 * the fallback for an unrecognised plan has to be *no* entitlement, and a
 * negation gives away the paid tier to any string the API adds later or any
 * value that arrives malformed.
 */
const PLAN_ENTITLEMENTS: Record<AccountPlan, { premium: boolean; agency: boolean }> = {
  free: { premium: false, agency: false },
  consumer_premium: { premium: true, agency: false },
  agency_starter: { premium: true, agency: true },
  agency_pro: { premium: true, agency: true },
  agency_enterprise: { premium: true, agency: true },
};

const PLAN_LABELS: Record<AccountPlan, string> = {
  free: "Free",
  consumer_premium: "Premium",
  agency_starter: "Agency · Starter",
  agency_pro: "Agency · Pro",
  agency_enterprise: "Agency · Enterprise",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** An unrecognised plan is the free plan. Never the other way round. */
function asPlan(value: unknown): AccountPlan {
  return PLANS.find((p) => p === value) ?? "free";
}

function asRole(value: unknown): AccountRole | null {
  return ROLES.find((r) => r === value) ?? null;
}

function asOrg(value: unknown): SessionOrg | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id);
  const name = asString(value.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    plan: asPlan(value.plan),
    seatCap: asNumber(value.seat_cap) ?? 0,
    seatsUsed: asNumber(value.seats_used) ?? 0,
    createdAt: asString(value.created_at),
  };
}

/**
 * Parse a `/api/me` body. Returns `null` for anything that isn't a session —
 * a 401 body, an error page a proxy substituted, a truncated response — so
 * callers get "signed out" rather than a half-built user whose `name.split()`
 * throws while rendering.
 *
 * `id` and `email` are the only required fields: a payload without them
 * identifies nobody.
 */
export function parseSessionUser(raw: unknown): SessionUser | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const email = asString(raw.email);
  if (!id || !email) return null;

  return {
    id,
    email,
    name: asString(raw.name),
    plan: asPlan(raw.plan),
    role: asRole(raw.role),
    createdAt: asString(raw.created_at),
    org: asOrg(raw.organization),
  };
}

/**
 * The two UI gates, derived from the plan and nowhere else.
 *
 * These gate *presentation*. The tile archive itself is gated server-side by
 * `/api/tiles/url`, which re-resolves the entitlement against the database —
 * a wrong answer here shows the wrong buttons, not the wrong data.
 */
export function getEntitlement(session: SessionUser | null): Entitlement {
  if (!session) return { premium: false, agency: false };
  const { premium, agency } = PLAN_ENTITLEMENTS[session.plan];
  return { premium, agency, seatCap: session.org?.seatCap };
}

/** Human label for a plan — sidebar badge, billing header, plan chips. */
export function planLabel(plan: AccountPlan): string {
  return PLAN_LABELS[plan];
}

/**
 * What to call the user. The API's `name` is nullable (magic-link sign-up
 * collects an address and nothing else), so every surface that greets someone
 * goes through here rather than assuming a string.
 */
export function displayName(session: SessionUser): string {
  return session.name ?? session.email;
}

/** First name for a greeting, falling back to the whole display name. */
export function firstName(session: SessionUser): string {
  const name = displayName(session);
  return name.split(" ")[0] || name;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * "Mar 2026" from an ISO timestamp. Formatted in UTC with a fixed month table
 * rather than `toLocaleDateString`, because this renders in an RSC on the
 * server and again in the browser on hydration, and those two have different
 * locales and time zones.
 */
export function monthYear(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return `${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}`;
}
