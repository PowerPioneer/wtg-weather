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
 *   smax  — worst travel advisory level the traveller accepts (1-4)
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
import type { UnitSystem } from "@/lib/units";
import {
  DEFAULT_PREFERENCES,
  clampPreferences,
  type WeatherPreferences,
} from "@/lib/scoring";

/**
 * Alias, not a second vocabulary: `lib/units.ts` owns the type, because the
 * unit is a site-wide preference the map merely happens to expose a control
 * for. Two independent string unions here is how a map that says °F ends up
 * next to a country page that says °C.
 */
export type Unit = UnitSystem;

const MODE_IDS = Object.keys(DISPLAY_MODES) as DisplayModeId[];

const modeParser = parseAsStringEnum<DisplayModeId>(MODE_IDS).withDefault("preferences");
const unitParser = parseAsStringEnum<Unit>(["metric", "imperial"]).withDefault("metric");

const monthParser = parseAsInteger.withDefault(currentMonth());

const preferenceParsers = {
  // Named for day and night rather than `tmin`/`tmax`: `tmin` is the alias
  // for the daily *minimum* everywhere else in the codebase, and a URL
  // parameter that meant the opposite would be a trap.
  dmin: parseAsFloat.withDefault(DEFAULT_PREFERENCES.dayMin),
  dmax: parseAsFloat.withDefault(DEFAULT_PREFERENCES.dayMax),
  nmin: parseAsFloat.withDefault(DEFAULT_PREFERENCES.nightMin),
  nmax: parseAsFloat.withDefault(DEFAULT_PREFERENCES.nightMax),
  rmax: parseAsFloat.withDefault(DEFAULT_PREFERENCES.rainMax),
  smin: parseAsFloat.withDefault(DEFAULT_PREFERENCES.sunMin),
  // Integer, not float: it is one of four advisory levels, and `parseAsFloat`
  // would happily carry `smax=2.5` into a comparison against a level.
  smax: parseAsInteger.withDefault(DEFAULT_PREFERENCES.safetyMax),
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
        dayMin: prefsRaw.dmin,
        dayMax: prefsRaw.dmax,
        nightMin: prefsRaw.nmin,
        nightMax: prefsRaw.nmax,
        rainMax: prefsRaw.rmax,
        sunMin: prefsRaw.smin,
        safetyMax: prefsRaw.smax,
      }),
    [
      prefsRaw.dmin,
      prefsRaw.dmax,
      prefsRaw.nmin,
      prefsRaw.nmax,
      prefsRaw.rmax,
      prefsRaw.smin,
      prefsRaw.smax,
    ],
  );

  const setPreferences = useCallback(
    (next: WeatherPreferences) => {
      const clamped = clampPreferences(next);
      void setPrefsRaw({
        dmin: clamped.dayMin,
        dmax: clamped.dayMax,
        nmin: clamped.nightMin,
        nmax: clamped.nightMax,
        rmax: clamped.rainMax,
        smin: clamped.sunMin,
        smax: clamped.safetyMax,
      });
    },
    [setPrefsRaw],
  );

  const resetPreferences = useCallback(() => {
    void setPrefsRaw({
      dmin: null,
      dmax: null,
      nmin: null,
      nmax: null,
      rmax: null,
      smin: null,
      smax: null,
    });
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
