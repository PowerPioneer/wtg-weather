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

import { PADDLE_CLIENT_TOKEN, PADDLE_ENV, SITE_URL } from "@/lib/env";

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

/**
 * Thrown when Paddle configuration is present but wrong.
 *
 * Separate from `CheckoutUnavailable` because the operator response differs:
 * unavailable means a value never reached the build; misconfigured means two
 * values disagree and one of them points at the wrong Paddle account. The
 * message is for logs and developers and is never rendered to a buyer.
 */
export class CheckoutMisconfigured extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutMisconfigured";
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
 * Sandbox or production. Read from configuration and never guessed.
 *
 * There is no default on purpose. Defaulting either way is silent: the wrong
 * account has its own prices, its own customers and — one way round — real
 * money, and nothing about the failure would say so.
 *
 * Paddle also stamps the environment into the token itself (`test_…` sandbox,
 * `live_…` production), so the two are cross-checked here. A mismatch is a
 * misconfiguration that would otherwise surface deep inside Paddle.js as an
 * opaque error, or worse, as a checkout against the wrong account.
 */
export function paddleEnvironment(): "sandbox" | "production" {
  if (!PADDLE_ENV) {
    throw new CheckoutMisconfigured(
      "NEXT_PUBLIC_PADDLE_ENV is not set. It must be 'sandbox' or 'production' — " +
        "there is deliberately no default.",
    );
  }
  if (PADDLE_ENV !== "sandbox" && PADDLE_ENV !== "production") {
    throw new CheckoutMisconfigured(
      `NEXT_PUBLIC_PADDLE_ENV is "${PADDLE_ENV}"; expected 'sandbox' or 'production'.`,
    );
  }
  const fromToken = PADDLE_CLIENT_TOKEN.startsWith("test_")
    ? "sandbox"
    : "production";
  if (PADDLE_CLIENT_TOKEN && fromToken !== PADDLE_ENV) {
    throw new CheckoutMisconfigured(
      `NEXT_PUBLIC_PADDLE_ENV says "${PADDLE_ENV}" but the client token is a ` +
        `${fromToken} token. Refusing to open a checkout against the wrong account.`,
    );
  }
  return PADDLE_ENV;
}

/**
 * Paddle's checkout lifecycle, re-broadcast as a DOM event.
 *
 * Paddle.js takes a single `eventCallback` at initialisation, and this module
 * owns that call — so anything that wants to know whether a checkout actually
 * opened has to hear about it from here. `detail` is Paddle's own event name
 * (`checkout.loaded`, `checkout.closed`, `checkout.error`, …).
 */
export const PADDLE_EVENT = "wtg:paddle";

/** Paddle.js, initialised once per page and reused. */
export function getPaddle(): Promise<Paddle | undefined> {
  if (paddle) return paddle;
  if (!PADDLE_CLIENT_TOKEN) return Promise.reject(new CheckoutUnavailable());
  let environment: "sandbox" | "production";
  try {
    environment = paddleEnvironment();
  } catch (err) {
    return Promise.reject(err);
  }
  paddle = initializePaddle({
    token: PADDLE_CLIENT_TOKEN,
    environment,
    eventCallback: (event) => {
      if (typeof window === "undefined" || !event?.name) return;
      window.dispatchEvent(new CustomEvent(PADDLE_EVENT, { detail: event.name }));
    },
    // Checkout settings live here rather than at each `Checkout.open` call:
    // opening by `transactionId` takes no `settings` object, so this is the
    // only place they can be set.
    checkout: {
      settings: {
        displayMode: "overlay",
        variant: "one-page",
        successUrl: `${SITE_URL}/welcome`,
      },
    },
  });
  return paddle;
}

/**
 * Country-localized prices for display, straight from Paddle.
 *
 * No country is passed. There is no geo header to read — this runs behind
 * Caddy and a CDN, not Vercel — and `PricePreview` resolves the visitor's
 * location from their IP when asked for none, which is both more accurate
 * than a header we do not have and correct for a page served from cache.
 *
 * Returns Paddle's own `formattedTotals.total` verbatim, keyed by price id.
 * These strings are already localised and already carry their currency
 * symbol and separators; formatting them again is how you turn "€2.99" into
 * "$2.99" or "3". Nothing here does arithmetic on a price.
 */
export async function previewPrices(
  priceIds: readonly string[],
): Promise<Record<string, string>> {
  if (priceIds.length === 0) return {};
  const client = await getPaddle();
  if (!client) throw new CheckoutUnavailable();

  const preview = await client.PricePreview({
    items: priceIds.map((priceId) => ({ priceId, quantity: 1 })),
  });

  const out: Record<string, string> = {};
  for (const line of preview.data.details.lineItems) {
    out[line.price.id] = line.formattedTotals.total;
  }
  return out;
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
