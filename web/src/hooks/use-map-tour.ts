"use client";

/**
 * Whether the map's first-visit guide is showing, which step it is on, and the
 * record that it has been seen.
 *
 * The decision is made once, on mount: this browser's `wtg_tour` cookie first,
 * because it needs no request; then the signed-in user's onboarding blob, so a
 * second device does not ask again (and the cookie is written on the way past,
 * so the next visit skips the request). Anonymous visitors get a 401 there and
 * see the tour.
 *
 * It is not shown until `ready` — the map's first paint — because a bubble
 * explaining colours over a "Loading map" placeholder explains nothing.
 * Skipping counts as seen: someone who dismissed it once does not want it on
 * every visit, and the "?" button brings it back on request.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchOnboarding, patchOnboarding } from "@/lib/api-client";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import {
  hasSeenTour,
  MAP_TOUR_STEPS,
  STORED_TOUR_KEY,
  TOUR_COOKIE,
  TOUR_COOKIE_MAX_AGE,
  TOUR_VERSION,
  type TourStep,
} from "@/lib/map-tour";

type Phase = "checking" | "unseen" | "active" | "done";

export type MapTour = {
  /** The step on screen, or `null` when the tour is not showing. */
  step: TourStep | null;
  index: number;
  total: number;
  next: () => void;
  back: () => void;
  /** Close early. Still recorded as seen. */
  skip: () => void;
  /** Start again from the first step, whatever was recorded. */
  restart: () => void;
};

export function useMapTour({ ready }: { ready: boolean }): MapTour {
  // Read in the initialiser rather than an effect: nothing renders from this
  // until `ready`, which is client-only, so the server's "checking" cannot
  // produce a hydration mismatch.
  const [phase, setPhase] = useState<Phase>(() =>
    typeof document !== "undefined" && hasSeenTour(readCookie(TOUR_COOKIE))
      ? "done"
      : "checking",
  );
  const [index, setIndex] = useState(0);
  const signedInRef = useRef(false);

  useEffect(() => {
    if (phase !== "checking") return;
    let cancelled = false;
    fetchOnboarding()
      .then((state) => {
        if (cancelled) return;
        if (state) {
          signedInRef.current = true;
          if (hasSeenTour(state.data[STORED_TOUR_KEY])) {
            writeCookie();
            setPhase("done");
            return;
          }
        }
        setPhase("unseen");
      })
      .catch(() => {
        // A store that cannot be read is not a reason to withhold the guide.
        if (!cancelled) setPhase("unseen");
      });
    return () => {
      cancelled = true;
    };
    // Once per mount: the cookie answer is fixed by the initialiser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = phase === "active" || (phase === "unseen" && ready);
  const total = MAP_TOUR_STEPS.length;

  const close = useCallback(
    (action: "completed" | "skipped") => {
      trackEvent(ANALYTICS_EVENTS.mapTour, {
        action,
        step: MAP_TOUR_STEPS[index].id,
      });
      setPhase("done");
      setIndex(0);
      writeCookie();
      if (signedInRef.current) {
        void patchOnboarding({ data: { [STORED_TOUR_KEY]: TOUR_VERSION } }).catch(
          () => {
            // The cookie already holds it for this browser.
          },
        );
      }
    },
    [index],
  );

  const next = useCallback(() => {
    if (index >= total - 1) close("completed");
    else {
      setPhase("active");
      setIndex(index + 1);
    }
  }, [close, index, total]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const skip = useCallback(() => close("skipped"), [close]);
  const restart = useCallback(() => {
    setIndex(0);
    setPhase("active");
  }, []);

  return {
    step: active ? MAP_TOUR_STEPS[index] : null,
    index,
    total,
    next,
    back,
    skip,
    restart,
  };
}

function readCookie(name: string): string | null {
  for (const part of document.cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function writeCookie(): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${TOUR_COOKIE}=${TOUR_VERSION}; Path=/; Max-Age=${TOUR_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}
