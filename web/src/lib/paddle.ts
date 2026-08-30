/**
 * Paddle checkout handoff.
 *
 * The FastAPI backend creates the Paddle *transaction* (see
 * `routers/paddle_checkout.py`) after checking the caller's session and
 * organization membership, and hands back its id. This module opens an overlay
 * against that id. The browser never names a price and never composes
 * `custom_data` — both live server-side, which is what stops a visitor buying
 * the cheapest price while claiming the dearest plan (the webhook's
 * `_extract_plan` reads the plan straight out of `custom_data`).
 *
 * What did change when this moved to Paddle Billing: Paddle.js now loads in
 * the browser. There is no server-rendered checkout in Billing — a `pri_`
 * price is only reachable through Paddle.js or through a transaction — so the
 * old promise that no Paddle host appears anywhere in `web/` could not
 * survive. It is confined to this module and `/checkout/pay`.
 *
 * Usage:
 *   const checkout = await requestCheckout({ plan: "consumer_premium" });
 *   await openCheckout(checkout);
 */

import { initializePaddle, type Paddle } from "@paddle/paddle-js";

import { PADDLE_CLIENT_TOKEN } from "@/lib/env";

export type PaddlePlan = "consumer_premium" | "agency_starter" | "agency_pro";

export type PaddleCheckout = {
  transactionId: string;
  /**
   * The same transaction's hosted link — our default payment link with
   * `?_ptxn=` appended. Used by the server-side `/upgrade` route; the overlay
   * path below does not need it.
   */
  checkoutUrl: string | null;
  sandbox: boolean;
  plan: PaddlePlan;
};

type ApiResponse = {
  transaction_id: string;
  checkout_url: string | null;
  sandbox: boolean;
  plan: PaddlePlan;
};

/**
 * Thrown when the checkout endpoint refuses for want of a session.
 *
 * Distinguished from every other failure because the answer is different in
 * kind: "sign in and we'll carry on" rather than "that went wrong". The API
 * requires a user before it will create a transaction — it stamps `user_id`
 * into `custom_data`, which is how the webhook later knows whose subscription
 * to activate — so an anonymous visitor clicking Upgrade is an expected path,
 * not an error to apologise for.
 */
export class CheckoutSignInRequired extends Error {
  constructor() {
    super("checkout requires a session");
    this.name = "CheckoutSignInRequired";
  }
}

/**
 * Thrown when Paddle.js cannot be initialised.
 *
 * Nearly always one cause: `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` was not passed as
 * a Docker build arg, so it was inlined as `""`. Next bakes `NEXT_PUBLIC_*`
 * into the client bundle at *build* time, which is the same way client-side
 * GlitchTip, PostHog and Plausible were silently inert in production until
 * 2026-08-17. Named rather than folded into the generic failure so the
 * GlitchTip event says which of the two it was.
 */
export class CheckoutUnavailable extends Error {
  constructor() {
    super("paddle.js is not configured");
    this.name = "CheckoutUnavailable";
  }
}

export type RequestCheckoutInput = {
  plan: PaddlePlan;
  /** Agency plans only — pass the org the seats should be assigned to. */
  organizationId?: string;
};

export async function requestCheckout(
  input: RequestCheckoutInput,
): Promise<PaddleCheckout> {
  const res = await fetch("/api/paddle/checkout-url", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      plan: input.plan,
      organization_id: input.organizationId ?? null,
    }),
  });
  if (res.status === 401) throw new CheckoutSignInRequired();
  if (!res.ok) {
    throw new Error(`requestCheckout(${input.plan}) failed: ${res.status}`);
  }
  const body = (await res.json()) as ApiResponse;
  return {
    transactionId: body.transaction_id,
    checkoutUrl: body.checkout_url,
    sandbox: body.sandbox,
    plan: body.plan,
  };
}

/**
 * Paddle.js is initialised once per page and reused.
 *
 * `initializePaddle` injects Paddle's script; calling it per click would add a
 * network round trip to every Upgrade press and re-register the event handler.
 */
let paddle: Promise<Paddle | undefined> | null = null;

export function resetPaddleForTests(): void {
  paddle = null;
}

/**
 * Sandbox or production, read off the token rather than configured separately.
 *
 * Paddle stamps the environment into the client-side token — `test_…` for
 * sandbox, `live_…` for production — so a second setting could only ever agree
 * with it or be a bug. A mismatched pair fails inside Paddle.js with an opaque
 * error, which is a poor way to learn that two env vars disagree.
 *
 * The API reports its own environment as `PaddleCheckout.sandbox`, derived
 * from `PADDLE_SANDBOX`. The two are independent settings and they should
 * match; if they ever do not, the transaction simply will not be found,
 * because a sandbox transaction id means nothing to production Paddle.
 */
export function paddleEnvironment(): "sandbox" | "production" {
  return PADDLE_CLIENT_TOKEN.startsWith("test_") ? "sandbox" : "production";
}

/** Paddle.js, initialised once per page and reused. */
export function getPaddle(): Promise<Paddle | undefined> {
  if (paddle) return paddle;
  if (!PADDLE_CLIENT_TOKEN) return Promise.reject(new CheckoutUnavailable());
  paddle = initializePaddle({
    token: PADDLE_CLIENT_TOKEN,
    environment: paddleEnvironment(),
  });
  return paddle;
}

/** Open the Paddle overlay for a transaction the API already created. */
export async function openCheckout(checkout: PaddleCheckout): Promise<void> {
  const client = await getPaddle();
  if (!client) throw new CheckoutUnavailable();
  client.Checkout.open({ transactionId: checkout.transactionId });
}

/**
 * The server route that performs the same handoff without client JavaScript.
 *
 * Every upgrade CTA is a real anchor pointing here; the click handler only
 * takes over once React has hydrated. That is still where `/login?next=`
 * returns to, so a signed-out visitor who clicks Upgrade resumes checkout
 * after signing in rather than landing somewhere generic.
 *
 * It is no longer a *no-JS* path, and that is Paddle's constraint rather than
 * a choice made here: `/upgrade` redirects to the transaction's hosted link,
 * and the page on the other end needs Paddle.js to open the checkout. Paddle
 * Billing has no server-rendered checkout to redirect to.
 */
export function checkoutPath(plan: PaddlePlan, organizationId?: string): string {
  const params = new URLSearchParams({ plan });
  if (organizationId) params.set("org", organizationId);
  return `/upgrade?${params.toString()}`;
}
