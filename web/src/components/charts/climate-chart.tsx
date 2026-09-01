"use client";

/**
 * A Client Component only so that it can honour the °C/°F preference, which is
 * resolved in the browser (see `components/units/unit-provider.tsx`). It is
 * still server-rendered into the HTML in metric, so a crawler and a reader with
 * JS disabled get the full chart — the SSR rule in `web/CLAUDE.md` is about the
 * page being *renderable* without client JS, not about avoiding hydration.
 *
 * Conversion happens here rather than upstream because everything below the
 * render is metric by construction: the pipeline publishes °C and mm, the
 * percentile bands are in the same units as the series, and the y-axis is
 * derived from both. Converting the three arrays at the top keeps the geometry
 * code unit-agnostic.
 */

import { useUnit } from "@/components/units";
import { cn } from "@/lib/cn";
import {
  celsiusToFahrenheit,
  centimetresToInches,
  kmhToMph,
  millimetresToInches,
  type UnitSystem,
} from "@/lib/units";

import { ChartAxes } from "./chart-axes";
import { ChartBands } from "./chart-bands";
import {
  MONTH_NAMES,
  buildBars,
  buildGeometry,
  buildLinePath,
} from "./scale";

export type ClimateChartKind =
  | "temp"
  | "rain"
  | "sun"
  | "wind"
  | "snow"
  | "sst"
  | "humidity"
  | "heat";

export type MonthDatum = {
  /** 0–11 — matches MONTH_NAMES. */
  month: number;
  value: number;
  /**
   * A second line on the same axis. Temperature uses it for the mean daily
   * minimum, drawn in blue beneath the maximum's red.
   */
  low?: number;
  /**
   * Envelope edges — the *within-month* spread, premium. For temperature these
   * are the 5th percentile of daily minima and the 95th of daily maxima: how
   * much one day differs from the next, not how much one year differs from
   * another. The old p10/p90 across ten annual means was 2–4 °C wide, because
   * averaging over a month destroys nearly all the variance.
   */
  p5?: number;
  p95?: number;
};

export type ClimateChartProps = {
  kind: ClimateChartKind;
  months: readonly MonthDatum[];
  /** If true, the chart is rendered blurred (caller overlays an upgrade prompt). */
  locked?: boolean;
  /**
   * Force a unit instead of following the visitor's preference. For fixtures
   * and tests; product surfaces should let the provider decide.
   */
  unit?: UnitSystem;
  /** Card variant: compact squeezes the chart for dashboard grids. */
  compact?: boolean;
  /** Optional place/month context shown in the accessible summary. */
  context?: string;
  className?: string;
};

type KindSpec = {
  title: string;
  unitMetric: string;
  unitImperial: string;
  color: string;
  render: "line" | "bars";
  /** If true, y-axis is forced to include zero. */
  includeZero?: boolean;
  /** Hard minimum, e.g. humidity 0–100. */
  minOverride?: number;
  /** Hard maximum. */
  maxOverride?: number;
  decimals: number;
  /** Decimals for the imperial rendering. Defaults to `decimals`. */
  imperialDecimals?: number;
  /**
   * Metric value → imperial value. Absent where the variable has no imperial
   * form at all: hours of sunshine and relative humidity are the same number
   * in both systems.
   */
  toImperial?: (value: number) => number;
  /** SR description verb ("Average daytime high", etc.). */
  srNoun: string;
  /** Colour of the second line, where a kind draws one. */
  secondColor?: string;
  /** SR description verb for that second line. */
  secondSrNoun?: string;
};

const SPECS: Record<ClimateChartKind, KindSpec> = {
  temp: {
    title: "Temperature",
    unitMetric: "°C",
    unitImperial: "°F",
    color: "#D14A2E",
    // The overnight low, drawn beneath the daytime high. Both are CVD-safe
    // Atlas colours, and they are the only pair on the site where red and blue
    // carry meaning rather than decoration.
    secondColor: "#0072B2",
    secondSrNoun: "Average overnight low",
    render: "line",
    decimals: 1,
    imperialDecimals: 0,
    toImperial: celsiusToFahrenheit,
    srNoun: "Average daytime high",
  },
  rain: {
    title: "Rainfall",
    unitMetric: "mm",
    unitImperial: "in",
    color: "#0072B2",
    render: "bars",
    includeZero: true,
    minOverride: 0,
    decimals: 0,
    imperialDecimals: 1,
    toImperial: millimetresToInches,
    srNoun: "Rainfall",
  },
  sun: {
    title: "Sunshine",
    unitMetric: "hr / day",
    unitImperial: "hr / day",
    color: "#B8763E",
    render: "line",
    includeZero: true,
    minOverride: 0,
    maxOverride: 14,
    decimals: 1,
    srNoun: "Sunshine hours",
  },
  wind: {
    title: "Wind",
    unitMetric: "km/h",
    unitImperial: "mph",
    color: "#4A5568",
    render: "line",
    includeZero: true,
    minOverride: 0,
    decimals: 1,
    imperialDecimals: 0,
    toImperial: kmhToMph,
    srNoun: "Average wind speed",
  },
  snow: {
    title: "Snow depth",
    unitMetric: "cm",
    unitImperial: "in",
    color: "#4A6B85",
    render: "bars",
    includeZero: true,
    minOverride: 0,
    decimals: 0,
    imperialDecimals: 1,
    toImperial: centimetresToInches,
    srNoun: "Snow depth",
  },
  sst: {
    title: "Sea surface",
    unitMetric: "°C",
    unitImperial: "°F",
    color: "#0072B2",
    render: "line",
    decimals: 1,
    imperialDecimals: 0,
    toImperial: celsiusToFahrenheit,
    srNoun: "Sea surface temperature",
  },
  humidity: {
    title: "Humidity",
    unitMetric: "%",
    unitImperial: "%",
    color: "#6B8A6E",
    render: "line",
    minOverride: 0,
    maxOverride: 100,
    decimals: 0,
    srNoun: "Relative humidity",
  },
  heat: {
    title: "Heat index",
    unitMetric: "°C feels-like",
    unitImperial: "°F feels-like",
    color: "#D14A2E",
    render: "line",
    decimals: 1,
    imperialDecimals: 0,
    toImperial: celsiusToFahrenheit,
    srNoun: "Heat index",
  },
};

