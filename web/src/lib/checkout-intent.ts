import "server-only";

/**
 * "This person clicked Upgrade before signing in."
 *
 * The magic-link round trip goes browser → API → email → `/login/verify`, and
 * nothing survives it: the link the API mails carries a token and nothing
 * else, so a `?next=` on `/login` is gone by the time the session exists. This
 * cookie is the one thing that does survive, set when `/upgrade` turns an
 * anonymous visitor away and read once by `/login/verify`.
 *
 * Deliberately **not** a URL. A cookie holding a redirect target is an open
 * redirect waiting for someone to set it to another origin; this holds a plan
 * identifier out of a fixed set and an optional org id, and the destination is
 * reconstructed from them. The worst a forged value can do is send its own
 * author to a checkout page for a plan they picked.
 */

import type { PaddlePlan } from "./paddle";

export const CHECKOUT_INTENT_COOKIE = "wtg_checkout_intent";

/** Long enough to read an email, short enough not to linger. */
export const CHECKOUT_INTENT_MAX_AGE = 30 * 60;

const PLANS: readonly PaddlePlan[] = [
  "consumer_premium",
  "agency_starter",
  "agency_pro",
];

export type CheckoutIntent = {
  plan: PaddlePlan;
  organizationId?: string;
};

export function isPaddlePlan(value: unknown): value is PaddlePlan {
  return typeof value === "string" && PLANS.some((p) => p === value);
}

/** `consumer_premium` or `agency_pro:2f9c…`. No slashes, no scheme, no host. */
export function serialiseIntent(intent: CheckoutIntent): string {
  return intent.organizationId
    ? `${intent.plan}:${intent.organizationId}`
    : intent.plan;
}

export function parseIntent(raw: string | undefined): CheckoutIntent | null {
  if (!raw) return null;
  const [plan, org] = raw.split(":", 2);
  if (!isPaddlePlan(plan)) return null;
  // An org id only ever reaches the API, which rejects one the caller has no
  // membership in (403). Shape-check it anyway so nothing odd goes into a URL.
  const organizationId =
    org && /^[0-9a-fA-F-]{36}$/.test(org) ? org : undefined;
  return { plan, organizationId };
}
