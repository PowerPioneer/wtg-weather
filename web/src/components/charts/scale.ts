/**
 * Shared chart geometry for the 12-month climate charts. All values here are
 * pure functions — deterministic for a given input, no DOM, no randomness.
 * Tests exercise these directly to lock the SVG path output in place.
 */

export const MONTH_INITIALS = [
  "J",
  "F",
  "M",
  "A",
  "M",
  "J",
  "J",
  "A",
  "S",
  "O",
  "N",
  "D",
] as const;

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type ChartGeometry = {
  width: number;
  height: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
  innerW: number;
  innerH: number;
  min: number;
  max: number;
  /** Pixel position for the centre of the i-th month (0–11). */
  xOf: (i: number) => number;
  /** Pixel position for a data value on the y-axis. */
  yOf: (v: number) => number;
  /** Evenly-spaced y-axis tick values (count + 1 entries). */
  yTicks: number[];
};

export type BuildGeometryInput = {
  width?: number;
  height?: number;
  padL?: number;
  padR?: number;
  padT?: number;
  padB?: number;
  values: readonly number[];
  bands?: { p10: readonly number[]; p90: readonly number[] };
  /** Force min bound. Otherwise derived from data. */
  minOverride?: number;
  /** Force max bound. Otherwise derived from data. */
  maxOverride?: number;
  /** Number of y-tick steps (default 4 → 5 ticks). */
  tickCount?: number;
  /** If true, the y-axis includes 0 even when all values are positive. */
  includeZero?: boolean;
};

/**
 * Build a deterministic geometry for a monthly chart. The same inputs always
 * produce the same `xOf` / `yOf` / `yTicks` results — this is what lets the
 * determinism tests pin the SVG path strings exactly.
 */
export function buildGeometry(input: BuildGeometryInput): ChartGeometry {
  const width = input.width ?? 480;
  const height = input.height ?? 180;
  const padL = input.padL ?? 36;
  const padR = input.padR ?? 12;
  const padT = input.padT ?? 16;
  const padB = input.padB ?? 28;
  const tickCount = input.tickCount ?? 4;

  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const all: number[] = [...input.values];
  if (input.bands) {
    all.push(...input.bands.p10, ...input.bands.p90);
  }
  if (input.includeZero ?? false) all.push(0);

  const derivedMin = all.length > 0 ? Math.min(...all) : 0;
  const derivedMax = all.length > 0 ? Math.max(...all) : 1;
  const min = input.minOverride ?? derivedMin;
  const max = input.maxOverride ?? derivedMax;
  const range = max - min || 1;

  const xOf = (i: number) => padL + ((i + 0.5) * innerW) / 12;
  const yOf = (v: number) => padT + innerH - ((v - min) / range) * innerH;

  const yTicks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    yTicks.push(min + (range * i) / tickCount);
  }

  return {
    width,
    height,
    padL,
    padR,
    padT,
    padB,
    innerW,
    innerH,
    min,
    max,
    xOf,
    yOf,
    yTicks,
  };
}

const NUM = (n: number) => {
  // 3 decimals is plenty for SVG, and it keeps output stable between runs.
  const rounded = Math.round(n * 1000) / 1000;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toString();
};

/** Build an SVG `d` attribute for a polyline through monthly values. */
export function buildLinePath(
  values: readonly number[],
  g: Pick<ChartGeometry, "xOf" | "yOf">,
): string {
  if (values.length === 0) return "";
  return values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${NUM(g.xOf(i))} ${NUM(g.yOf(v))}`)
    .join(" ");
}

/** Build the 12 bar rectangles for a rainfall/snow-style chart. */
export type BarRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  month: number;
  value: number;
};

export function buildBars(
  values: readonly number[],
  g: ChartGeometry,
): BarRect[] {
  const bw = (g.innerW / 12) * 0.62;
  const baselineY = g.yOf(Math.max(0, g.min));
  return values.map((v, i) => {
    const cx = g.xOf(i);
    const topY = g.yOf(v);
    return {
      x: cx - bw / 2,
      y: Math.min(baselineY, topY),
      width: bw,
      height: Math.abs(topY - baselineY),
      month: i,
      value: v,
    };
  });
}

/**
 * Build an SVG `d` attribute for the filled p10/p90 band polygon.
 * The path traces p90 left-to-right, then p10 right-to-left, then closes.
 */
export function buildBandPath(
  bands: { p10: readonly number[]; p90: readonly number[] },
  g: Pick<ChartGeometry, "xOf" | "yOf">,
): string {
  const upper = bands.p90;
  const lower = bands.p10;
  if (upper.length !== 12 || lower.length !== 12) return "";
  const up = upper
    .map((v, i) => `${i === 0 ? "M" : "L"} ${NUM(g.xOf(i))} ${NUM(g.yOf(v))}`)
    .join(" ");
  const down = lower
    .map(
      (_, idx) =>
        `L ${NUM(g.xOf(11 - idx))} ${NUM(g.yOf(lower[11 - idx]!))}`,
    )
    .join(" ");
  return `${up} ${down} Z`;
}
