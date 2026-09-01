"use client";

/**
 * Durable weather preferences for signed-in users.
 *
 * `web/CLAUDE.md` rules out `localStorage` for preferences, so there are
 * exactly two places they can live: the URL (shareable, anonymous — handled by
 * `useMapState`) and the user's own record on the API. The onboarding wizard
 * already persists arbitrary JSON per user via `PATCH /api/onboarding`, and
 * that is the store this uses rather than inventing a second one.
 *
 * Precedence is URL-first: a shared link must show what its sender saw, not
 * what the recipient happens to have saved. Stored preferences are therefore
 * applied only when the URL carried none, which is what
 * `isDefaultPreferenceSet` detects — nuqs strips a param equal to its default,
 * so "default" and "absent from the URL" are the same state. It has to be the
 * whole-set predicate rather than the climate-only one: a link carrying just
 * `?smax=1` is still a link that said something, and hydrating over it would
 * show the reader their own safety limit on someone else's map.
 *
 * Anonymous visitors get a 401 from the store on the first read; that disables
 * writes for the session rather than retrying on every slider drag.
 */

import { useEffect, useRef } from "react";

import { fetchOnboarding, patchOnboarding } from "@/lib/api-client";
import {
  isDefaultPreferenceSet,
  parseWeatherPreferences,
  type WeatherPreferences,
} from "@/lib/scoring";
import { parseUnitSystem, type UnitSystem } from "@/lib/units";

/** Key inside the onboarding `data` blob. */
export const STORED_PREFERENCES_KEY = "mapPreferences";

/**
 * The unit rides in the same record, for the same reason: the cookie the
 * `UnitProvider` reads belongs to one browser, and a signed-in user opening
 * the map on their phone should not have to say °F again. The cookie still
 * wins on a device that has one — it is this browser's most recent statement.
 */
export const STORED_UNIT_KEY = "mapUnit";

/** Slider drags fire continuously; only the value they settle on is worth a request. */
const PERSIST_DEBOUNCE_MS = 800;

export type UseStoredPreferencesOptions = {
  /** The preferences currently driving the map. */
  preferences: WeatherPreferences;
  /** Called at most once, with preferences read back from the user's record. */
  onHydrate: (preferences: WeatherPreferences) => void;
  /** The unit currently rendering, mirrored into the same record. */
  unit?: UnitSystem;
  /** Whether this browser already had a unit cookie — if so, it wins. */
  unitFromThisBrowser?: boolean;
  /** Called at most once, with a unit read back from the user's record. */
  onHydrateUnit?: (unit: UnitSystem) => void;
};

/** Narrow the untyped onboarding `data` blob to preferences we can trust. */
export function readStoredPreferences(
  data: Record<string, unknown> | null | undefined,
): WeatherPreferences | null {
  return parseWeatherPreferences(data?.[STORED_PREFERENCES_KEY]);
}

function fingerprint(prefs: WeatherPreferences): string {
  return [
    prefs.dayMin,
    prefs.dayMax,
    prefs.nightMin,
    prefs.nightMax,
    prefs.rainMax,
    prefs.sunMin,
    prefs.safetyMax,
  ].join("|");
}

export function readStoredUnit(
  data: Record<string, unknown> | null | undefined,
): UnitSystem | null {
  return parseUnitSystem(data?.[STORED_UNIT_KEY]);
}

export function useStoredPreferences({
  preferences,
  onHydrate,
  unit,
  unitFromThisBrowser = false,
  onHydrateUnit,
}: UseStoredPreferencesOptions): void {
  // Whether the store answered at all — anonymous sessions never write.
  const writableRef = useRef(false);
  const hydratedRef = useRef(false);
  const lastSavedRef = useRef<string | null>(null);
  // Read through a ref so a caller passing an inline callback does not restart
  // the one-shot read, and so the read sees whatever was on screen by the time
  // it resolves rather than what was there when it started.
  const onHydrateRef = useRef(onHydrate);
  const preferencesRef = useRef(preferences);
  const onHydrateUnitRef = useRef(onHydrateUnit);
  const unitFromThisBrowserRef = useRef(unitFromThisBrowser);
  const lastSavedUnitRef = useRef<UnitSystem | null>(null);

  // Declared first so it has run before the read effect below on mount.
  useEffect(() => {
    onHydrateRef.current = onHydrate;
    preferencesRef.current = preferences;
    onHydrateUnitRef.current = onHydrateUnit;
    unitFromThisBrowserRef.current = unitFromThisBrowser;
  });

  useEffect(() => {
    let cancelled = false;
    fetchOnboarding()
      .then((state) => {
        if (cancelled) return;
        if (!state) return; // 401 — anonymous, nothing to read or write.
        writableRef.current = true;
        const stored = readStoredPreferences(state.data);
        // The URL wins when it carried anything at all.
        if (stored && isDefaultPreferenceSet(preferencesRef.current)) {
          lastSavedRef.current = fingerprint(stored);
          onHydrateRef.current(stored);
        } else {
          lastSavedRef.current = stored ? fingerprint(stored) : null;
        }

        const storedUnit = readStoredUnit(state.data);
        if (storedUnit) {
          lastSavedUnitRef.current = storedUnit;
          // Only for a browser that has never been told: a cookie here is a
          // more recent statement than whatever another device wrote.
          if (!unitFromThisBrowserRef.current) {
            onHydrateUnitRef.current?.(storedUnit);
          }
        }
      })
      .catch(() => {
        // A store that cannot be read is not a reason to break the map.
      })
      .finally(() => {
        if (!cancelled) hydratedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || !writableRef.current) return;
    const next = fingerprint(preferences);
    if (next === lastSavedRef.current) return;

    const timer = setTimeout(() => {
      lastSavedRef.current = next;
      void patchOnboarding({
        data: { [STORED_PREFERENCES_KEY]: preferences },
      }).catch(() => {
        // Let the next change try again rather than stranding the value.
        lastSavedRef.current = null;
      });
    }, PERSIST_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [preferences]);

  useEffect(() => {
    if (!unit) return;
    if (!hydratedRef.current || !writableRef.current) return;
    if (unit === lastSavedUnitRef.current) return;
    // No debounce: a unit changes on a click, not on a drag.
    lastSavedUnitRef.current = unit;
    void patchOnboarding({ data: { [STORED_UNIT_KEY]: unit } }).catch(() => {
      lastSavedUnitRef.current = null;
    });
  }, [unit]);
}
