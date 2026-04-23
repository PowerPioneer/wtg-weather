import { cn } from "@/lib/cn";
import { SCORE_HEX, type ScoreBin } from "@/lib/scoring";

import { buildLinePath, buildGeometry } from "./scale";

export type SparklineTone = "ink" | "muted" | "accent" | ScoreBin;

export type SparklineProps = {
  values: readonly number[];
  width?: number;
  height?: number;
  tone?: SparklineTone;
  /** Index of the month to emphasise with a filled dot (0–11). */
  highlight?: number;
  /** Accessible description. Required for the `<title>` element. */
  title: string;
  className?: string;
};

const TONE_HEX: Record<SparklineTone, string> = {
  ink: "#0F1B2D",
  muted: "#4A5568",
  accent: "#B8763E",
  perfect: SCORE_HEX.perfect,
  good: SCORE_HEX.good,
  acceptable: SCORE_HEX.acceptable,
  avoid: SCORE_HEX.avoid,
};

/**
 * Server-rendered SVG sparkline. No axes, no labels — just the line and an
 * optional highlight dot. Scales to its container; the `width`/`height` props
 * are the intrinsic viewBox aspect.
 */
export function Sparkline({
  values,
  width = 120,
  height = 28,
  tone = "accent",
  highlight,
  title,
  className,
}: SparklineProps) {
  if (values.length === 0) return null;
  const stroke = TONE_HEX[tone];
  const g = buildGeometry({
    width,
    height,
    padL: 2,
    padR: 2,
    padT: 2,
    padB: 2,
    values,
  });
  const path = buildLinePath(values, g);
  const hasHighlight =
    highlight != null && highlight >= 0 && highlight < values.length;

  return (
    <svg
      className={cn("block", className)}
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={title}
      preserveAspectRatio="none"
    >
      <title>{title}</title>
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {hasHighlight ? (
        <circle
          cx={g.xOf(highlight)}
          cy={g.yOf(values[highlight]!)}
          r={2.5}
          fill={stroke}
        />
      ) : null}
    </svg>
  );
}
