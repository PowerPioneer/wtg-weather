"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { WizardStep } from "./wizard-step";

export type OrgSetupValue = {
  orgName: string;
  orgRegion: string;
};

export type StepOrgSetupProps = {
  kind: string;
  step: number;
  total: number;
  initial?: Partial<OrgSetupValue>;
  onBack?: () => void;
  onContinue: (value: OrgSetupValue) => Promise<void> | void;
  /** Surfaced when the org could not be created — the step cannot advance. */
  error?: string | null;
};

/**
 * Agency wizard step 1 — the organization's name and base region.
 *
 * Continuing from here **creates the organization** (`POST /api/orgs`) and
 * makes the caller its owner; the wizard used to collect these three fields
 * and file them in `onboarding.data`, so a user could finish the agency flow
 * with no organization to their name and an account page that had nothing to
 * render.
 *
 * The URL-handle field is gone. It offered `wtg.app/a/<slug>` and no such
 * route exists or is planned — `Organization` carries no slug column, and
 * `components/account/agency-sections.tsx` left the decision to WS-C. Asking
 * somebody to choose a permanent handle for a URL that resolves to nothing is
 * the same fabrication as printing a renewal date we do not have.
 */
export function StepOrgSetup({
  kind,
  step,
  total,
  initial,
  onBack,
  onContinue,
  error: externalError,
}: StepOrgSetupProps) {
  const [orgName, setOrgName] = useState(initial?.orgName ?? "");
  const [orgRegion, setOrgRegion] = useState(initial?.orgRegion ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = orgName.trim().length >= 2 && orgRegion.trim().length > 0;

  async function handleContinue() {
    if (!canContinue) {
      setError("Fill in your agency name and a base region.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onContinue({
        orgName: orgName.trim(),
        orgRegion: orgRegion.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <WizardStep
      kind={kind}
      step={step}
      total={total}
      title="Set up your agency"
      subtitle="A few details so your team can share trips under one roof. You can rename or restructure later from Settings → Organization."
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
            onClick={handleContinue}
            loading={submitting}
            iconAfter={<span aria-hidden>→</span>}
          >
            Continue
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <Label htmlFor="org-name" className="mb-1.5 block">
            Agency name
          </Label>
          <Input
            id="org-name"
            autoFocus
            autoComplete="organization"
            placeholder="Wanderline Travel Co."
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="org-region" className="mb-1.5 block">
            Base region
          </Label>
          <Input
            id="org-region"
            autoComplete="address-level1"
            placeholder="e.g. London, UK"
            value={orgRegion}
            onChange={(e) => setOrgRegion(e.target.value)}
          />
          <p className="mt-1.5 font-mono text-[11px] text-text-subtle">
            Used to bias default units and safety advisories for your team.
          </p>
        </div>

        {(error ?? externalError) ? (
          <p role="alert" className="text-[12px] text-destructive">
            {error ?? externalError}
          </p>
        ) : null}
      </div>
    </WizardStep>
  );
}
