"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { patchOnboarding, type OnboardingState } from "@/lib/api-client";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import type { AccountPlan } from "@/lib/types";
import { PremiumBanner } from "./premium-banner";
import { StepPreferences, type PreferencesValue } from "./step-preferences";
import { StepPremium } from "./step-premium";
import { StepSampleTrip } from "./step-sample-trip";

export type ConsumerWizardProps = {
  initial: OnboardingState;
  /** User's current plan — drives whether the premium step shows the card or a "you're set" message. */
  plan: AccountPlan;
};

const KIND_LABEL = "Onboarding · Consumer";
const TOTAL = 3;

/**
 * Client-side state machine for the 3-step consumer onboarding wizard:
 * preferences → sample trip → premium. Each transition persists via
 * `/api/onboarding` PATCH so the user can refresh mid-wizard and resume.
 * The premium step hands off to Paddle sandbox via `PremiumPlanCard`.
 */
export function ConsumerWizard({ initial, plan }: ConsumerWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(() => Math.min(initial.step, TOTAL - 1));
  const [data, setData] = useState<Record<string, unknown>>(initial.data ?? {});
  const [isPending, startTransition] = useTransition();
  const alreadyPremium = plan !== "free";

  async function advance(
    nextStep: number,
    patch?: Record<string, unknown>,
    completed?: boolean,
  ) {
    const mergedData = patch ? { ...data, ...patch } : data;
    if (patch) setData(mergedData);
    await patchOnboarding({
      kind: "consumer",
      step: nextStep,
      data: mergedData,
      ...(completed ? { completed: true } : {}),
    });
    setStep(nextStep);
  }

  async function handlePreferences(value: PreferencesValue) {
    await advance(1, { units: value.units });
  }

  async function handleSampleTrip() {
    trackEvent(ANALYTICS_EVENTS.tripSaved, { source: "onboarding_consumer" });
    await advance(2);
  }

  async function finishOnboarding() {
    await patchOnboarding({
      kind: "consumer",
      step: TOTAL,
      data,
      completed: true,
    });
    startTransition(() => {
      router.push("/map");
      router.refresh();
    });
  }

  const banner = alreadyPremium ? <PremiumBanner plan="Premium" /> : undefined;

  if (step === 0) {
    return (
      <WithBanner banner={banner}>
        <StepPreferences
          kind={KIND_LABEL}
          step={0}
          total={TOTAL}
          initial={(data.units as PreferencesValue["units"]) ?? undefined}
          onContinue={handlePreferences}
        />
      </WithBanner>
    );
  }

  if (step === 1) {
    return (
      <WithBanner banner={banner}>
        <StepSampleTrip
          kind={KIND_LABEL}
          step={1}
          total={TOTAL}
          onBack={() => setStep(0)}
          onContinue={handleSampleTrip}
        />
      </WithBanner>
    );
  }

  return (
    <WithBanner banner={banner}>
      <StepPremium
        kind={KIND_LABEL}
        step={2}
        total={TOTAL}
        plan="consumer_premium"
        alreadyPremium={alreadyPremium}
        onBack={() => setStep(1)}
        onSkip={finishOnboarding}
        onFinish={finishOnboarding}
      />
      {isPending ? <span className="sr-only">Loading the map…</span> : null}
    </WithBanner>
  );
}

function WithBanner({
  banner,
  children,
}: {
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!banner) return <>{children}</>;
  return (
    <div className="w-full max-w-[560px]">
      {banner}
      {children}
    </div>
  );
}
