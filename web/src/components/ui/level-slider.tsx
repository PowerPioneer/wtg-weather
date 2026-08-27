"use client";

/**
 * A slider whose stops are named things rather than numbers.
 *
 * Two controls need this and both need it for the same reason: "3 mm/day" and
 * "advisory level 3" are units a traveller has no feel for, while "light rain"
 * and "reconsider travel" are the words they already think in. The underlying
 * value is still a number — the scoring rule and the tiles are unchanged — but
 * the control is labelled in the vocabulary of the decision.
 *
 * Native `<input type="range">` with `step={1}` over the level indices, for the
 * same reasons `range-slider.tsx` gives: real keyboard support, real ARIA
 * value semantics, and `aria-valuetext` carrying the word so a screen reader
 * announces "Light rain" instead of "2".
 */

import { useId } from "react";

import { cn } from "@/lib/cn";

export type SliderLevel = {
  /** 1-based position on the track. */
  level: number;
  /** The word shown for this stop. */
  label: string;
  /**
   * Shorter form for the tick row under the track, where five stops share the
   * width of a phone. Without it "Reconsider travel" and "Moderate rain"
   * ellipsis away to "RECONSIDER TR…", which names nothing. Falls back to
   * `label`.
   */
  tick?: string;
  /** Small print under the label — the numeric band it stands for. */
  detail?: string;
  /** Swatch colour, where the levels carry one (the advisory ramp). */
  hex?: string;
};

export type LevelSliderProps = {
  label: string;
  hint?: string;
  levels: readonly SliderLevel[];
  value: number;
  onChange: (level: number) => void;
  /** Sentence under the control describing what the current stop means. */
  description?: string;
  /** Which side of the thumb reads as "chosen". */
  fill?: "start" | "end";
  className?: string;
};

const SLIDER_INPUT = [
  "absolute inset-x-0 top-0 h-5 w-full cursor-pointer appearance-none bg-transparent",
  "focus:outline-none",
  "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4",
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary",
  "[&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow-sm",
  "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4",
  "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full",
  "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary",
  "[&::-moz-range-thumb]:bg-surface",
].join(" ");

export function LevelSlider({
  label,
  hint,
  levels,
  value,
  onChange,
  description,
  fill = "start",
  className,
}: LevelSliderProps) {
  const labelId = useId();
  const min = 1;
  const max = levels.length;
  const current = levels.find((l) => l.level === value) ?? levels[0];
  // Thumb sits at the centre of its stop's share of the track, so the ticks
  // below line up with the positions the thumb can actually occupy.
  const position = ((value - min) / Math.max(1, max - min)) * 100;

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span id={labelId} className="text-[12.5px] font-medium text-text">
            {label}
          </span>
          {hint ? (
            <span className="ml-2 text-[11px] text-text-subtle">{hint}</span>
          ) : null}
        </div>
        <span className="shrink-0 text-right text-[11.5px] font-medium text-text">
          {current.label}
          {current.detail ? (
            <span className="ml-1.5 font-mono text-[10.5px] font-normal text-text-muted">
              ({current.detail})
            </span>
          ) : null}
        </span>
      </div>

      <div className="relative h-5 rounded-full transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[color:var(--color-focus-ring)] has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-surface-sunken"
        >
          {/* Levels that carry their own colours paint the whole track with
              them, so the control looks like the legend it is filtering. */}
          {levels.some((l) => l.hex) ? (
            <span className="flex h-full w-full">
              {levels.map((l) => (
                <span
                  key={l.level}
                  className="h-full flex-1"
                  style={{ backgroundColor: l.hex }}
                />
              ))}
            </span>
          ) : null}
        </span>
        {levels.some((l) => l.hex) ? null : (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
            style={
              fill === "start"
                ? { left: 0, width: `${position}%` }
                : { left: `${position}%`, right: 0 }
            }
          />
        )}
        <input
          type="range"
          className={SLIDER_INPUT}
          min={min}
          max={max}
          step={1}
          value={value}
          aria-labelledby={labelId}
          aria-valuetext={
            current.detail ? `${current.label}, ${current.detail}` : current.label
          }
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>

      <div
        aria-hidden="true"
        className="mt-1.5 flex justify-between gap-1 font-mono text-[9.5px] uppercase tracking-[0.06em] text-text-subtle"
      >
        {levels.map((l) => (
          <span
            key={l.level}
            className={cn(
              "min-w-0 flex-1 truncate",
              l.level === 1 && "text-left",
              l.level === max && "text-right",
              l.level !== 1 && l.level !== max && "text-center",
              l.level === value && "font-semibold text-text",
            )}
          >
            {l.tick ?? l.label}
          </span>
        ))}
      </div>

      {description ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-text-subtle">
          {description}
        </p>
      ) : null}
    </div>
  );
}
