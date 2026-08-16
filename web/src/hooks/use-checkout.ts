"use client";

/**
 * The one way any surface starts a checkout.
 *
 * Five places offer an upgrade — the pricing tiers, the map's inline popover,
 * the display-mode picker, the admin-2 zoom gate, and the onboarding premium
 * step — and before this they did five different things, three of which were
 * `href="/pricing"` and one of which pointed at `/api/billing/checkout`, a
 * route that has never existed. Wiring them individually would have produced
 * five slightly different loading states and five ways to swallow an error.
 *
 * What this owns:
 *   - the request to `/api/paddle/checkout-url` (via `lib/paddle.ts` — the
 *     browser never builds a Paddle URL itself, which is that module's stated
 *     contract and the reason no Paddle host appears anywhere in `web/`),
 *   - `pending` for the moment between click and redirect,
 *   - the anonymous case: bounce through `/login?next=` so signing in resumes
 *     the checkout instead of dumping the visitor somewhere generic,
 *   - the analytics event, fired once, at the call site's named source.
 *
 * It deliberately does not own the *copy* — that comes from `upgrade/copy.ts`
 * so a price change lands everywhere at once.
 */

import { useCallback, useRef, useState } from "react";

import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import {
  CheckoutSignInRequired,
  checkoutPath,
  redirectToCheckout,
  requestCheckoutUrl,
  type PaddlePlan,
} from "@/lib/paddle";

export type CheckoutStatus = "idle" | "pending" | "signin" | "error";

export type StartCheckoutInput = {
  plan: PaddlePlan;
  organizationId?: string;
  /** Analytics `source` — "pricing", "map_popover", "display_mode", … */
  source: string;
  /** Extra analytics properties, e.g. the locked feature that prompted it. */
  properties?: Record<string, string | number | boolean>;
};

export type UseCheckout = {
  status: CheckoutStatus;
  /** True while a redirect is being arranged — disable the button on this. */
  pending: boolean;
  /** Human-readable failure, or null. Never a raw status code. */
  error: string | null;
  start: (input: StartCheckoutInput) => Promise<void>;
  reset: () => void;
};

export function useCheckout(): UseCheckout {
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  // A double-click must not fire two checkout requests: the first redirect is
  // already in flight and the browser has not navigated yet.
  const inFlight = useRef(false);

  const reset = useCallback(() => {
    inFlight.current = false;
    setStatus("idle");
    setError(null);
  }, []);

  const start = useCallback(async (input: StartCheckoutInput) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus("pending");
    setError(null);

    trackEvent(ANALYTICS_EVENTS.upgradeClick, {
      source: input.source,
      plan: input.plan,
      ...(input.properties ?? {}),
    });

    try {
      const { checkoutUrl } = await requestCheckoutUrl({
        plan: input.plan,
        organizationId: input.organizationId,
      });
      setStatus("pending");
      redirectToCheckout(checkoutUrl);
    } catch (err) {
      if (err instanceof CheckoutSignInRequired) {
        // Not a failure — carry the intent through sign-in. `/upgrade` picks
        // it up on the way back and goes straight to Paddle.
        setStatus("signin");
        const next = checkoutPath(input.plan, input.organizationId);
        if (typeof window !== "undefined") {
          window.location.assign(`/login?next=${encodeURIComponent(next)}`);
        }
        return;
      }
      inFlight.current = false;
      setStatus("error");
      // The status code is in the thrown message and stays out of the UI: it
      // tells the visitor nothing and the same string ends up in GlitchTip.
      setError("checkout-failed");
    }
  }, []);

  return {
    status,
    pending: status === "pending" || status === "signin",
    error,
    start,
    reset,
  };
}
