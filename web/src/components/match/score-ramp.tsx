import { cn } from "@/lib/cn";
import { SCORE_BG_CLASS, scoreShortLabel } from "@/lib/scoring";

export type ScoreRampProps = {
  /** Current value to highlight with a caret. Omit for a neutral legend. */
  value?: number;
  /** Toggle the per-bin numeric range text. */
  showRange?: boolean;
  /** Eyebrow title above the ramp, e.g. "Match score". */
  title?: string;
  className?: string;
};

const BINS = [
  { label: scoreShortLabel(95), bin: "perfect", range: "85–100" },
  { label: scoreShortLabel(75), bin: "good", range: "70–84" },
  { label: scoreShortLabel(60), bin: "acceptable", range: "50–69" },
  { label: scoreShortLabel(30), bin: "avoid", range: "0–49" },
] as const;

/**
 * Legend ramp for the score palette — four equal swatches with labels under
 * each. Kept server-safe; no hover state, no interactivity. The map legend
 * component composes this with optional unit/collapse chrome.
 */
export function ScoreRamp({
  value,
  showRange = true,
  title,
  className,
}: ScoreRampProps) {
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
        aria-label={`Score legend: ${BINS.map((b) => `${b.label} ${b.range}`).join(", ")}`}
      >
        {BINS.map((b) => (
          <div key={b.bin} className="flex flex-col items-stretch gap-1">
            <div
              className={cn("h-3 w-16 rounded-sm", SCORE_BG_CLASS[b.bin])}
              aria-hidden="true"
            />
            <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-text">
              {b.label}
            </div>
            {showRange ? (
              <div className="font-mono text-[10px] tabular-nums text-text-subtle">
                {b.range}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {value != null ? (
        <ValueMarker value={value} />
      ) : null}
    </div>
  );
}

function ValueMarker({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const position = clamped / 100;
  return (
    <div className="relative h-4 w-[272px]" aria-hidden="true">
      <div
        className="absolute -top-1 font-mono text-[10px] tabular-nums text-text"
        style={{
          left: `calc(${position * 100}% - 1ch)`,
        }}
      >
        ▲ {Math.round(clamped)}
      </div>
    </div>
  );
}
