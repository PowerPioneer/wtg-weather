import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";
import {
  SCORE_BG_CLASS,
  clampScore,
  scoreBin,
  scoreShortLabel,
} from "@/lib/scoring";

export type ScoreBadgeProps = {
  score: number;
  size?: "sm" | "md" | "lg";
  /**
   * - `number` (default): pill shows the bare score.
   * - `verbose`: pill shows the score and the short bin label.
   * - `auto`: `number` at `sm`, `verbose` at `md`/`lg`.
   *
   * The bin label is always present in the accessible name, regardless of
   * `label`, so screen readers never receive a bare integer.
   */
  label?: "auto" | "number" | "verbose";
} & Omit<HTMLAttributes<HTMLSpanElement>, "children">;

const SIZE_CLASSES = {
  sm: "h-[22px] min-w-9 px-2 text-[11px]",
  md: "h-[26px] min-w-11 px-2.5 text-[13px]",
  lg: "h-9 min-w-14 px-3 text-base",
} as const;

export function ScoreBadge({
  score,
  size = "md",
  label = "auto",
  className,
  ...rest
}: ScoreBadgeProps) {
  const clamped = clampScore(score);
  const bin = scoreBin(clamped);
  const roundedScore = Math.round(clamped);
  const shortLabel = scoreShortLabel(clamped);

  const resolvedLabel =
    label === "auto" ? (size === "sm" ? "number" : "verbose") : label;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-sm font-mono font-semibold text-text-inverse",
        SCORE_BG_CLASS[bin],
        SIZE_CLASSES[size],
        className,
      )}
      role="img"
      aria-label={`${roundedScore} out of 100 — ${shortLabel}`}
      {...rest}
    >
      <span aria-hidden="true">{roundedScore}</span>
      {resolvedLabel === "verbose" ? (
        <span
          aria-hidden="true"
          className="text-[10px] font-medium uppercase tracking-[0.12em] opacity-90"
        >
          {shortLabel}
        </span>
      ) : null}
    </span>
  );
}
