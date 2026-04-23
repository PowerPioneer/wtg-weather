"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

const DEFAULT_UNITS: UnitChoice = { temp: "C", distance: "km", rain: "mm" };

/**
 * Consumer & agency share this step — pick units + eyeball the defaulted
 * match preferences. Actual value sliders are out of scope for 5.5; we ship
 * the review table only. Premium-only rows are shown dimmed so users see
 * what they'd gain.
 */
export function StepPreferences({
  kind,
  step,
  total,
  initial,
  onBack,
  onContinue,
}: StepPreferencesProps) {
  const [units, setUnits] = useState<UnitChoice>({ ...DEFAULT_UNITS, ...initial });
  const [submitting, setSubmitting] = useState(false);

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
          label="Temperature"
          options={[
            { value: "C", label: "°C", sub: "Celsius" },
            { value: "F", label: "°F", sub: "Fahrenheit" },
          ]}
          selected={units.temp}
          onSelect={(v) => setUnits((u) => ({ ...u, temp: v as UnitChoice["temp"] }))}
        />
        <UnitGroup
          label="Distance"
          options={[
            { value: "km", label: "km", sub: "Kilometres" },
            { value: "mi", label: "mi", sub: "Miles" },
          ]}
          selected={units.distance}
          onSelect={(v) => setUnits((u) => ({ ...u, distance: v as UnitChoice["distance"] }))}
        />
        <UnitGroup
          label="Rainfall"
          options={[
            { value: "mm", label: "mm", sub: "Millimetres" },
            { value: "in", label: "in", sub: "Inches" },
          ]}
          selected={units.rain}
          onSelect={(v) => setUnits((u) => ({ ...u, rain: v as UnitChoice["rain"] }))}
        />

        <div>
          <p className="mb-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
            Defaults for matching
          </p>
          <Card tone="paper" padding="none" bordered elevated={false}>
            <PreferenceRow
              icon={<ThermIcon />}
              label="Temperature"
              sub="Daytime highs, in the range you enjoy"
              value={units.temp === "C" ? "16 – 24 °C" : "61 – 75 °F"}
            />
            <PreferenceRow
              icon={<RainIcon />}
              label="Rainfall"
              sub="Monthly total you'll tolerate"
              value={units.rain === "mm" ? "< 80 mm / month" : "< 3.1 in / month"}
            />
            <PreferenceRow
              icon={<SunIcon />}
              label="Sunshine"
              sub="Hours of daylight you want per day"
              value="≥ 6 hours / day"
            />
            <PreferenceRow
              icon={<WindIcon />}
              label="Wind"
              sub="Average wind speed ceiling"
              value={units.distance === "km" ? "< 30 km/h" : "< 19 mph"}
            />
            <PreferenceRow
              icon={<ShieldIcon />}
              label="Safety ceiling"
              sub="Travel-advisory threshold"
              value="Level 2 or safer"
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
function WindIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 8h12a3 3 0 1 0-3-3M3 14h16a3 3 0 1 1-3 3M3 11h8" />
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
