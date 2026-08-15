import { MONTH_INITIALS, type ChartGeometry } from "./scale";

export type ChartAxesProps = {
  geometry: ChartGeometry;
  /** Format a y-axis tick value (e.g. rounded temperature). Defaults to `Math.round`. */
  formatY?: (value: number) => string;
  /** Hide the baseline solid line — useful when the zero line is drawn elsewhere. */
  hideBaseline?: boolean;
};

/**
 * Horizontal gridlines + y-tick labels + month-initial x labels. Server-only —
 * it's pure SVG markup, no state.
 */
export function ChartAxes({
  geometry,
  formatY = (v) => Math.round(v).toString(),
  hideBaseline = false,
}: ChartAxesProps) {
  const { yTicks, padL, padR, width, height, yOf, xOf } = geometry;
  const lastIdx = yTicks.length - 1;

  return (
    <g aria-hidden="true">
      {yTicks.map((v, i) => {
        const isBaseline = i === lastIdx;
        if (isBaseline && hideBaseline) {
          return (
            <text
              key={i}
              x={padL - 6}
              y={yOf(v) + 3}
              textAnchor="end"
              fontSize="9"
              fill="#6B7280"
              fontFamily="var(--font-mono)"
            >
              {formatY(v)}
            </text>
          );
        }
        return (
          <g key={i}>
            <line
              x1={padL}
              x2={width - padR}
              y1={yOf(v)}
              y2={yOf(v)}
              stroke="#D9D5C8"
              strokeWidth="0.5"
              strokeDasharray={isBaseline ? undefined : "2 3"}
            />
            <text
              x={padL - 6}
              y={yOf(v) + 3}
              textAnchor="end"
              fontSize="9"
              fill="#6B7280"
              fontFamily="var(--font-mono)"
            >
              {formatY(v)}
            </text>
          </g>
        );
      })}
      {MONTH_INITIALS.map((m, i) => (
        <text
          key={i}
          x={xOf(i)}
          y={height - 8}
          textAnchor="middle"
          fontSize="9"
          fill="#6B7280"
          fontFamily="var(--font-mono)"
        >
          {m}
        </text>
      ))}
    </g>
  );
}
