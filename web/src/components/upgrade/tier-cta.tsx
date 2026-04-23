"use client";

import { cn } from "@/lib/cn";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import type { Tier } from "@/lib/types";

export type TierCtaProps = {
  tier: Tier;
  href: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Anchor wrapper that fires `upgrade_click` before the navigation. The link
 * is a real anchor so nav still works if JS is off or the click arrives
 * before the analytics backend loads.
 */
export function TierCta({ tier, href, className, children }: TierCtaProps) {
  function onClick() {
    if (tier.id === "free") return;
    trackEvent(ANALYTICS_EVENTS.upgradeClick, {
      source: "pricing",
      tier: tier.id,
    });
  }

  return (
    <a href={href} onClick={onClick} className={cn(className)}>
      {children}
    </a>
  );
}
