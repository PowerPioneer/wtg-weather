"use client";

import { Button } from "@/components/ui/button";
import type { PaddlePlan } from "@/lib/paddle";
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

const PLAN_COPY: Record<PaddlePlan, PlanCopy> = {
  consumer_premium: {
    title: "Unlock Premium",
    priceDisplay: "€4",
    priceSuffix: "/mo",
    subline:
      "Admin-2 regions, humidity and heat index, sea-surface temps, snow, saved trips, and ad-free browsing.",
    bullets: [
      "Zoom into admin-2 regions on every country",
      "Humidity, heat-index, SST, and snow layers",
      "Unlimited saved trips with shareable URLs",
      "Custom alerts for favourite destinations",
      "Ad-free, tracker-free — always",
    ],
  },
  agency_starter: {
    title: "Agency Starter",
    priceDisplay: "€29",
    priceSuffix: "/mo",
    subline:
      "Everything in Premium plus 3 agent seats, shared client book, and branded trip PDFs.",
    bullets: [
      "3 included agent seats (add more any time)",
      "Shared clients and trips across your team",
      "Branded PDF exports for client proposals",
      "CSV export of scored destinations",
      "Priority email support",
    ],
  },
  agency_pro: {
    title: "Agency Pro",
    priceDisplay: "€89",
    priceSuffix: "/mo",
    subline:
      "Grow the team to 10 seats, add SSO and audit logs, and pull our data via API.",
    bullets: [
      "10 included seats, volume pricing beyond",
      "SAML SSO and SCIM provisioning",
      "Audit log and admin oversight tools",
      "Read-only API access for your own tools",
      "Dedicated onboarding specialist",
    ],
  },
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
  const copy = PLAN_COPY[plan];

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
