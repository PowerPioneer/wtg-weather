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
 * applied only when the URL carried none, which is what `isDefaultPreferences`
 * detects — nuqs strips a param equal to its default, so "default" and "absent
 * from the URL" are the same state.
 *
 * Anonymous visitors get a 401 from the store on the first read; that disables
 * writes for the session rather than retrying on every slider drag.
 */

import { useEffect, useRef } from "react";

import { fetchOnboarding, patchOnboarding } from "@/lib/api-client";
import {
  isDefaultPreferences,
  parseWeatherPreferences,
  type WeatherPreferences,
} from "@/lib/scoring";

/** Key inside the onboarding `data` blob. */
export const STORED_PREFERENCES_KEY = "mapPreferences";

/** Slider drags fire continuously; only the value they settle on is worth a request. */
const PERSIST_DEBOUNCE_MS = 800;

export type UseStoredPreferencesOptions = {
  /** The preferences currently driving the map. */
  preferences: WeatherPreferences;
  /** Called at most once, with preferences read back from the user's record. */
  onHydrate: (preferences: WeatherPreferences) => void;
};

/** Narrow the untyped onboarding `data` blob to preferences we can trust. */
export function readStoredPreferences(
  data: Record<string, unknown> | null | undefined,
): WeatherPreferences | null {
  return parseWeatherPreferences(data?.[STORED_PREFERENCES_KEY]);
}

function fingerprint(prefs: WeatherPreferences): string {
  return `${prefs.tempMin}|${prefs.tempMax}|${prefs.rainMax}|${prefs.sunMin}`;
}

export function useStoredPreferences({
  preferences,
  onHydrate,
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

  // Declared first so it has run before the read effect below on mount.
  useEffect(() => {
    onHydrateRef.current = onHydrate;
    preferencesRef.current = preferences;
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
        if (stored && isDefaultPreferences(preferencesRef.current)) {
          lastSavedRef.current = fingerprint(stored);
          onHydrateRef.current(stored);
        } else {
          lastSavedRef.current = stored ? fingerprint(stored) : null;
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
}
