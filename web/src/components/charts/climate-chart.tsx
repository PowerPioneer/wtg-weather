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
  /** Optional 10th percentile (Premium bands). */
  p10?: number;
  /** Optional 90th percentile (Premium bands). */
  p90?: number;
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
  /** SR description verb ("Average temperature", etc.). */
  srNoun: string;
};

const SPECS: Record<ClimateChartKind, KindSpec> = {
  temp: {
    title: "Temperature",
    unitMetric: "°C",
    unitImperial: "°F",
    color: "#D14A2E",
    render: "line",
    decimals: 1,
    imperialDecimals: 0,
    toImperial: celsiusToFahrenheit,
    srNoun: "Average temperature",
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
  const hasBands =
    months.every((m) => m.p10 != null && m.p90 != null) === true;
  const bands = hasBands
    ? {
        p10: months.map((m) => convert(m.p10 as number)),
        p90: months.map((m) => convert(m.p90 as number)),
      }
    : undefined;

  const width = compact ? 360 : 480;
  const height = compact ? 140 : 180;
  const geometry = buildGeometry({
    width,
    height,
    values,
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

      {bands && !locked ? (
        <div className="mt-1 flex gap-3 font-mono text-[10.5px] text-accent-text">
          <span>— median</span>
          <span>▬ 10 / 90 percentile band</span>
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
              {bands ? (
                <>
                  <th scope="col" className="py-1 pr-2 text-right font-medium">
                    p10
                  </th>
                  <th scope="col" className="py-1 pr-2 text-right font-medium">
                    p90
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
                {bands ? (
                  <>
                    <td className="py-1 pr-2 text-right">
                      {convert(m.p10 as number).toFixed(decimals)}
                    </td>
                    <td className="py-1 pr-2 text-right">
                      {convert(m.p90 as number).toFixed(decimals)}
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
