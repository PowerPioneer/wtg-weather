/**
 * Tiny analytics facade. Two backends live behind this:
 *   - Plausible (self-hosted) for anonymous, pre-login traffic. Pageviews are
 *     automatic; custom events go through `window.plausible(name, { props })`.
 *   - PostHog (cloud) for post-login, identified sessions. Loaded lazily from
 *     `components/analytics/posthog-provider.tsx` once a session exists.
 *
 * Callers never need to know which backend is active — `trackEvent` fires to
 * whichever is loaded. If neither is loaded (env var missing, SSR path) the
 * call is a no-op so analytics never break the render path.
 *
 * Event names are pinned to a const list so typos show up at compile time.
 */

export const ANALYTICS_EVENTS = {
  pageView: "page_view",
  mapLayerChange: "map_layer_change",
  mapFeatureSelect: "map_feature_select",
  upgradeClick: "upgrade_click",
  tripSaved: "trip_saved",
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

type EventProps = Record<string, string | number | boolean | null | undefined>;

type PlausibleFn = (
  name: string,
  opts?: { props?: EventProps; callback?: () => void },
) => void;

type PostHogLike = {
  capture: (name: string, props?: EventProps) => void;
  identify: (distinctId: string, props?: EventProps) => void;
  reset: () => void;
};

declare global {
  interface Window {
    plausible?: PlausibleFn & { q?: unknown[] };
    posthog?: PostHogLike;
  }
}

export function trackEvent(name: AnalyticsEvent, props?: EventProps): void {
  if (typeof window === "undefined") return;
  try {
    if (window.posthog) {
      window.posthog.capture(name, props);
      return;
    }
    if (window.plausible) {
      window.plausible(name, props ? { props } : undefined);
    }
  } catch {
    // Analytics must never throw into the render path.
  }
}

export function identifyUser(
  distinctId: string,
  props?: EventProps,
): void {
  if (typeof window === "undefined") return;
  try {
    window.posthog?.identify(distinctId, props);
  } catch {
    /* swallow */
  }
}

export function resetIdentity(): void {
  if (typeof window === "undefined") return;
  try {
    window.posthog?.reset();
  } catch {
    /* swallow */
  }
}
