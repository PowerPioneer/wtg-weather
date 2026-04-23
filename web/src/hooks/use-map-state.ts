"use client";

/**
 * URL-driven state for the map page. Everything shareable lives in the query
 * string so a user can paste the URL and land on the same view.
 *
 * Query parameters:
 *   mode  — one of the 10 display modes (default: "preferences")
 *   month — 1-indexed month number, 1..12 (default: current month)
 *   unit  — "metric" | "imperial" (default: "metric")
 *
 * `nuqs` handles serialization and `useTransition`-based updates so the URL
 * rewrite does not block rendering. Shallow updates only — no RSC refetch.
 */

import { parseAsInteger, parseAsStringEnum, useQueryState } from "nuqs";
import { useMemo } from "react";

import { DISPLAY_MODES, type DisplayModeId } from "@/lib/display-modes";

export type Unit = "metric" | "imperial";

const MODE_IDS = Object.keys(DISPLAY_MODES) as DisplayModeId[];

const modeParser = parseAsStringEnum<DisplayModeId>(MODE_IDS).withDefault("preferences");
const unitParser = parseAsStringEnum<Unit>(["metric", "imperial"]).withDefault("metric");
const monthParser = parseAsInteger.withDefault(currentMonth());

function currentMonth(): number {
  return new Date().getMonth() + 1;
}

function clampMonth(m: number): number {
  if (!Number.isFinite(m)) return currentMonth();
  const rounded = Math.round(m);
  if (rounded < 1) return 1;
  if (rounded > 12) return 12;
  return rounded;
}

export type MapState = {
  mode: DisplayModeId;
  month: number;
  unit: Unit;
  setMode: (next: DisplayModeId) => void;
  setMonth: (next: number) => void;
  setUnit: (next: Unit) => void;
};

export function useMapState(): MapState {
  const [mode, setMode] = useQueryState("mode", modeParser);
  const [monthRaw, setMonthRaw] = useQueryState("month", monthParser);
  const [unit, setUnit] = useQueryState("unit", unitParser);

  const month = useMemo(() => clampMonth(monthRaw), [monthRaw]);

  return {
    mode,
    month,
    unit,
    setMode: (next) => void setMode(next),
    setMonth: (next) => void setMonthRaw(clampMonth(next)),
    setUnit: (next) => void setUnit(next),
  };
}
