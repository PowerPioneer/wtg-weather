"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScoreGauge } from "@/components/match/score-gauge";
import { WizardStep } from "./wizard-step";

export type StepSampleTripProps = {
  kind: string;
  step: number;
  total: number;
  onBack?: () => void;
  onContinue: () => Promise<void> | void;
};

/**
 * Concrete "look what we found for you" step. Not a real search — shows a
 * pre-baked destination card so the user sees what scoring will look like
 * once they're on the map. No data fetch; keeps the wizard zero-dependency.
 */
export function StepSampleTrip({
  kind,
  step,
  total,
  onBack,
  onContinue,
}: StepSampleTripProps) {
  return (
    <WizardStep
      kind={kind}
      step={step}
      total={total}
      title="Here's a destination that matches"
      subtitle="We used your defaults to score one country for next month. Any time you change preferences or month, every country on the map re-scores instantly."
      footer={
        <>
          {onBack ? (
            <Button variant="secondary" onClick={onBack} type="button">
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => void onContinue()} iconAfter={<span aria-hidden>→</span>}>
            Continue
          </Button>
        </>
      }
    >
      <Card padding="lg" elevated>
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
              Recommended · next month
            </p>
            <h2 className="mt-2 font-display text-[24px] font-medium leading-tight tracking-[-0.012em] text-text">
              Peru · Arequipa region
            </h2>
            <p className="mt-2 text-body-sm leading-[1.55] text-text-muted">
              Dry season in the high Andes — low rainfall, mild daytime highs,
              long sunshine hours. Safety advisories level 1.
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-x-4 gap-y-2 font-mono text-[12px]">
              <StatCell label="Temp" value="18 – 22 °C" />
              <StatCell label="Rain" value="12 mm" />
              <StatCell label="Sun" value="9.4 h/d" />
            </dl>
          </div>
          <div className="shrink-0">
            <ScoreGauge score={86} size="lg" label="Excellent match" />
          </div>
        </div>
      </Card>

      <p className="mt-4 text-center font-mono text-[11px] text-text-subtle">
        Tip · save trips to come back any time from your account.
      </p>
    </WizardStep>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.12em] text-text-subtle">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  );
}
