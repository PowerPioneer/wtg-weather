import { buildBandPath, type ChartGeometry } from "./scale";

export type ChartBandsProps = {
  geometry: ChartGeometry;
  bands: { p10: readonly number[]; p90: readonly number[] };
  /** Fill hex (matches the series colour). */
  fill: string;
  /** Fill opacity 0–1. Defaults to 0.14 — matches the design ref. */
  opacity?: number;
};

/**
 * Server-rendered 10/50/90 percentile band. Pure SVG `<path>`; no JS runtime.
 * Renders nothing when `bands` is incomplete (the 12-entry guard lives in
 * `buildBandPath`).
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
