"use client";

/**
 * URL-driven state for the map page. Everything shareable lives in the query
 * string so a user can paste the URL and land on the same view.
 *
 * Query parameters:
 *   mode  — one of the 10 display modes (default: "preferences")
 *   month — 1-indexed month number, 1..12 (default: current month)
 *   unit  — "metric" | "imperial" (default: "metric")
 *   tmin / tmax / rmax / smin — the weather preferences the map scores on
 *
 * The preference params are what makes a tuned map shareable, and they are
 * also the reason preferences are not in React state alone: `web/CLAUDE.md`
 * rules out `localStorage`, leaving the URL (anonymous, shareable) and the
 * API-backed store (signed in, durable) as the two places they may live.
 * nuqs drops a param whose value equals its default, so an untouched map keeps
 * a clean URL and a shared link carries only what was actually changed.
 *
 * `nuqs` handles serialization and `useTransition`-based updates so the URL
 * rewrite does not block rendering. Shallow updates only — no RSC refetch.
 */

import {
  parseAsFloat,
  parseAsInteger,
  parseAsStringEnum,
  useQueryState,
  useQueryStates,
} from "nuqs";
import { useCallback, useMemo } from "react";

import { DISPLAY_MODES, type DisplayModeId } from "@/lib/display-modes";
import {
  DEFAULT_PREFERENCES,
  clampPreferences,
  type WeatherPreferences,
} from "@/lib/scoring";

export type Unit = "metric" | "imperial";

const MODE_IDS = Object.keys(DISPLAY_MODES) as DisplayModeId[];

const modeParser = parseAsStringEnum<DisplayModeId>(MODE_IDS).withDefault("preferences");
const unitParser = parseAsStringEnum<Unit>(["metric", "imperial"]).withDefault("metric");
const monthParser = parseAsInteger.withDefault(currentMonth());

const preferenceParsers = {
  tmin: parseAsFloat.withDefault(DEFAULT_PREFERENCES.tempMin),
  tmax: parseAsFloat.withDefault(DEFAULT_PREFERENCES.tempMax),
  rmax: parseAsFloat.withDefault(DEFAULT_PREFERENCES.rainMax),
  smin: parseAsFloat.withDefault(DEFAULT_PREFERENCES.sunMin),
};

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
  preferences: WeatherPreferences;
  setMode: (next: DisplayModeId) => void;
  setMonth: (next: number) => void;
  setUnit: (next: Unit) => void;
  setPreferences: (next: WeatherPreferences) => void;
  /** Drop the preference params entirely, restoring the baked default score. */
  resetPreferences: () => void;
};

export function useMapState(): MapState {
  const [mode, setMode] = useQueryState("mode", modeParser);
  const [monthRaw, setMonthRaw] = useQueryState("month", monthParser);
  const [unit, setUnit] = useQueryState("unit", unitParser);
  const [prefsRaw, setPrefsRaw] = useQueryStates(preferenceParsers);

  const month = useMemo(() => clampMonth(monthRaw), [monthRaw]);

  // Identity-stable while the four numbers are: the object is a dependency of
  // the canvas's paint effect, and a fresh one per render would re-run the
  // paint update on every pointer move.
  const preferences = useMemo(
    () =>
      clampPreferences({
        tempMin: prefsRaw.tmin,
        tempMax: prefsRaw.tmax,
        rainMax: prefsRaw.rmax,
        sunMin: prefsRaw.smin,
      }),
    [prefsRaw.tmin, prefsRaw.tmax, prefsRaw.rmax, prefsRaw.smin],
  );

  const setPreferences = useCallback(
    (next: WeatherPreferences) => {
      const clamped = clampPreferences(next);
      void setPrefsRaw({
        tmin: clamped.tempMin,
        tmax: clamped.tempMax,
        rmax: clamped.rainMax,
        smin: clamped.sunMin,
      });
    },
    [setPrefsRaw],
  );

  const resetPreferences = useCallback(() => {
    void setPrefsRaw({ tmin: null, tmax: null, rmax: null, smin: null });
  }, [setPrefsRaw]);

  return {
    mode,
    month,
    unit,
    preferences,
    setMode: (next) => void setMode(next),
    setMonth: (next) => void setMonthRaw(clampMonth(next)),
    setUnit: (next) => void setUnit(next),
    setPreferences,
    resetPreferences,
  };
}
