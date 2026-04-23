import type { ReactNode } from "react";

import { WizardStepper } from "./wizard-stepper";

export type WizardStepProps = {
  /** Kind label (e.g. "Onboarding · Consumer"). Rendered muted in the header. */
  kind: string;
  step: number;
  total: number;
  title: string;
  subtitle?: ReactNode;
  /** Optional callout card above the stepper, e.g. post-checkout confirmation. */
  banner?: ReactNode;
  children: ReactNode;
  /** Footer slot — typically back + continue buttons, or skip links. */
  footer?: ReactNode;
};

/**
 * Shared wizard-step chrome. Matches Atlas "WizardShell" in the auth-onboarding
 * design reference: 560px content column, stepper + eyebrow + serif title +
 * muted subtitle + content + footer. Kept dumb — step bodies supply their own
 * primitives from `ui/` and `match/` so there's no hidden layout logic here.
 */
export function WizardStep({
  kind,
  step,
  total,
  title,
  subtitle,
  banner,
  children,
  footer,
}: WizardStepProps) {
  return (
    <div className="w-full max-w-[560px]">
      {banner}

      <WizardStepper current={step} total={total} className="mb-5" />

      <div className="flex items-center justify-between">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
          Step {step + 1} of {total}
        </p>
        <p className="font-mono text-[11px] text-text-subtle">{kind}</p>
      </div>

      <h1 className="mt-1.5 font-display text-[32px] font-medium leading-[1.15] tracking-[-0.015em] text-text">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-body-sm leading-[1.55] text-text-muted">{subtitle}</p>
      ) : null}

      <div className="mt-6">{children}</div>

      {footer ? (
        <div className="mt-6 flex items-center justify-between gap-3">{footer}</div>
      ) : null}
    </div>
  );
}
