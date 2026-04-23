import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import {
  SCORE_BG_CLASS,
  clampScore,
  scoreBin,
  scoreLabel,
} from "@/lib/scoring";

export type MatchTooltipStat = {
  label: string;
  value: string;
  /** Optional delta glyph (▲ / ▼) or short badge node. */
  hint?: ReactNode;
};

export type MatchTooltipProps = {
  /** Region or country name — e.g. "Arequipa, Peru". */
  place: string;
  /** Context line — e.g. "April · default preferences". */
  context?: string;
  score: number;
  /** Up to ~4 key-value readouts; rendered as a two-column table. */
  stats?: readonly MatchTooltipStat[];
  /** Optional footer, e.g. advisory pill. */
  footer?: ReactNode;
  className?: string;
};

/**
 * Presentational hover card for the map. Positioning is the caller's problem —
 * render this inside a Radix Popover, a portal, or a static test harness. All
 * markup is SSR-safe and carries an accessible role/label.
 */
export function MatchTooltip({
  place,
  context,
  score,
  stats,
  footer,
  className,
}: MatchTooltipProps) {
  const clamped = clampScore(score);
  const bin = scoreBin(clamped);
  const label = scoreLabel(clamped);

  return (
    <div
      role="tooltip"
      aria-label={`${place}: ${Math.round(clamped)} — ${label}`}
      className={cn(
        "min-w-[232px] max-w-[280px] rounded-md border border-border bg-surface p-4 shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-display text-[16px] font-medium leading-tight text-text">
            {place}
          </span>
          {context ? (
            <span className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">
              {context}
            </span>
          ) : null}
        </div>
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-sm px-2 py-1 text-text-inverse",
            SCORE_BG_CLASS[bin],
          )}
        >
          <span className="font-mono text-[15px] font-semibold tabular-nums leading-none">
            {Math.round(clamped)}
          </span>
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]">
            {label.split(" ")[0]}
          </span>
        </div>
      </div>
      {stats && stats.length > 0 ? (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-border pt-3">
          {stats.map((s) => (
            <div key={s.label} className="contents">
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-text-subtle">
                {s.label}
              </dt>
              <dd className="flex items-center justify-end gap-1 font-mono text-[12px] tabular-nums text-text">
                <span>{s.value}</span>
                {s.hint ? (
                  <span className="text-text-muted">{s.hint}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {footer ? (
        <div className="mt-3 border-t border-border pt-2 text-[11px] text-text-muted">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
