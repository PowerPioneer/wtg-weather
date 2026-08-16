"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createOrg,
  patchOnboarding,
  type OnboardingState,
} from "@/lib/api-client";
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

/** A resumed wizard carries the org it already created in its saved data. */
function asId(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Client-side state machine for the 4-step agency onboarding wizard:
 * org setup → preferences → sample trip → premium.
 *
 * Step 0 **creates the organization**. It used to file the collected name into
 * `onboarding.data` and move on, so a user could complete the whole agency
 * flow without an organization existing: `/account` then found no `session.org`
 * and 404'd, and the premium step had no `organization_id` to attach seats to,
 * which is the one thing an agency checkout needs. The id created here is held
 * in local state as well as pushed to the session, because the session only
 * catches up on the next server render and the checkout step is two clicks
 * away.
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
  const [orgId, setOrgId] = useState<string | undefined>(
    organizationId ?? asId(initial.data?.organizationId),
  );
  const [orgError, setOrgError] = useState<string | null>(null);
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
    setOrgError(null);
    // Idempotent on a resumed wizard: if an org already exists for this user
    // we keep it rather than creating a second one they would then have to
    // pick between.
    let id = orgId;
    if (!id) {
      try {
        id = (await createOrg(value.orgName)).id;
        setOrgId(id);
      } catch {
        setOrgError(
          "We couldn't create your organisation just then. Try again.",
        );
        return;
      }
    }
    await advance(1, { org: value, organizationId: id });
    // So the account shell and the checkout step see the new membership.
    router.refresh();
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
        error={orgError}
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
        organizationId={orgId}
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
