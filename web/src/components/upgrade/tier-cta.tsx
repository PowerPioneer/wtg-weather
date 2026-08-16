"use client";

/**
 * The CTA on a pricing tier. Decides, from the tier alone, whether this is a
 * purchase or an ordinary link:
 *
 *   - `premium` / `starter` / `pro` buy a Paddle plan → `UpgradeButton`, which
 *     owns the checkout request, the pending state and the error;
 *   - `free` is the map;
 *   - `enterprise` is a sales conversation, so it opens mail.
 *
 * Every one of these used to be a bare anchor, and the three paid ones pointed
 * at `/api/billing/checkout?tier=…` — a route that has never existed in this
 * repo. The pricing page's primary action 404'd.
 */

import { cn } from "@/lib/cn";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import type { Tier } from "@/lib/types";
import { planForTier } from "./copy";
import { UpgradeButton } from "./upgrade-button";

export type TierCtaProps = {
  tier: Tier;
  className?: string;
  /** Agency tiers bought from within an existing org. */
  organizationId?: string;
};

/** Where a tier goes when it is not a purchase. */
const CONTACT_MAILTO =
  "mailto:hello@wheretogoforgreatweather.com?subject=Agency%20Enterprise";

export function TierCta({ tier, className, organizationId }: TierCtaProps) {
  const plan = planForTier(tier.id);

  if (plan) {
    return (
      <UpgradeButton
        plan={plan}
        organizationId={organizationId}
        source="pricing"
        properties={{ tier: tier.id }}
        label={tier.cta.label}
        className={cn(className)}
      />
    );
  }

  const href = tier.id === "enterprise" ? CONTACT_MAILTO : "/map";
  return (
    <a
      href={href}
      className={cn(className)}
      onClick={() => {
        if (tier.id === "free") return;
        trackEvent(ANALYTICS_EVENTS.upgradeClick, {
          source: "pricing",
          tier: tier.id,
        });
      }}
    >
      {tier.cta.label}
    </a>
  );
}
