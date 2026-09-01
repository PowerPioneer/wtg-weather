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
 * Three climate controls, because three variables are what the score consults
 * (`SCORED_VARIABLES` in the pipeline's `build_geojson.py`). The premium
 * variables are shown below them as what they actually are today — additional
 * map layers, not additional scoring inputs.
 *
 * Two more controls sit with them and are not scoring inputs either:
 *
 *   - the advisory limit, which vetoes a place rather than scoring it, and
 *   - the °C/°F switch, which changes no value at all, only its rendering.
 *
 * Both live here because this panel is where a traveller says what they want,
 * and both were controls the v1 site had that this one did not.
 */

import { Button } from "@/components/ui/button";
import { LevelSlider, type SliderLevel } from "@/components/ui/level-slider";
import { DualRangeSlider, RangeSlider } from "@/components/ui/range-slider";
import { UnitToggle, useUnit } from "@/components/units";
import { cn } from "@/lib/cn";
import { DISPLAY_MODES } from "@/lib/display-modes";
import {
  PREFERENCE_LIMITS,
  RAIN_LEVELS,
  RAIN_LEVEL_BLURB,
  SAFETY_LIMIT_BLURB,
  SAFETY_LIMIT_LABEL,
  clampSafetyMax,
  isDefaultPreferenceSet,
  rainCeilingForLevel,
  rainLevelForCeiling,
  type AdvisoryLimit,
  type RainLevel,
  type WeatherPreferences,
} from "@/lib/scoring";
import { formatTemperature, type UnitSystem } from "@/lib/units";

import type { PremiumFeature } from "./inline-upgrade-popover";

const PREMIUM_LAYERS = ["snow", "sst", "heat", "humidity"] as const;

/** One word each — five stops share a phone's width. */
const RAIN_TICK: Record<RainLevel["level"], string> = {
  1: "Dry",
  2: "Light",
  3: "Moderate",
  4: "Rainy",
  5: "Very wet",
};

/** Rain stops, in the level slider's shape. */
const RAIN_SLIDER_LEVELS: readonly SliderLevel[] = RAIN_LEVELS.map((level) => ({
  level: level.level,
  label: level.label,
  tick: RAIN_TICK[level.level],
  detail: level.band,
}));

/**
 * Advisory stops, painted in the legend's own colours so the control reads as
 * the same scale the Safety layer paints.
 *
 * The hexes are read out of `DISPLAY_MODES.safety` rather than repeated: the
 * legend and this control have to agree, and a hard-coded copy here is how
 * they would come to disagree. `legend` is a union — a ramp or bins — so the
 * bins are narrowed once, at module scope, and fall back to no swatch at all
 * rather than to invented colours.
 */
const SAFETY_LEGEND = DISPLAY_MODES.safety.legend;
const SAFETY_BINS = "bins" in SAFETY_LEGEND ? SAFETY_LEGEND.bins : [];

const SAFETY_TICK: Record<AdvisoryLimit, string> = {
  1: "Normal",
  2: "Caution",
  3: "Reconsider",
  4: "Any",
};

const SAFETY_SLIDER_LEVELS: readonly SliderLevel[] = (
  [1, 2, 3, 4] as const
).map((level) => ({
  level,
  label: SAFETY_LIMIT_LABEL[level],
  tick: SAFETY_TICK[level],
  hex: SAFETY_BINS[level - 1]?.hex,
}));

export type PreferencesPanelProps = {
  value: WeatherPreferences;
  onChange: (next: WeatherPreferences) => void;
  /**
   * Called when the traveller switches °C/°F. The unit itself is stored by
   * `UnitProvider` for the whole site; the map passes this so it can mirror
   * the choice into the URL, keeping a shared link honest about its units.
   */
  onUnitChange?: (next: UnitSystem) => void;
  onReset: () => void;
  isPremium: boolean;
  onUpgradeClick?: (feature: PremiumFeature) => void;
  /** Rendered as a dismissable card on desktop; the sheet supplies its own close. */
  onClose?: () => void;
  /**
   * The mobile sheet has its own title and description, so the panel's would
   * be the second heading in a row saying the same thing.
   */
  showHeading?: boolean;
  className?: string;
};

const fmtSun = (v: number) => `${v.toFixed(1)} h`;

export function PreferencesPanel({
  value,
  onChange,
  onUnitChange,
  onReset,
  isPremium,
  onUpgradeClick,
  onClose,
  showHeading = true,
  className,
}: PreferencesPanelProps) {
  const isDefault = isDefaultPreferenceSet(value);
  const { unit } = useUnit();
  const rainLevel = rainLevelForCeiling(value.rainMax);
  const safetyMax = clampSafetyMax(value.safetyMax);

  const fmtTemp = (v: number) => formatTemperature(v, unit);

  return (
    <div data-testid="preferences-panel" className={cn("flex flex-col gap-5", className)}>
      {showHeading || onClose ? (
        <div className="flex items-start justify-between gap-3">
          {showHeading ? (
            <div className="min-w-0">
              <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
                Preferences
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-text-subtle">
                What counts as good weather for you. The map recolours as you
                change it.
              </p>
            </div>
          ) : (
            <span />
          )}
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
      ) : null}

      <div className="flex flex-col gap-4">
        {/*
          Two controls, because the site now publishes two numbers. This said
          "daytime mean" while scoring the 24-hour mean, so a traveller who set
          18–28 thinking about afternoons was matched against places whose
          afternoons ran 24–34.

          They are one *concern* for scoring — the worse of the two decides
          temperature, see `scoreBucket` — but two questions for a person, and
          the night one is the reason the split exists: a tropical night that
          holds 27 °C used to average with a 30 °C day into a perfect match.
        */}
        <DualRangeSlider
          label="Daytime high"
          hint="mean daily maximum"
          value={[value.dayMin, value.dayMax]}
          min={PREFERENCE_LIMITS.day.min}
          max={PREFERENCE_LIMITS.day.max}
          step={PREFERENCE_LIMITS.day.step}
          format={fmtTemp}
          boundLabels={["Coolest acceptable", "Warmest acceptable"]}
          onChange={([dayMin, dayMax]) => onChange({ ...value, dayMin, dayMax })}
        />
        <DualRangeSlider
          label="Overnight low"
          hint="mean daily minimum"
          value={[value.nightMin, value.nightMax]}
          min={PREFERENCE_LIMITS.night.min}
          max={PREFERENCE_LIMITS.night.max}
          step={PREFERENCE_LIMITS.night.step}
          format={fmtTemp}
          boundLabels={["Coldest acceptable", "Warmest acceptable"]}
          onChange={([nightMin, nightMax]) => onChange({ ...value, nightMin, nightMax })}
        />
        {/*
          Levels, not millimetres. Nobody holds a preference in mm/day, and
          asking for one asked the traveller to do a conversion they have no
          reference points for. The ceiling each level selects is in
          `RAIN_LEVELS`; the scoring rule below it is unchanged.
        */}
        <LevelSlider
          label="Rainfall"
          hint="at most"
          levels={RAIN_SLIDER_LEVELS}
          value={rainLevel.level}
          description={RAIN_LEVEL_BLURB[rainLevel.level]}
          fill="start"
          onChange={(level) =>
            onChange({ ...value, rainMax: rainCeilingForLevel(level) })
          }
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
        {/*
          Safety is a veto over the other three rather than a fourth ingredient
          of the score: a place worse than this reads "Avoid" whatever its
          weather does. It is not part of the pipeline's baked score — the
          answer differs per traveller — so it is applied in the paint
          expression and in `scoreBucket` alike.
        */}
        <LevelSlider
          label="Accept advisories up to"
          levels={SAFETY_SLIDER_LEVELS}
          value={safetyMax}
          description={SAFETY_LIMIT_BLURB[safetyMax]}
          onChange={(level) =>
            onChange({ ...value, safetyMax: clampSafetyMax(level) })
          }
        />
        <UnitToggle
          label="Temperature unit"
          hint={unit === "imperial" ? "°F, inches, mph" : "°C, mm, km/h"}
          onChange={onUnitChange}
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
          <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-accent-text">
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
