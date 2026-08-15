"use client";

/**
 * The preferences control — the thing that makes "My Preferences" a preference
 * rather than a label.
 *
 * Until this existed the map's hero display mode painted `pref_<mm>`, a score
 * the pipeline baked in from its own defaults, and no UI anywhere could change
 * it. Moving a slider here recolours the map through a paint expression built
 * from the same `scoring.ts` rule the pipeline uses, so the change costs one
 * `setPaintProperty` call and zero tile requests.
 *
 * Three controls, because three variables are what the score consults
 * (`SCORED_VARIABLES` in the pipeline's `build_geojson.py`). The premium
 * variables are shown below them as what they actually are today — additional
 * map layers, not additional scoring inputs.
 */

import { Button } from "@/components/ui/button";
import { DualRangeSlider, RangeSlider } from "@/components/ui/range-slider";
import { cn } from "@/lib/cn";
import { DISPLAY_MODES } from "@/lib/display-modes";
import {
  PREFERENCE_LIMITS,
  isDefaultPreferences,
  type WeatherPreferences,
} from "@/lib/scoring";

import type { PremiumFeature } from "./inline-upgrade-popover";

const PREMIUM_LAYERS = ["snow", "sst", "heat", "humidity"] as const;

export type PreferencesPanelProps = {
  value: WeatherPreferences;
  onChange: (next: WeatherPreferences) => void;
  onReset: () => void;
  isPremium: boolean;
  onUpgradeClick?: (feature: PremiumFeature) => void;
  /** Rendered as a dismissable card on desktop; the sheet supplies its own close. */
  onClose?: () => void;
  className?: string;
};

const fmtTemp = (v: number) => `${Math.round(v)}°C`;
const fmtRain = (v: number) => `${v.toFixed(1)} mm`;
const fmtSun = (v: number) => `${v.toFixed(1)} h`;

export function PreferencesPanel({
  value,
  onChange,
  onReset,
  isPremium,
  onUpgradeClick,
  onClose,
  className,
}: PreferencesPanelProps) {
  const isDefault = isDefaultPreferences(value);

  return (
    <div data-testid="preferences-panel" className={cn("flex flex-col gap-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
            Preferences
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-text-subtle">
            What counts as good weather for you. The map recolours as you change
            it.
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preferences"
            className="-mr-1 -mt-1 shrink-0 rounded-sm p-1.5 text-text-muted outline-none transition hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)]"
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        <DualRangeSlider
          label="Temperature"
          hint="daytime mean"
          value={[value.tempMin, value.tempMax]}
          min={PREFERENCE_LIMITS.temp.min}
          max={PREFERENCE_LIMITS.temp.max}
          step={PREFERENCE_LIMITS.temp.step}
          format={fmtTemp}
          boundLabels={["Coolest acceptable", "Warmest acceptable"]}
          onChange={([tempMin, tempMax]) => onChange({ ...value, tempMin, tempMax })}
        />
        <RangeSlider
          label="Rainfall"
          hint="at most"
          value={value.rainMax}
          min={PREFERENCE_LIMITS.rain.min}
          max={PREFERENCE_LIMITS.rain.max}
          step={PREFERENCE_LIMITS.rain.step}
          format={fmtRain}
          fill="start"
          onChange={(rainMax) => onChange({ ...value, rainMax })}
        />
        <RangeSlider
          label="Sunshine"
          hint="at least"
          value={value.sunMin}
          min={PREFERENCE_LIMITS.sun.min}
          max={PREFERENCE_LIMITS.sun.max}
          step={PREFERENCE_LIMITS.sun.step}
          format={fmtSun}
          fill="end"
          onChange={(sunMin) => onChange({ ...value, sunMin })}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-[11px] leading-relaxed text-text-subtle">
          Scored against 10-year ERA5 medians for the month you are viewing.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={isDefault}
          data-testid="reset-preferences"
        >
          Reset
        </Button>
      </div>

      {isPremium ? null : (
        <div className="rounded-md border border-border bg-surface-2/60 p-3">
          <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-accent">
            Premium map layers
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-text-subtle">
            Four more variables to colour the map by. They are layers of their
            own — the match score above is temperature, rainfall and sunshine.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PREMIUM_LAYERS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onUpgradeClick?.(id)}
                className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface px-2 py-1 text-[11px] text-text-muted outline-none transition hover:border-accent hover:text-text focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)]"
              >
                <LockIcon />
                {DISPLAY_MODES[id].label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </svg>
  );
}
