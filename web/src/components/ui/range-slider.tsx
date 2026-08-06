"use client";

/**
 * Range inputs for the map's preference controls.
 *
 * Both variants are built on native `<input type="range">` rather than a custom
 * pointer-driven widget: the browser's own slider is keyboard-operable, exposes
 * the right ARIA role and value semantics for free, and is what screen readers
 * and switch controls already know how to drive. The Atlas design draws a
 * two-thumb track, which is the one thing a native slider cannot do — so
 * `DualRangeSlider` stacks two transparent native sliders over one painted
 * track. Pointer events are disabled on the input body and re-enabled on the
 * thumbs, so a click on the track never yanks the wrong handle.
 */

import { useId } from "react";

import { cn } from "@/lib/cn";

/**
 * The input is invisible; the visible track is a sibling. Thumbs get their
 * pointer events back so both handles stay independently draggable.
 */
const SLIDER_INPUT = [
  "pointer-events-none absolute inset-x-0 top-0 h-5 w-full cursor-pointer appearance-none bg-transparent",
  "focus:outline-none disabled:cursor-not-allowed",
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4",
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary",
  "[&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow-sm",
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4",
  "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full",
  "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary",
  "[&::-moz-range-thumb]:bg-surface",
].join(" ");

const TRACK_WRAPPER =
  "relative h-5 rounded-full transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[color:var(--color-focus-ring)] has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface";

function pct(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100;
}

function Track({ from, to }: { from: number; to: number }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-sunken"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
        style={{ left: `${from}%`, width: `${Math.max(0, to - from)}%` }}
      />
    </>
  );
}

function Header({
  id,
  label,
  hint,
  readout,
}: {
  id: string;
  label: string;
  hint?: string;
  readout: string;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <span id={id} className="text-[12.5px] font-medium text-text">
          {label}
        </span>
        {hint ? (
          <span className="ml-2 text-[11px] text-text-subtle">{hint}</span>
        ) : null}
      </div>
      <span className="shrink-0 font-mono text-[11px] text-text-muted">{readout}</span>
    </div>
  );
}

export type RangeSliderProps = {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  /** Formats both the readout and the slider's `aria-valuetext`. */
  format: (value: number) => string;
  /**
   * Which side of the thumb reads as "chosen": `start` for a ceiling
   * ("at most this much rain"), `end` for a floor ("at least this much sun").
   */
  fill?: "start" | "end";
  className?: string;
};

export function RangeSlider({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  format,
  fill = "start",
  className,
}: RangeSliderProps) {
  const labelId = useId();
  const position = pct(value, min, max);

  return (
    <div className={className}>
      <Header id={labelId} label={label} hint={hint} readout={format(value)} />
      <div className={TRACK_WRAPPER}>
        <Track
          from={fill === "start" ? 0 : position}
          to={fill === "start" ? position : 100}
        />
        <input
          type="range"
          className={SLIDER_INPUT}
          min={min}
          max={max}
          step={step}
          value={value}
          aria-labelledby={labelId}
          aria-valuetext={format(value)}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </div>
  );
}

export type DualRangeSliderProps = {
  label: string;
  hint?: string;
  value: readonly [number, number];
  min: number;
  max: number;
  step: number;
  onChange: (next: [number, number]) => void;
  format: (value: number) => string;
  /** Distinguishes the two thumbs for assistive tech, e.g. "Coldest / Warmest". */
  boundLabels?: readonly [string, string];
  className?: string;
};

export function DualRangeSlider({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  format,
  boundLabels = ["Minimum", "Maximum"],
  className,
}: DualRangeSliderProps) {
  const labelId = useId();
  const [lo, hi] = value;
  const loPct = pct(lo, min, max);
  const hiPct = pct(hi, min, max);

  return (
    <div className={className}>
      <Header
        id={labelId}
        label={label}
        hint={hint}
        readout={`${format(lo)} – ${format(hi)}`}
      />
      <div className={TRACK_WRAPPER}>
        <Track from={loPct} to={hiPct} />
        <input
          type="range"
          // Above the upper thumb once the band is squeezed to the top of the
          // scale, where the two handles would otherwise sit on top of each
          // other and only the last-painted one could be grabbed.
          className={cn(SLIDER_INPUT, loPct > 90 ? "z-20" : "z-10")}
          min={min}
          max={max}
          step={step}
          value={lo}
          aria-label={`${label} — ${boundLabels[0]}`}
          aria-valuetext={format(lo)}
          onChange={(event) => {
            const next = Math.min(Number(event.target.value), hi);
            onChange([next, hi]);
          }}
        />
        <input
          type="range"
          className={cn(SLIDER_INPUT, "z-10")}
          min={min}
          max={max}
          step={step}
          value={hi}
          aria-label={`${label} — ${boundLabels[1]}`}
          aria-valuetext={format(hi)}
          onChange={(event) => {
            const next = Math.max(Number(event.target.value), lo);
            onChange([lo, next]);
          }}
        />
      </div>
    </div>
  );
}
