/**
 * Paddle price ids for the pricing page, fetched from the API.
 *
 * Server-side only — it reads `INTERNAL_API_URL`, a docker-network hostname
 * the browser cannot resolve, so importing it from a client component fails
 * loudly at request time rather than leaking anything. Kept separate from
 * `lib/paddle.ts` because that module imports
 * `@paddle/paddle-js` and belongs to the browser. The ids themselves are not
 * secret — `PricePreview()` runs client-side and needs them — but they are
 * read from the API rather than from this app's own env so that
 * `PADDLE_PRICE_*` stays the single source of truth. Duplicating them into
 * `NEXT_PUBLIC_` build args would drift the first time only one was changed,
 * and a drifted price id is a pricing page advertising one thing and charging
 * another.
 */

import { INTERNAL_API_URL } from "@/lib/env";
import type { TierId } from "@/lib/types";

/** The API's plan vocabulary, keyed by the web's tier ids. */
const PLAN_BY_TIER: Partial<Record<TierId, string>> = {
  premium: "consumer_premium",
  starter: "agency_starter",
  pro: "agency_pro",
  // `free` has nothing to buy; `enterprise` is sold by "contact sales" and has
  // no price id, so neither appears here and both fall back to static copy.
};

type PricesResponse = {
  prices?: Record<string, string>;
  formatted?: Record<string, string>;
};

export type TierPricing = {
  /** Paddle price id, for the client-side `PricePreview()` call. */
  priceId?: string;
  /**
   * Paddle's own formatted base price, e.g. "€2.99". Server-rendered, so the
   * no-JS and crawler view shows a real Paddle price rather than a number
   * maintained by hand. Absent when Paddle could not be reached.
   */
  formatted?: string;
};

export async function getPaddlePricing(): Promise<Partial<Record<TierId, TierPricing>>> {
  let body: PricesResponse | null = null;
  try {
    const res = await fetch(`${INTERNAL_API_URL}/api/paddle/prices`, {
      // Price ids change about once a year, but a stale one is a wrong charge,
      // so this rides the page's own revalidation rather than caching forever.
      next: { revalidate: 3600 },
      headers: { accept: "application/json" },
    });
    if (res.ok) body = (await res.json()) as PricesResponse;
  } catch {
    // Swallowed on purpose. A pricing page that 500s because the API blinked
    // is worse than one showing the static euro prices from `copy.ts` — which
    // is exactly what an empty map produces.
    body = null;
  }

  const prices = body?.prices ?? {};
  const formatted = body?.formatted ?? {};
  const out: Partial<Record<TierId, TierPricing>> = {};
  for (const [tier, plan] of Object.entries(PLAN_BY_TIER) as [TierId, string][]) {
    const id = prices[plan];
    const label = formatted[plan];
    if (typeof id === "string" && id) {
      out[tier] = {
        priceId: id,
        formatted: typeof label === "string" && label ? label : undefined,
      };
    }
  }
  return out;
}
