"use client";

/**
 * Unit-aware readouts.
 *
 * Each of these renders the metric string on the server and on the first
 * client render, then swaps to imperial for a visitor who chose it. They are
 * deliberately tiny client leaves rather than a page-wide client boundary: a
 * country page stays a Server Component that happens to contain a few dozen
 * spans which can change their own text.
 *
 * The value passed in is always metric — °C, mm, km/h, cm — because that is
 * what the pipeline publishes and what the scoring rule compares against.
 * Converting anywhere upstream of the render would put two units into the same
 * variable and guarantee that one caller eventually forgets which it holds.
 */

import { useUnit } from "@/components/units/unit-provider";
import {
  formatRainfallMonthly,
  formatTemperatureDelta,
  formatRainfallPerDay,
  formatSnowDepth,
  formatTemperature,
  formatTemperatureRange,
  formatWind,
  temperatureUnitLabel,
  type TemperatureOptions,
} from "@/lib/units";

export type TemperatureProps = {
  /** °C, as published. */
  value: number;
} & TemperatureOptions;

export function Temperature({ value, ...options }: TemperatureProps) {
  const { unit } = useUnit();
  return <>{formatTemperature(value, unit, options)}</>;
}

export function TemperatureRange({
  low,
  high,
  digits = 0,
  separator,
}: {
  low: number;
  high: number;
  digits?: number;
  separator?: string;
}) {
  const { unit } = useUnit();
  return <>{formatTemperatureRange(low, high, unit, { digits, separator })}</>;
}

/**
 * A temperature *difference* — "2.0 °C warmer than the yearly mean". Converts
 * by the ratio only; see `formatTemperatureDelta`.
 */
export function TemperatureDelta({
  value,
  digits = 1,
  space,
}: {
  /** Difference in °C. */
  value: number;
  digits?: number;
  space?: boolean;
}) {
  const { unit } = useUnit();
  return <>{formatTemperatureDelta(value, unit, { digits, space })}</>;
}

/** Just "°C" / "°F" — for a column header that labels a whole series. */
export function TemperatureUnit() {
  const { unit } = useUnit();
  return <>{temperatureUnitLabel(unit)}</>;
}

export function RainfallPerDay({
  value,
  digits,
  unitSuffix,
}: {
  /** mm/day, as published. */
  value: number;
  digits?: number;
  unitSuffix?: boolean;
}) {
  const { unit } = useUnit();
  return <>{formatRainfallPerDay(value, unit, { digits, unitSuffix })}</>;
}

export function RainfallMonthly({
  value,
  unitSuffix,
}: {
  /** mm across the month, as published. */
  value: number;
  unitSuffix?: boolean;
}) {
  const { unit } = useUnit();
  return <>{formatRainfallMonthly(value, unit, { unitSuffix })}</>;
}

export function Wind({ value, digits }: { value: number; digits?: number }) {
  const { unit } = useUnit();
  return <>{formatWind(value, unit, { digits })}</>;
}

export function SnowDepth({ value }: { value: number }) {
  const { unit } = useUnit();
  return <>{formatSnowDepth(value, unit)}</>;
}
