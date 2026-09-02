"use client";

/**
 * A tier's price, localized to the visitor's country by Paddle.
 *
 * Renders `children` — the statically-known price from `copy.ts` — on the
 * server and on first paint, then replaces it with Paddle's own
 * `formattedTotals.total` once `PricePreview()` answers. That order matters
 * for two reasons:
 *
 *   1. `/pricing` must render with zero client JS (`web/CLAUDE.md`). Pricing
 *      is the one page where a crawler seeing no price is worst, so the
 *      fallback is the real static price rather than a skeleton.
 *   2. `PricePreview` is a network call. Showing nothing until it lands would
 *      mean a pricing page that is blank in exactly the spot people look at
 *      first, on every cold load.
 *
 * The Paddle string is rendered verbatim. It arrives already localised, with
 * its own currency symbol, separators and decimal convention — the €/$ and
 * the "/mo" suffix in the fallback are *ours* and are dropped the moment
 * Paddle's own string is available, because re-decorating it is how "€2.99"
 * becomes "€€2.99" for a British visitor being charged £2.49.
 */

import { useEffect, useState } from "react";

import { previewPrices } from "@/lib/paddle";

export type TierPriceProps = {
  /** Paddle price id, or undefined for a tier with no purchasable price. */
  priceId?: string;
  /** Server-rendered fallback: the static price, already marked up. */
  children: React.ReactNode;
};

export function TierPrice({ priceId, children }: TierPriceProps) {
  const [localized, setLocalized] = useState<string | null>(null);

  useEffect(() => {
    if (!priceId) return;
    let cancelled = false;

    previewPrices([priceId])
      .then((prices) => {
        if (cancelled) return;
        const total = prices[priceId];
        if (total) setLocalized(total);
      })
      .catch(() => {
        // Keep the static fallback. A visitor seeing our euro price is a much
        // smaller problem than a pricing page with a hole in it, and the
        // thrown error is already reported to GlitchTip.
      });

    return () => {
      cancelled = true;
    };
  }, [priceId]);

  if (localized === null) return <>{children}</>;

  return (
    <span className="text-[34px] leading-none font-semibold tracking-tight">
      {localized}
    </span>
  );
}
