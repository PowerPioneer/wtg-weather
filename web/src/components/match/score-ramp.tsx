import { cn } from "@/lib/cn";
import { SCORE_BG_CLASS, scoreBin, scoreShortLabel } from "@/lib/scoring";

export type ScoreRampProps = {
  /** Bin to mark as the current one. Omit for a neutral legend. */
  value?: number;
  /** Eyebrow title above the ramp, e.g. "Match quality". */
  title?: string;
  className?: string;
};

/**
 * The four bins, best first. No numeric ranges under them any more: the score
 * they described is no longer shown anywhere, and a legend that reads "85–100"
 * next to a map that never prints a number is explaining a scale the reader
 * cannot observe. See `score-badge.tsx` for why the number went.
 */
const BINS = [
  { label: scoreShortLabel(95), bin: "perfect" },
  { label: scoreShortLabel(75), bin: "good" },
  { label: scoreShortLabel(60), bin: "acceptable" },
  { label: scoreShortLabel(30), bin: "avoid" },
] as const;

/**
 * Legend ramp for the score palette — four equal swatches with labels under
 * each. Kept server-safe; no hover state, no interactivity. The map legend
 * component composes this with optional unit/collapse chrome.
 */
export function ScoreRamp({ value, title, className }: ScoreRampProps) {
  const activeBin = value == null ? null : scoreBin(value);
  return (
    <div className={cn("inline-flex flex-col gap-2", className)}>
      {title ? (
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">
          {title}
        </div>
      ) : null}
      <div
        className="flex items-stretch gap-1"
        role="img"
        aria-label={`Match legend: ${BINS.map((b) => b.label).join(", ")}`}
      >
        {BINS.map((b) => (
          <div key={b.bin} className="flex flex-col items-stretch gap-1">
            <div
              className={cn(
                "h-3 w-16 rounded-sm",
                SCORE_BG_CLASS[b.bin],
                // The current bin is marked by a ring rather than a caret on a
                // continuous axis — there is no axis left to point at.
                activeBin === b.bin &&
                  "ring-2 ring-text ring-offset-1 ring-offset-surface",
              )}
              aria-hidden="true"
            />
            <div
              className={cn(
                "font-mono text-[10.5px] uppercase tracking-[0.1em]",
                activeBin === b.bin
                  ? "font-bold text-text"
                  : "font-semibold text-text",
              )}
            >
              {b.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

