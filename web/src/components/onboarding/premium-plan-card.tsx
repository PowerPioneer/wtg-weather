"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { redirectToCheckout, requestCheckoutUrl, type PaddlePlan } from "@/lib/paddle";

export type PremiumPlanCardProps = {
  plan: PaddlePlan;
  title: string;
  priceDisplay: string;
  /** Optional "/mo" or "/yr" suffix displayed after the price. */
  priceSuffix?: string;
  subline: string;
  bullets: readonly string[];
  /** Required for agency plans. */
  organizationId?: string;
  /** Label on the primary CTA. */
  ctaLabel?: string;
  /** Label on the "skip for now" link. */
  skipLabel?: string;
  onSkip?: () => void;
};

/**
 * Final-step upsell card. Hands off to the FastAPI `/api/paddle/checkout-url`
 * endpoint and redirects the browser to the returned sandbox Paddle checkout.
 * On webhook-confirmed activation the user comes back with a premium session;
 * the banner at the top of subsequent onboarding steps reflects that.
 */
export function PremiumPlanCard({
  plan,
  title,
  priceDisplay,
  priceSuffix = "",
  subline,
  bullets,
  organizationId,
  ctaLabel = "Continue to checkout →",
  skipLabel = "Skip — stay on free tier",
  onSkip,
}: PremiumPlanCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const { checkoutUrl } = await requestCheckoutUrl({ plan, organizationId });
      redirectToCheckout(checkoutUrl);
    } catch {
      setLoading(false);
      setError("Couldn't start checkout. Try again in a moment.");
    }
  }

  return (
    <Card padding="lg" elevated className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
            {plan === "consumer_premium" ? "Consumer Premium" : "Agency Pro"}
          </p>
          <h2 className="mt-1.5 font-display text-[24px] font-medium leading-tight tracking-[-0.012em] text-text">
            {title}
          </h2>
          <p className="mt-2 text-body-sm leading-[1.55] text-text-muted">{subline}</p>
        </div>
        <div className="shrink-0 text-right font-display leading-none">
          <span className="text-[32px] font-medium tabular-nums tracking-[-0.02em] text-text">
            {priceDisplay}
          </span>
          {priceSuffix ? (
            <span className="ml-0.5 font-sans text-[13px] text-text-muted">
              {priceSuffix}
            </span>
          ) : null}
        </div>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2 text-[13px] leading-[1.45] text-text">
            <span className="mt-[3px] shrink-0 text-accent" aria-hidden>
              ◆
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="text-[12px] text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="text-[12.5px] text-text-muted hover:text-text"
          >
            {skipLabel}
          </button>
        ) : (
          <span />
        )}
        <Button
          type="button"
          size="lg"
          onClick={handleCheckout}
          loading={loading}
          iconAfter={<span aria-hidden>→</span>}
        >
          {ctaLabel}
        </Button>
      </div>

      <p className="font-mono text-[10.5px] text-text-subtle">
        Sandbox Paddle · no real charges in dev
      </p>
    </Card>
  );
}
