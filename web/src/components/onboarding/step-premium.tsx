"use client";

import { Button } from "@/components/ui/button";
import { findTier } from "@/components/upgrade";
import type { PaddlePlan } from "@/lib/paddle";
import type { Tier } from "@/lib/types";
import { PremiumPlanCard } from "./premium-plan-card";
import { WizardStep } from "./wizard-step";

export type StepPremiumProps = {
  kind: string;
  step: number;
  total: number;
  /** Which plan to offer: consumer vs agency. */
  plan: PaddlePlan;
  organizationId?: string;
  /** If the user already has a subscription, bypass the card entirely. */
  alreadyPremium?: boolean;
  onBack?: () => void;
  onSkip: () => Promise<void> | void;
  /** Called when the user chooses to finish without upgrading (or is already premium). */
  onFinish: () => Promise<void> | void;
};

type PlanCopy = {
  title: string;
  priceDisplay: string;
  priceSuffix: string;
  subline: string;
  bullets: readonly string[];
};

/**
 * Derived from the pricing tiers, not written here.
 *
 * The hand-written table this replaces quoted €4/mo for Premium, €29 for
 * Starter and €89 for Pro. The pricing page has always said €2.99, €39 and
 * €99. Onboarding is the last screen before a card is entered, so it was the
 * worst of the five places to be wrong — and no test could have caught it,
 * because both numbers were "correct" against their own constant.
 */
function planCopy(plan: PaddlePlan): PlanCopy {
  const tier = findTier(TIER_FOR_PLAN[plan]);
  if (!tier) {
    // Unreachable: the map below covers every PaddlePlan and the tiers are a
    // literal. Belt and braces so a future tier rename fails loudly in dev
    // rather than rendering a card with no price on it.
    throw new Error(`no pricing tier for plan ${plan}`);
  }
  const monthly = tier.price.monthly;
  return {
    title: plan === "consumer_premium" ? "Unlock Premium" : tier.name,
    priceDisplay:
      monthly == null
        ? (tier.priceDisplay ?? "—")
        : `€${monthly % 1 === 0 ? monthly.toFixed(0) : monthly.toFixed(2)}`,
    priceSuffix: tier.price.suffix || "/mo",
    subline: tier.subline,
    bullets: tier.featuredBullets ?? tier.features.slice(0, 5),
  };
}

const TIER_FOR_PLAN: Record<PaddlePlan, Tier["id"]> = {
  consumer_premium: "premium",
  agency_starter: "starter",
  agency_pro: "pro",
};

/**
 * Final wizard step. If the session is already on a paid plan we just show a
 * short confirmation; otherwise we hand off to `PremiumPlanCard` which drives
 * the Paddle sandbox checkout.
 */
export function StepPremium({
  kind,
  step,
  total,
  plan,
  organizationId,
  alreadyPremium,
  onBack,
  onSkip,
  onFinish,
}: StepPremiumProps) {
  const copy = planCopy(plan);

  if (alreadyPremium) {
    return (
      <WizardStep
        kind={kind}
        step={step}
        total={total}
        title="You're all set"
        subtitle="Your subscription is already active — you can explore the map any time and come back to Settings to change your plan."
        footer={
          <>
            {onBack ? (
              <Button variant="secondary" onClick={onBack} type="button">
                Back
              </Button>
            ) : (
              <span />
            )}
            <Button
              onClick={() => void onFinish()}
              iconAfter={<span aria-hidden>→</span>}
            >
              Open the map
            </Button>
          </>
        }
      >
        <p className="rounded-md border border-border bg-surface-2 px-5 py-4 text-body-sm text-text-muted">
          Nothing to configure — every premium layer is already unlocked on your
          account.
        </p>
      </WizardStep>
    );
  }

  return (
    <WizardStep
      kind={kind}
      step={step}
      total={total}
      title={plan === "consumer_premium" ? "Finish free, or unlock Premium" : "Pick a plan for your agency"}
      subtitle={
        plan === "consumer_premium"
          ? "The map works great on the free tier. Premium opens up regional detail, humidity, snow, and saved trips whenever you want them."
          : "Every plan includes unlimited destinations and scoring. Pick the one that fits your team today — change any time."
      }
    >
      <PremiumPlanCard
        plan={plan}
        title={copy.title}
        priceDisplay={copy.priceDisplay}
        priceSuffix={copy.priceSuffix}
        subline={copy.subline}
        bullets={copy.bullets}
        organizationId={organizationId}
        onSkip={() => void onSkip()}
      />

      {onBack ? (
        <div className="mt-4">
          <Button variant="ghost" onClick={onBack} type="button">
            ← Back
          </Button>
        </div>
      ) : null}
    </WizardStep>
  );
}
