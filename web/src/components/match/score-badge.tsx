import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";
import {
  SCORE_BG_CLASS,
  clampScore,
  scoreBin,
  scoreLabel,
  scoreShortLabel,
} from "@/lib/scoring";

/**
 * The match verdict, as a word.
 *
 * There used to be a 0–100 number here, and it was the wrong unit for the
 * question. The scoring rule has exactly four outcomes — it counts how many of
 * three variables miss their range and by how much — so the number only ever
 * took four values (25 / 60 / 75 / 90), chosen as centroids to land in the
 * right bin. Printing "75" implied a precision the rule does not have, and
 * invited comparisons between two places that the data cannot support. The
 * four words are the whole answer, and they are the vocabulary the v1 site
 * used.
 *
 * The score is still what flows through the codebase — it is how the paint
 * expression, the ranking and the sort order all work — it simply stops being
 * rendered.
 */

export type ScoreBadgeProps = {
  score: number;
  size?: "sm" | "md" | "lg";
  /**
   * - `short` — "Perfect" / "Good" / "Fair" / "Avoid"
   * - `full` — "Perfect match" / "Good option" / "Acceptable" / "Avoid"
   * - `auto` (default) — `short` at `sm`, `full` at `md`/`lg`
   *
   * The full wording is always the accessible name, whichever is shown, so a
   * screen reader never receives the clipped form.
   */
  label?: "auto" | "short" | "full";
} & Omit<HTMLAttributes<HTMLSpanElement>, "children">;

const SIZE_CLASSES = {
  sm: "h-[22px] px-2 text-[10px] tracking-[0.1em]",
  md: "h-[26px] px-2.5 text-[11px] tracking-[0.1em]",
  lg: "h-9 px-3.5 text-[13px] tracking-[0.08em]",
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
  const full = scoreLabel(clamped);
  const resolved = label === "auto" ? (size === "sm" ? "short" : "full") : label;
  const shown = resolved === "short" ? scoreShortLabel(clamped) : full;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm font-mono font-semibold uppercase text-text-inverse",
        SCORE_BG_CLASS[bin],
        SIZE_CLASSES[size],
        className,
      )}
      role="img"
      aria-label={`Match: ${full}`}
      {...rest}
    >
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}
