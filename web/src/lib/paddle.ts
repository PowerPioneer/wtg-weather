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
 * Hand the browser off to Paddle. Lives behind a helper so tests can stub a
 * navigation without mocking `window.location` globally.
 */
export function redirectToCheckout(url: string): void {
  if (typeof window === "undefined") return;
  window.location.assign(url);
}