/**
 * All 8 climate chart kinds render through here. Server-side SVG, zero client
 * JS, deterministic output for a given input.
 *
 * Accessibility: every chart carries a `<title>` plus a hidden `<desc>` with
 * the monthly values in order, plus a `<details><table>` fallback in the DOM
 * for screen reader users (invisible until the details is opened).
 */
export function ClimateChart({
  kind,
  months,
  locked = false,
  unit: unitOverride,
  compact = false,
  context,
  className,
}: ClimateChartProps) {
  const { unit: preferredUnit } = useUnit();
  const unit = unitOverride ?? preferredUnit;
  const spec = SPECS[kind];
  if (months.length !== 12) {
    throw new Error(
      `ClimateChart[${kind}] expects exactly 12 months, got ${months.length}`,
    );
  }

  // The unit label used to switch on its own while the numbers underneath
  // stayed metric — an imperial chart of a Peruvian August read "14 °F". The
  // series, the percentile bands and the y-axis all convert together or none
  // of them do.
  const imperial = unit === "imperial" && spec.toImperial != null;
  const convert = imperial ? spec.toImperial! : (v: number) => v;
  const decimals =
    imperial && spec.imperialDecimals != null
      ? spec.imperialDecimals
      : spec.decimals;

  const unitLabel = unit === "imperial" ? spec.unitImperial : spec.unitMetric;
  const values = months.map((m) => convert(m.value));

  const hasSecondary = months.every((m) => m.low != null);
  const secondary = hasSecondary
    ? months.map((m) => convert(m.low as number))
    : undefined;

  const hasBands = months.every((m) => m.p5 != null && m.p95 != null);
  const bands = hasBands
    ? {
        lower: months.map((m) => convert(m.p5 as number)),
        upper: months.map((m) => convert(m.p95 as number)),
      }
    : undefined;

  const width = compact ? 360 : 480;
  const height = compact ? 140 : 180;
  const geometry = buildGeometry({
    width,
    height,
    values,
    secondary,
    bands,
    includeZero: spec.includeZero,
    // The hard bounds are declared in metric (humidity 0–100, sunshine ≤ 14),
    // so they convert with everything else — a °F chart clamped at a °C
    // ceiling would flatten every warm month against the top of the frame.
    minOverride: spec.minOverride == null ? undefined : convert(spec.minOverride),
    maxOverride: spec.maxOverride == null ? undefined : convert(spec.maxOverride),
  });

  const linePath =
    spec.render === "line" ? buildLinePath(values, geometry) : "";
  const secondaryPath =
    spec.render === "line" && secondary
      ? buildLinePath(secondary, geometry)
      : "";
  const bars = spec.render === "bars" ? buildBars(values, geometry) : [];

  const srSummary = buildSrSummary({
    noun: spec.srNoun,
    unit: unitLabel,
    values,
    decimals,
    context,
  });

  return (
    <figure
      className={cn(
        "relative overflow-hidden rounded-md border border-border bg-surface",
        compact ? "p-4" : "p-[18px_18px_14px]",
        className,
      )}
      data-chart-kind={kind}
      data-chart-locked={locked || undefined}
    >
      <figcaption className="mb-1 flex items-baseline justify-between">
        <span className="text-[13px] font-semibold tracking-tight text-text">
          {spec.title}
        </span>
        <span className="font-mono text-[10.5px] text-text-muted">
          {unitLabel}
        </span>
      </figcaption>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="block"
        style={{
          filter: locked ? "blur(3px) saturate(0.6)" : undefined,
          opacity: locked ? 0.55 : 1,
        }}
        role="img"
        aria-label={srSummary}
      >
        <title>{`${spec.title} · 12-month climatology`}</title>
        <desc>{srSummary}</desc>

        <ChartAxes
          geometry={geometry}
          formatY={(v) => formatYTick(v, decimals)}
        />

        {bands ? (
          <ChartBands
            geometry={geometry}
            bands={bands}
            fill={spec.color}
            opacity={0.14}
          />
        ) : null}

        {secondaryPath && spec.secondColor ? (
          <>
            <path
              d={secondaryPath}
              fill="none"
              stroke={spec.secondColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {secondary!.map((v, i) => (
              <circle
                key={`low-${i}`}
                cx={geometry.xOf(i)}
                cy={geometry.yOf(v)}
                r={2.5}
                fill="#FFFFFF"
                stroke={spec.secondColor}
                strokeWidth={1.5}
              />
            ))}
          </>
        ) : null}

        {spec.render === "line" ? (
          <>
            <path
              d={linePath}
              fill="none"
              stroke={spec.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {values.map((v, i) => (
              <circle
                key={i}
                cx={geometry.xOf(i)}
                cy={geometry.yOf(v)}
                r={2.5}
                fill="#FFFFFF"
                stroke={spec.color}
                strokeWidth={1.5}
              />
            ))}
          </>
        ) : null}

        {spec.render === "bars"
          ? bars.map((b) => (
              <rect
                key={b.month}
                x={b.x}
                y={b.y}
                width={b.width}
                height={b.height}
                fill={spec.color}
                opacity={0.88}
              />
            ))
          : null}
      </svg>

      {!locked && (bands || secondaryPath) ? (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10.5px] text-accent-text">
          {secondaryPath && spec.secondColor ? (
            <>
              <span style={{ color: spec.color }}>— daytime high</span>
              <span style={{ color: spec.secondColor }}>— overnight low</span>
            </>
          ) : (
            <span>— average</span>
          )}
          {/*
            "Typical range", not "5/95 percentile band". The rule this site
            works by has four outcomes rather than a hundred for the same
            reason: a quantile in a legend claims a precision the reader has no
            use for, and most readers cannot act on it.
          */}
          {bands ? <span>▬ typical range</span> : null}
        </div>
      ) : null}

      {/* Screen-reader fallback: values rendered as a <table> inside <details>. */}
      <details className="mt-2 font-mono text-[11px] text-text-muted">
        <summary className="cursor-pointer select-none">
          View data table
        </summary>
        <table className="mt-2 w-full border-collapse text-left text-[11px] tabular-nums">
          <thead>
            <tr className="border-b border-border text-text-subtle">
              <th scope="col" className="py-1 pr-2 text-left font-medium">
                Month
              </th>
              <th scope="col" className="py-1 pr-2 text-right font-medium">
                {spec.srNoun} ({unitLabel})
              </th>
              {secondary ? (
                <th scope="col" className="py-1 pr-2 text-right font-medium">
                  {spec.secondSrNoun ?? "Low"} ({unitLabel})
                </th>
              ) : null}
              {bands ? (
                <>
                  <th scope="col" className="py-1 pr-2 text-right font-medium">
                    Typical low
                  </th>
                  <th scope="col" className="py-1 pr-2 text-right font-medium">
                    Typical high
                  </th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {months.map((m, i) => (
              <tr key={i} className="border-b border-border/60">
                <th scope="row" className="py-1 pr-2 text-left font-normal">
                  {MONTH_NAMES[m.month]}
                </th>
                {/* The table is the same data as the plot, so it converts
                    with it — the header already says which unit. */}
                <td className="py-1 pr-2 text-right">
                  {convert(m.value).toFixed(decimals)}
                </td>
                {secondary ? (
                  <td className="py-1 pr-2 text-right">
                    {convert(m.low as number).toFixed(decimals)}
                  </td>
                ) : null}
                {bands ? (
                  <>
                    <td className="py-1 pr-2 text-right">
                      {convert(m.p5 as number).toFixed(decimals)}
                    </td>
                    <td className="py-1 pr-2 text-right">
                      {convert(m.p95 as number).toFixed(decimals)}
                    </td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function formatYTick(value: number, decimals: number): string {
  if (decimals === 0) return Math.round(value).toString();
  // Y-axis ticks read better as integers at ≤1-decimal precision.
  return Math.round(value).toString();
}

function buildSrSummary({
  noun,
  unit,
  values,
  decimals,
  context,
}: {
  noun: string;
  unit: string;
  values: readonly number[];
  decimals: number;
  context?: string;
}): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const minIdx = values.indexOf(min);
  const maxIdx = values.indexOf(max);
  const ctx = context ? `${context}. ` : "";
  return (
    `${ctx}${noun} by month in ${unit}. ` +
    `Lowest in ${MONTH_NAMES[minIdx]} (${min.toFixed(decimals)}), ` +
    `highest in ${MONTH_NAMES[maxIdx]} (${max.toFixed(decimals)}). ` +
    `Monthly means: ${values.map((v) => v.toFixed(decimals)).join(", ")}.`
  );
}
