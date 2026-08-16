/**
 * Paddle checkout handoff.
 *
 * The FastAPI backend owns the checkout-URL signing (see `routers/paddle_checkout.py`) —
 * the client never sees price IDs or constructs Paddle URLs itself. Production
 * switches to live-mode in Phase 7; here we're sandbox-only.
 *
 * Usage:
 *   const { checkoutUrl } = await requestCheckoutUrl({ plan: "consumer_premium" });
 *   window.location.assign(checkoutUrl);
 */

export type PaddlePlan = "consumer_premium" | "agency_starter" | "agency_pro";

export type PaddleCheckoutResponse = {
  checkoutUrl: string;
  sandbox: boolean;
  plan: PaddlePlan;
};

type ApiResponse = {
  checkout_url: string;
  sandbox: boolean;
  plan: PaddlePlan;
};

/**
 * Thrown when the checkout endpoint refuses for want of a session.
 *
 * Distinguished from every other failure because the answer is different in
 * kind: "sign in and we'll carry on" rather than "that went wrong". The API
 * requires a user before it will issue a checkout URL — it stamps `user_id`
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

export type RequestCheckoutUrlInput = {
  plan: PaddlePlan;
  /** Agency plans only — pass the org the seats should be assigned to. */
  organizationId?: string;
};

export async function requestCheckoutUrl(
  input: RequestCheckoutUrlInput,
): Promise<PaddleCheckoutResponse> {
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
    throw new Error(`requestCheckoutUrl(${input.plan}) failed: ${res.status}`);
  }
  const body = (await res.json()) as ApiResponse;
  return {
    checkoutUrl: body.checkout_url,
    sandbox: body.sandbox,
    plan: body.plan,
  };
}

/**
 * The server route that performs the same handoff without JavaScript.
 *
 * Every upgrade CTA is a real anchor pointing here; the click handler only
 * takes over once React has hydrated. That keeps the pricing page's primary
 * action working with JS off — the zero-JS rule in `web/CLAUDE.md` is aimed at
 * the SEO surface, but a pricing page whose buy button is inert without JS is
 * a worse failure than a country page that renders plainly.
 *
 * It is also where `/login?next=` returns to, so a signed-out visitor who
 * clicks Upgrade lands in checkout after signing in rather than back on a
 * generic page having lost what they asked for.
 */
export function checkoutPath(plan: PaddlePlan, organizationId?: string): string {
  const params = new URLSearchParams({ plan });
  if (organizationId) params.set("org", organizationId);
  return `/upgrade?${params.toString()}`;
}

/**
 * Hand the browser off to Paddle. Lives behind a helper so tests can stub a
 * navigation without mocking `window.location` globally.
 */
export function redirectToCheckout(url: string): void {
  if (typeof window === "undefined") return;
  window.location.assign(url);
}
