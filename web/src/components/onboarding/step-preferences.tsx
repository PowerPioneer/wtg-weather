"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUnit } from "@/components/units";
import {
  DEFAULT_PREFERENCES,
  SAFETY_LIMIT_LABEL,
  rainLevelForCeiling,
} from "@/lib/scoring";
import {
  UNIT_COOKIE,
  formatTemperatureRange,
  type UnitSystem,
} from "@/lib/units";
import { OptionTile } from "./option-tile";
import { PreferenceRow } from "./preference-row";
import { WizardStep } from "./wizard-step";

export type UnitChoice = {
  temp: "C" | "F";
  distance: "km" | "mi";
  rain: "mm" | "in";
};

export type PreferencesValue = {
  units: UnitChoice;
};

export type StepPreferencesProps = {
  kind: string;
  step: number;
  total: number;
  initial?: Partial<UnitChoice>;
  onBack?: () => void;
  onContinue: (value: PreferencesValue) => Promise<void> | void;
};

/** The three-key blob the wizard has always stored, derived from one system. */
function unitChoiceFor(unit: UnitSystem): UnitChoice {
  return unit === "imperial"
    ? { temp: "F", distance: "mi", rain: "in" }
    : { temp: "C", distance: "km", rain: "mm" };
}

/**
 * Consumer & agency share this step — pick units + eyeball the defaults that
 * will be used to score destinations. The value sliders live on the map; this
 * is the review table. Premium-only rows are dimmed so users see what they
 * would gain.
 *
 * Two things here used to be decorative and are not any more:
 *
 *   - The unit choice now sets the site-wide preference (`UnitProvider`)
 *     rather than being written into the onboarding blob and forgotten. It is
 *     also one choice rather than three, because the site has one switch:
 *     °F with millimetres was a state a visitor could ask for and never get.
 *   - The review rows read `DEFAULT_PREFERENCES` instead of restating it.
 *     They previously advertised a 16–24 °C band, an 80 mm/month rainfall
 *     ceiling and a wind limit — none of which is what anything scores, and
 *     the wind row named a variable no scoring rule consults at all.
 */
export function StepPreferences({
  kind,
  step,
  total,
  initial,
  onBack,
  onContinue,
}: StepPreferencesProps) {
  const { unit, setUnit, ready } = useUnit();
  const [submitting, setSubmitting] = useState(false);

  // A returning user's stored choice, applied once. The provider reads this
  // browser's cookie, which a second device does not have — the record is the
  // only thing that crosses devices. It defers to the cookie when there is
  // one, on the same "what this browser last chose wins over history" rule
  // the rest of the wizard follows.
  const seeded = useRef(false);
  useEffect(() => {
    if (!ready || seeded.current) return;
    seeded.current = true;
    if (!initial?.temp) return;
    if (document.cookie.includes(`${UNIT_COOKIE}=`)) return;
    setUnit(initial.temp === "F" ? "imperial" : "metric");
  }, [initial?.temp, ready, setUnit]);

  // The stored blob keeps its shape — three keys, as every record written so
  // far has — but it is now derived from the one system rather than being an
  // independent source of truth that nothing read back.
  const units = unitChoiceFor(unit);

  async function handleContinue() {
    setSubmitting(true);
    try {
      await onContinue({ units });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <WizardStep
      kind={kind}
      step={step}
      total={total}
      title="Set your ideal weather"
      subtitle="Tell us how to measure things, then review the defaults we'll use when scoring destinations. You can change any of this from Settings later."
      footer={
        <>
          {onBack ? (
            <Button variant="secondary" onClick={onBack} type="button">
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={handleContinue} loading={submitting} iconAfter={<span aria-hidden>→</span>}>
            Looks good
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <UnitGroup
          label="Units"
          options={[
            { value: "metric", label: "°C", sub: "mm · km/h" },
            { value: "imperial", label: "°F", sub: "inches · mph" },
          ]}
          selected={unit}
          onSelect={setUnit}
        />

        <div>
          <p className="mb-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
            Defaults for matching
          </p>
          <Card tone="paper" padding="none" bordered elevated={false}>
            <PreferenceRow
              icon={<ThermIcon />}
              label="Temperature"
              sub="Daytime mean, in the range you enjoy"
              value={formatTemperatureRange(
                DEFAULT_PREFERENCES.tempMin,
                DEFAULT_PREFERENCES.tempMax,
                unit,
              )}
            />
            <PreferenceRow
              icon={<RainIcon />}
              label="Rainfall"
              sub="How wet a month you will put up with"
              value={`${rainLevelForCeiling(DEFAULT_PREFERENCES.rainMax).label} or drier`}
            />
            <PreferenceRow
              icon={<SunIcon />}
              label="Sunshine"
              sub="Hours of sun you want per day"
              value={`≥ ${DEFAULT_PREFERENCES.sunMin} hours / day`}
            />
            <PreferenceRow
              icon={<ShieldIcon />}
              label="Safety ceiling"
              sub="Worst travel advisory you will consider"
              value={SAFETY_LIMIT_LABEL[DEFAULT_PREFERENCES.safetyMax]}
            />
            <PreferenceRow
              icon={<DropIcon />}
              label="Humidity + heat index"
              sub="Unlock on Premium"
              value="—"
              premium
            />
          </Card>
        </div>
      </div>
    </WizardStep>
  );
}

type UnitGroupProps<V extends string> = {
  label: string;
  options: readonly { value: V; label: string; sub: string }[];
  selected: V;
  onSelect: (v: V) => void;
};

function UnitGroup<V extends string>({
  label,
  options,
  selected,
  onSelect,
}: UnitGroupProps<V>) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
        {label}
      </p>
      <div className="flex gap-2.5">
        {options.map((o) => (
          <OptionTile
            key={o.value}
            label={o.label}
            sub={o.sub}
            selected={selected === o.value}
            onClick={() => onSelect(o.value)}
          />
        ))}
      </div>
    </div>
  );
}

function ThermIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M14 14V5a2 2 0 1 0-4 0v9a4 4 0 1 0 4 0z" />
      <circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
function RainIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 16a5 5 0 1 1 9-4 4 4 0 0 1-1 8H8a3 3 0 0 1-1-4z" />
      <path d="M9 20l-1 2M13 20l-1 2M17 20l-1 2" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
    </svg>
  );
}
function DropIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3s6 7 6 12a6 6 0 1 1-12 0c0-5 6-12 6-12z" />
    </svg>
  );
}
