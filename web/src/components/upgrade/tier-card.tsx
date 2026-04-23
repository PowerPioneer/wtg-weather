/**
 * TierCard — server component. Renders a single pricing tier with the Atlas
 * treatment (featured tier gets dark ink background, accent ribbon, and
 * highlighted bullets). Billing period is a URL search param on the pricing
 * page so the whole experience stays zero-JS; no useState here.
 *
 * Visual source: web/design/pricing/PricingKit.jsx — TierCard().
 */

import { cn } from "@/lib/cn";
import type { Tier } from "@/lib/types";
import { PREMIUM_COPY } from "./copy";
import { TierCta } from "./tier-cta";

type Billing = "monthly" | "yearly";

export type TierCardProps = {
  tier: Tier;
  billing: Billing;
};

function formatPrice(tier: Tier, billing: Billing): { currency?: string; main: string; suffix: string } {
  if (tier.priceDisplay) return { main: tier.priceDisplay, suffix: "" };
  const monthly = tier.price.monthly;
  const yearly = tier.price.yearly;

  if (monthly === 0 && yearly === 0) return { main: "Free", suffix: "" };

  if (billing === "yearly") {
    if (tier.id === "premium") {
      return { currency: "€", main: "2", suffix: "/mo" };
    }
    if (yearly != null) {
      return { currency: "€", main: String(Math.round(yearly / 12)), suffix: tier.price.suffix || "/mo" };
    }
  }
  if (monthly != null) {
    const amount = monthly % 1 === 0 ? monthly.toFixed(0) : monthly.toFixed(2);
    return { currency: "€", main: amount, suffix: tier.price.suffix || "/mo" };
  }
  return { main: "—", suffix: "" };
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("h-3 w-3 shrink-0", className)}
    >
      <path
        d="M5 12.5l4 4 10-10"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TierCard({ tier, billing }: TierCardProps) {
  const featured = Boolean(tier.featured);
  const { currency, main, suffix } = formatPrice(tier, billing);

  return (
    <article
      className={cn(
        "relative flex min-h-[480px] flex-col gap-4 rounded-md border p-6 font-sans",
        featured
          ? "border-primary bg-primary text-primary-foreground shadow-lg"
          : "border-border bg-surface text-text",
      )}
    >
      {featured && (
        <span
          className={cn(
            "absolute -top-[10px] left-6 rounded-sm px-2.5 py-[3px] font-sans text-[10px] font-bold uppercase tracking-[0.16em]",
            "bg-[#E0C98A] text-primary",
          )}
        >
          Most travellers
        </span>
      )}

      {/* Header */}
      <header>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span
            className={cn(
              "text-[10.5px] font-semibold uppercase tracking-[0.16em]",
              featured ? "text-[rgba(247,246,242,0.72)]" : "text-text-muted",
            )}
          >
            {tier.name}
          </span>
          {!featured && tier.eyebrow && (
            <span className="font-display text-[11px] italic text-text-subtle">{tier.eyebrow}</span>
          )}
        </div>
        <div
          className={cn(
            "flex items-baseline gap-1 font-display leading-none",
            featured ? "text-primary-foreground" : "text-text",
          )}
        >
          {currency && <span className="text-[24px] font-medium">{currency}</span>}
          <span
            className={cn(
              "font-medium tabular-nums",
              featured ? "text-[48px] tracking-[-0.02em]" : "text-[36px] tracking-[-0.02em]",
            )}
          >
            {main}
          </span>
          {suffix && (
            <span
              className={cn(
                "ml-0.5 font-sans text-[13px] font-normal",
                featured ? "text-[rgba(247,246,242,0.72)]" : "text-text-muted",
              )}
            >
              {suffix}
            </span>
          )}
        </div>
        {tier.seats && (
          <div
            className={cn(
              "mt-1 font-mono text-[11.5px]",
              featured ? "text-[rgba(247,246,242,0.72)]" : "text-text-muted",
            )}
          >
            {tier.seats}
          </div>
        )}
        {tier.id === "premium" && billing === "yearly" && tier.yearlyNote && (
          <div className="mt-1 text-[11.5px] text-[#E0C98A]">{tier.yearlyNote}</div>
        )}
        {tier.id === "premium" && billing === "monthly" && (
          <div className="mt-1 text-[11.5px] text-[rgba(247,246,242,0.72)]">
            or €24/yr · <span className="text-[#E0C98A]">save 33%</span>
          </div>
        )}
      </header>

      {/* Featured bullets */}
      {featured && tier.featuredBullets && (
        <div className="border-t border-[rgba(247,246,242,0.14)] pb-2 pt-3">
          <div className="mb-2.5 font-display text-[19px] font-medium leading-[1.25]">
            {PREMIUM_COPY.headline}
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {tier.featuredBullets.map((b) => (
              <li key={b} className="flex gap-2 text-[13px] leading-[1.4]">
                <span className="mt-px shrink-0 font-mono text-[#E0C98A]" aria-hidden="true">
                  ◆
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Featured CTA (above full list) */}
      {featured && (
        <TierCta
          tier={tier}
          href="/api/billing/checkout?tier=premium"
          className="inline-flex w-full items-center justify-center rounded-md border border-[#E0C98A] bg-[#E0C98A] px-3.5 py-2.5 text-[13.5px] font-medium text-primary hover:brightness-105"
        >
          {tier.cta.label}
        </TierCta>
      )}

      {/* Subline + features */}
      <div className="flex-1">
        <div className={cn("mb-2.5 text-[12px]", featured ? "text-[rgba(247,246,242,0.72)]" : "text-text-muted")}>
          {tier.subline}
        </div>
        <ul className="m-0 flex list-none flex-col gap-[7px] p-0">
          {tier.features.map((f) => (
            <li
              key={f}
              className={cn(
                "flex gap-2 text-[12.5px] leading-[1.45]",
                featured ? "text-[rgba(247,246,242,0.88)]" : "text-text",
              )}
            >
              <span className="mt-[3px] shrink-0">
                <CheckIcon className={featured ? "text-[#E0C98A]" : "text-score-perfect"} />
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Non-featured CTA at bottom */}
      {!featured && (
        <TierCta
          tier={tier}
          href={tier.id === "free" ? "/map" : `/api/billing/checkout?tier=${tier.id}`}
          className={cn(
            "inline-flex w-full items-center justify-center rounded-md px-3.5 py-2.5 text-[13.5px] font-medium",
            tier.cta.kind === "primary" && "bg-primary text-primary-foreground hover:bg-primary-hover",
            tier.cta.kind === "outline" && "border border-primary bg-transparent text-primary hover:bg-surface-2",
            tier.cta.kind === "ghost" && "border border-border bg-transparent text-primary hover:bg-surface-2",
          )}
        >
          {tier.cta.label}
        </TierCta>
      )}
    </article>
  );
}
