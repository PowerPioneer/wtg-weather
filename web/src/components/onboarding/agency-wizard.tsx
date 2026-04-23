"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { patchOnboarding, type OnboardingState } from "@/lib/api-client";
import type { AccountPlan } from "@/lib/types";
import { PremiumBanner } from "./premium-banner";
import { StepOrgSetup, type OrgSetupValue } from "./step-org-setup";
import { StepPreferences, type PreferencesValue } from "./step-preferences";
import { StepPremium } from "./step-premium";
import { StepSampleTrip } from "./step-sample-trip";

export type AgencyWizardProps = {
  initial: OnboardingState;
  plan: AccountPlan;
  /** Organization id once the session reflects one — required for Paddle checkout handoff. */
  organizationId?: string;
};

const KIND_LABEL = "Onboarding · Agency";
const TOTAL = 4;

/**
 * Client-side state machine for the 4-step agency onboarding wizard:
 * org setup → preferences → sample trip → premium. `organizationId` lives on
 * the session once step 0 completes — until then the premium step can't be
 * reached without it, so the wizard enforces ordering.
 */
export function AgencyWizard({
  initial,
  plan,
  organizationId,
}: AgencyWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(() => Math.min(initial.step, TOTAL - 1));
  const [data, setData] = useState<Record<string, unknown>>(initial.data ?? {});
  const [isPending, startTransition] = useTransition();
  const alreadyPremium = plan !== "free";

  async function advance(nextStep: number, patch?: Record<string, unknown>) {
    const mergedData = patch ? { ...data, ...patch } : data;
    if (patch) setData(mergedData);
    await patchOnboarding({
      kind: "agency",
      step: nextStep,
      data: mergedData,
    });
    setStep(nextStep);
  }

  async function handleOrgSetup(value: OrgSetupValue) {
    await advance(1, { org: value });
  }

  async function handlePreferences(value: PreferencesValue) {
    await advance(2, { units: value.units });
  }

  async function handleSampleTrip() {
    await advance(3);
  }

  async function finishOnboarding() {
    await patchOnboarding({
      kind: "agency",
      step: TOTAL,
      data,
      completed: true,
    });
    startTransition(() => {
      router.push("/map");
      router.refresh();
    });
  }

  const banner = alreadyPremium ? <PremiumBanner plan="Agency Pro" /> : undefined;

  let body: React.ReactNode;
  if (step === 0) {
    body = (
      <StepOrgSetup
        kind={KIND_LABEL}
        step={0}
        total={TOTAL}
        initial={(data.org as OrgSetupValue) ?? undefined}
        onContinue={handleOrgSetup}
      />
    );
  } else if (step === 1) {
    body = (
      <StepPreferences
        kind={KIND_LABEL}
        step={1}
        total={TOTAL}
        initial={(data.units as PreferencesValue["units"]) ?? undefined}
        onBack={() => setStep(0)}
        onContinue={handlePreferences}
      />
    );
  } else if (step === 2) {
    body = (
      <StepSampleTrip
        kind={KIND_LABEL}
        step={2}
        total={TOTAL}
        onBack={() => setStep(1)}
        onContinue={handleSampleTrip}
      />
    );
  } else {
    body = (
      <StepPremium
        kind={KIND_LABEL}
        step={3}
        total={TOTAL}
        plan="agency_pro"
        organizationId={organizationId}
        alreadyPremium={alreadyPremium}
        onBack={() => setStep(2)}
        onSkip={finishOnboarding}
        onFinish={finishOnboarding}
      />
    );
  }

  if (!banner) return body;
  return (
    <div className="w-full max-w-[560px]">
      {banner}
      {body}
      {isPending ? <span className="sr-only">Loading the map…</span> : null}
    </div>
  );
}
