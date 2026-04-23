import { cn } from "@/lib/cn";
import { clampScore, scoreBin, scoreHex, scoreLabel } from "@/lib/scoring";

export type ScoreGaugeProps = {
  score: number;
  /** Diameter in px. `md` = 96, `lg` = 128. */
  size?: "md" | "lg";
  /** Label shown under the number (e.g. "Perfect match"). Defaults to `scoreLabel(score)`. */
  label?: string;
  /** Sub-label in mono caps (e.g. "Peru · April"). */
  sub?: string;
  className?: string;
};

const SIZE_PX = { md: 96, lg: 128 } as const;
const STROKE_PX = { md: 10, lg: 12 } as const;

/**
 * 270° arc gauge. Server-rendered SVG — no client JS. The arc sweeps from the
 * 7 o'clock position clockwise around to the 5 o'clock position. Number and
 * label live inside the SVG so the composition is deterministic and SSR-safe.
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

  const startDeg = 135;
  const totalSweep = 270;
  const progressSweep = (clamped / 100) * totalSweep;

  const polar = (deg: number): [number, number] => {
    const rad = (deg * Math.PI) / 180;
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
  };

  const [x0, y0] = polar(startDeg);
  const [xTrackEnd, yTrackEnd] = polar(startDeg + totalSweep);
  const [xProgressEnd, yProgressEnd] = polar(startDeg + progressSweep);

  const trackPath = `M ${x0} ${y0} A ${radius} ${radius} 0 1 1 ${xTrackEnd} ${yTrackEnd}`;
  const progressPath =
    progressSweep > 0
      ? `M ${x0} ${y0} A ${radius} ${radius} 0 ${progressSweep > 180 ? 1 : 0} 1 ${xProgressEnd} ${yProgressEnd}`
      : "";

  const numberFontSize = size === "lg" ? 40 : 30;
  const a11yDesc = `${Math.round(clamped)} out of 100. ${resolvedLabel}.${sub ? ` ${sub}.` : ""}`;

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
        <title>Match score gauge</title>
        <desc>{a11yDesc}</desc>
        <path
          d={trackPath}
          fill="none"
          stroke="#D9D5C8"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {progressPath ? (
          <path
            d={progressPath}
            fill="none"
            stroke={hex}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        ) : null}
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-display)"
          fontSize={numberFontSize}
          fontWeight={500}
          letterSpacing="-0.02em"
          fill="#0F1B2D"
          aria-hidden="true"
        >
          {Math.round(clamped)}
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
