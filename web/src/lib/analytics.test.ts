import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANALYTICS_EVENTS,
  identifyUser,
  resetIdentity,
  trackEvent,
} from "./analytics";

describe("analytics", () => {
  beforeEach(() => {
    delete window.plausible;
    delete window.posthog;
  });

  afterEach(() => {
    delete window.plausible;
    delete window.posthog;
  });

  it("is a no-op when no backend is loaded", () => {
    expect(() => trackEvent(ANALYTICS_EVENTS.pageView)).not.toThrow();
  });

  it("routes to posthog when posthog is loaded", () => {
    const capture = vi.fn();
    const identify = vi.fn();
    const reset = vi.fn();
    window.posthog = { capture, identify, reset };
    trackEvent(ANALYTICS_EVENTS.mapLayerChange, { mode: "temperature" });
    identifyUser("u_123", { plan: "premium" });
    resetIdentity();
    expect(capture).toHaveBeenCalledWith("map_layer_change", { mode: "temperature" });
    expect(identify).toHaveBeenCalledWith("u_123", { plan: "premium" });
    expect(reset).toHaveBeenCalledOnce();
  });

  it("falls back to plausible when posthog is absent", () => {
    const plausible = vi.fn() as unknown as typeof window.plausible;
    window.plausible = plausible;
    trackEvent(ANALYTICS_EVENTS.upgradeClick, { tier: "premium" });
    expect(plausible).toHaveBeenCalledWith("upgrade_click", {
      props: { tier: "premium" },
    });
  });

  it("swallows backend errors", () => {
    window.posthog = {
      capture: () => {
        throw new Error("kaboom");
      },
      identify: () => {
        throw new Error("kaboom");
      },
      reset: () => {
        throw new Error("kaboom");
      },
    };
    expect(() => trackEvent(ANALYTICS_EVENTS.tripSaved)).not.toThrow();
    expect(() => identifyUser("u")).not.toThrow();
    expect(() => resetIdentity()).not.toThrow();
  });
});
