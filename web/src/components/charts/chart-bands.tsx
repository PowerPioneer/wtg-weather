import { buildBandPath, type ChartGeometry } from "./scale";

export type ChartBandsProps = {
  geometry: ChartGeometry;
  /** Lower and upper edges of the shaded envelope, in render units. */
  bands: { lower: readonly number[]; upper: readonly number[] };
  /** Fill hex (matches the series colour). */
  fill: string;
  /** Fill opacity 0–1. Defaults to 0.14 — matches the design ref. */
  opacity?: number;
};

/**
 * Server-rendered shaded envelope. Pure SVG `<path>`; no JS runtime. Renders
 * nothing when `bands` is incomplete (the 12-entry guard lives in
 * `buildBandPath`).
 *
 * For temperature the edges are the 5th percentile of daily minima and the
 * 95th of daily maxima — a *within-month* spread, i.e. how much one day
 * differs from the next. It used to be the 10th and 90th percentile across ten
 * annual means, which is 2–4 °C wide because averaging over a month destroys
 * the variance, and which looked broken next to two lines.
 */
export function ChartBands({
  geometry,
  bands,
  fill,
  opacity = 0.14,
}: ChartBandsProps) {
  const d = buildBandPath(bands, geometry);
  if (!d) return null;
  return (
    <path
      d={d}
      fill={fill}
      fillOpacity={opacity}
      stroke="none"
      aria-hidden="true"
    />
  );
}
