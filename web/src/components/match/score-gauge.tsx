import { cn } from "@/lib/cn";
import {
  SCORE_BINS,
  clampScore,
  scoreBin,
  scoreHex,
  scoreLabel,
  scoreShortLabel,
  type ScoreBin,
} from "@/lib/scoring";

export type ScoreGaugeProps = {
  score: number;
  /** Diameter in px. `md` = 96, `lg` = 128. */
  size?: "md" | "lg";
  /** Label shown under the dial (e.g. "Perfect match"). Defaults to `scoreLabel(score)`. */
  label?: string;
  /** Sub-label in mono caps (e.g. "Peru · April"). */
  sub?: string;
  className?: string;
};

const SIZE_PX = { md: 96, lg: 128 } as const;
const STROKE_PX = { md: 10, lg: 12 } as const;

/** Four bins, best first — the order the dial reads clockwise. */
const BINS: readonly ScoreBin[] = SCORE_BINS.map((b) => b.bin);

/**
 * The match verdict as a four-segment dial.
 *
 * It used to be a progress arc with a number in the middle, sweeping
 * proportionally to a 0–100 score. Both halves of that were a claim the
 * scoring rule cannot make: the rule has four outcomes, not a hundred, so an
 * arc at 75% and a numeral "75" both described a resolution that does not
 * exist. What survives is the part that was true — which of the four bins this
 * place falls in — drawn as four fixed segments with the reached one filled.
 *
 * Server-rendered SVG, no client JS. Colour is never the only carrier: the
 * word sits inside the dial and the full label under it.
 */
export function ScoreGauge({
  score,
  size = "md",
  label,
  sub,
  className,
}: ScoreGaugeProps) {
  const diameter = SIZE_PX[size];
  const stroke = STROKE_PX[size];
  const radius = (diameter - stroke) / 2;
  const cx = diameter / 2;
  const cy = diameter / 2;

  const clamped = clampScore(score);
  const bin = scoreBin(clamped);
  const hex = scoreHex(clamped);
  const resolvedLabel = label ?? scoreLabel(clamped);
  const activeIndex = BINS.indexOf(bin);

  // 270° of dial, four segments, a small gap between each so the divisions
  // read as steps rather than as a continuous sweep.
  const startDeg = 135;
  const totalSweep = 270;
  const gapDeg = 6;
  const segmentSweep = (totalSweep - gapDeg * (BINS.length - 1)) / BINS.length;

  const polar = (deg: number): [number, number] => {
    const rad = (deg * Math.PI) / 180;
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
  };

  const arc = (fromDeg: number, sweep: number): string => {
    const [x0, y0] = polar(fromDeg);
    const [x1, y1] = polar(fromDeg + sweep);
    return `M ${x0} ${y0} A ${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };

  // Segments are drawn worst-first so the dial fills clockwise from the left,
  // which puts the reached segment where the eye expects a "level" to end.
  const segments = BINS.map((_, index) => BINS.length - 1 - index).map(
    (binIndex, position) => ({
      binIndex,
      d: arc(startDeg + position * (segmentSweep + gapDeg), segmentSweep),
      // Everything from the worst bin up to this place's own bin is filled.
      filled: binIndex >= activeIndex,
    }),
  );

  const wordFontSize = size === "lg" ? 17 : 13;
  const a11yDesc = `Match: ${resolvedLabel}.${sub ? ` ${sub}.` : ""}`;

  return (
    <div
      className={cn("inline-flex flex-col items-center", className)}
      data-score-bin={bin}
    >
      <svg
        width={diameter}
        height={diameter}
        viewBox={`0 0 ${diameter} ${diameter}`}
        role="img"
        aria-label={a11yDesc}
      >
        <title>Match verdict</title>
        <desc>{a11yDesc}</desc>
        {segments.map((segment) => (
          <path
            key={segment.binIndex}
            d={segment.d}
            fill="none"
            stroke={segment.filled ? hex : "#D9D5C8"}
            strokeWidth={stroke}
            strokeLinecap="butt"
          />
        ))}
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-mono)"
          fontSize={wordFontSize}
          fontWeight={600}
          letterSpacing="0.04em"
          fill="#0F1B2D"
          aria-hidden="true"
        >
          {scoreShortLabel(clamped).toUpperCase()}
        </text>
      </svg>
      <div className="mt-3 text-center">
        <div className="font-display text-[18px] font-medium leading-tight text-text">
          {resolvedLabel}
        </div>
        {sub ? (
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
}
