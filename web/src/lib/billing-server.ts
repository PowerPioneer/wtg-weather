import "server-only";
import { cookies } from "next/headers";

/**
 * The billing summary, read server-side for `/account`.
 *
 * Deliberately thin, and what it *omits* is the point. The section this feeds
 * used to print a renewal date of "May 14, 2026" and "card ending 4471" to
 * every subscriber, from a fixture. Both of those facts live at Paddle and the
 * only honest way to reach them is the customer portal, so there is nowhere in
 * this shape to put a stale copy of either.
 *
 * The API resolves the plan through the same organization
 * `services.entitlements` resolves through, so the plan printed here is the
 * plan enforced everywhere else by construction.
 */

import { INTERNAL_API_URL, USE_MOCK_DATA } from "./env";
import type { AccountPlan } from "./types";

const SESSION_COOKIE = "wtg_session";

export type BillingSummary = {
  plan: AccountPlan;
  /** A Paddle subscription exists on file — not merely "the plan is paid". */
  hasSubscription: boolean;
  /** Whether a portal link can be minted at all in this environment. */
  portalAvailable: boolean;
  sandbox: boolean;
  seatCap: number | null;
};

const FREE_SUMMARY: BillingSummary = {
  plan: "free",
  hasSubscription: false,
  portalAvailable: false,
  sandbox: true,
  seatCap: null,
};

function asPlan(value: unknown): AccountPlan {
  // Same rule as `session-user.ts`: an unrecognised plan is free, never the
  // other way round.
  const plans: readonly AccountPlan[] = [
    "free",
    "consumer_premium",
    "agency_starter",
    "agency_pro",
    "agency_enterprise",
  ];
  return plans.find((p) => p === value) ?? "free";
}

/**
 * Returns `null` when the session is rejected — the page redirects to sign-in
 * rather than showing a billing panel to nobody. Any other failure degrades to
 * the free summary: billing is one section of the account page, and a Paddle
 * hiccup should not take the trips list down with it.
 */
export async function getBillingSummary(): Promise<BillingSummary | null> {
  if (USE_MOCK_DATA) return FREE_SUMMARY;

  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return null;

  const res = await fetch(`${INTERNAL_API_URL}/api/billing`, {
    headers: {
      accept: "application/json",
      cookie: `${SESSION_COOKIE}=${session}`,
    },
    // Per-user, and it changes the moment a webhook lands.
    cache: "no-store",
  }).catch(() => null);

  if (!res) return FREE_SUMMARY;
  if (res.status === 401) return null;
  if (!res.ok) return FREE_SUMMARY;

  const raw = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw) return FREE_SUMMARY;

  return {
    plan: asPlan(raw.plan),
    hasSubscription: raw.has_subscription === true,
    portalAvailable: raw.portal_available === true,
    sandbox: raw.sandbox === true,
    seatCap: typeof raw.seat_cap === "number" ? raw.seat_cap : null,
  };
}
