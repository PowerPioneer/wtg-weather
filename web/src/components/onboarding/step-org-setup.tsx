"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { WizardStep } from "./wizard-step";

export type OrgSetupValue = {
  orgName: string;
  orgSlug: string;
  orgRegion: string;
};

export type StepOrgSetupProps = {
  kind: string;
  step: number;
  total: number;
  initial?: Partial<OrgSetupValue>;
  onBack?: () => void;
  onContinue: (value: OrgSetupValue) => Promise<void> | void;
};

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Agency wizard step 1 — capture agency name, URL slug, and base region. The
 * slug auto-derives from the name while the user hasn't touched it; once they
 * edit the slug field directly we stop overwriting it.
 */
export function StepOrgSetup({
  kind,
  step,
  total,
  initial,
  onBack,
  onContinue,
}: StepOrgSetupProps) {
  const [orgName, setOrgName] = useState(initial?.orgName ?? "");
  const [orgSlug, setOrgSlug] = useState(initial?.orgSlug ?? "");
  const [orgRegion, setOrgRegion] = useState(initial?.orgRegion ?? "");
  const [slugDirty, setSlugDirty] = useState(Boolean(initial?.orgSlug));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugValid = orgSlug === "" || SLUG_RE.test(orgSlug);
  const canContinue =
    orgName.trim().length >= 2 && SLUG_RE.test(orgSlug) && orgRegion.trim().length > 0;

  function handleNameChange(v: string) {
    setOrgName(v);
    if (!slugDirty) setOrgSlug(slugify(v));
  }

  async function handleContinue() {
    if (!canContinue) {
      setError("Fill in your agency name, a URL handle, and a base region.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onContinue({
        orgName: orgName.trim(),
        orgSlug,
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
            onChange={(e) => handleNameChange(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="org-slug" className="mb-1.5 block">
            URL handle
          </Label>
          <div className="flex items-stretch overflow-hidden rounded-md border border-border-strong bg-surface">
            <span className="flex items-center px-3 font-mono text-[12px] text-text-subtle">
              wtg.app/a/
            </span>
            <Input
              id="org-slug"
              autoComplete="off"
              placeholder="wanderline"
              value={orgSlug}
              invalid={!slugValid}
              onChange={(e) => {
                setSlugDirty(true);
                setOrgSlug(e.target.value.toLowerCase());
              }}
              className="rounded-none border-0 bg-transparent"
            />
          </div>
          <p className="mt-1.5 font-mono text-[11px] text-text-subtle">
            Lowercase letters, numbers, hyphens. 2–40 characters.
          </p>
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

        {error ? (
          <p role="alert" className="text-[12px] text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </WizardStep>
  );
}
