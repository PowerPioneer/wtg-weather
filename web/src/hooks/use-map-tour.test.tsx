import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TOUR_COOKIE, TOUR_VERSION } from "@/lib/map-tour";

const trackEvent = vi.fn();
vi.mock("@/lib/analytics", async () => {
  const actual = await vi.importActual<typeof import("@/lib/analytics")>(
    "@/lib/analytics",
  );
  return { ...actual, trackEvent };
});

const fetchOnboarding = vi.fn();
const patchOnboarding = vi.fn(async () => ({
  kind: null,
  step: 0,
  completed: false,
  data: {},
}));
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>(
    "@/lib/api-client",
  );
  return { ...actual, fetchOnboarding, patchOnboarding };
});

const { useMapTour } = await import("./use-map-tour");

function signedIn(data: Record<string, unknown> = {}) {
  return { kind: null, step: 0, completed: false, data };
}

beforeEach(() => {
  fetchOnboarding.mockResolvedValue(null);
});

afterEach(() => {
  document.cookie = `${TOUR_COOKIE}=; Path=/; Max-Age=0`;
  vi.clearAllMocks();
});

describe("useMapTour", () => {
  it("waits for the map before showing the first step", async () => {
    const { result, rerender } = renderHook(({ ready }) => useMapTour({ ready }), {
      initialProps: { ready: false },
    });
    await waitFor(() => expect(fetchOnboarding).toHaveBeenCalled());
    expect(result.current.step).toBeNull();

    rerender({ ready: true });
    await waitFor(() => expect(result.current.step?.id).toBe("intro"));
  });

  it("never shows, and never asks the API, once this browser has seen it", async () => {
    document.cookie = `${TOUR_COOKIE}=${TOUR_VERSION}; Path=/`;
    const { result } = renderHook(() => useMapTour({ ready: true }));
    await act(async () => {});
    expect(result.current.step).toBeNull();
    expect(fetchOnboarding).not.toHaveBeenCalled();
  });

  it("stays hidden for a user who saw it on another device, and remembers that here", async () => {
    fetchOnboarding.mockResolvedValue(signedIn({ mapTour: TOUR_VERSION }));
    const { result } = renderHook(() => useMapTour({ ready: true }));
    await waitFor(() => expect(document.cookie).toContain(`${TOUR_COOKIE}=${TOUR_VERSION}`));
    expect(result.current.step).toBeNull();
  });

  it("still shows when the store cannot be read", async () => {
    fetchOnboarding.mockRejectedValue(new Error("502"));
    const { result } = renderHook(() => useMapTour({ ready: true }));
    await waitFor(() => expect(result.current.step?.id).toBe("intro"));
  });

  it("walks forward and back, and finishing records it in both places", async () => {
    fetchOnboarding.mockResolvedValue(signedIn());
    const { result } = renderHook(() => useMapTour({ ready: true }));
    await waitFor(() => expect(result.current.step?.id).toBe("intro"));

    act(() => result.current.next());
    expect(result.current.step?.id).toBe("month");
    act(() => result.current.back());
    expect(result.current.step?.id).toBe("intro");

    for (let i = 0; i < result.current.total; i++) act(() => result.current.next());

    expect(result.current.step).toBeNull();
    expect(document.cookie).toContain(`${TOUR_COOKIE}=${TOUR_VERSION}`);
    expect(patchOnboarding).toHaveBeenCalledWith({ data: { mapTour: TOUR_VERSION } });
    expect(trackEvent).toHaveBeenCalledWith("map_tour", {
      action: "completed",
      step: "place",
    });
  });

  it("counts a skip as seen, but writes nothing to an anonymous account", async () => {
    const { result } = renderHook(() => useMapTour({ ready: true }));
    await waitFor(() => expect(result.current.step?.id).toBe("intro"));

    act(() => result.current.skip());

    expect(result.current.step).toBeNull();
    expect(document.cookie).toContain(`${TOUR_COOKIE}=${TOUR_VERSION}`);
    expect(patchOnboarding).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith("map_tour", {
      action: "skipped",
      step: "intro",
    });
  });

  it("restarts from the first step on request, whatever was recorded", async () => {
    document.cookie = `${TOUR_COOKIE}=${TOUR_VERSION}; Path=/`;
    const { result } = renderHook(() => useMapTour({ ready: true }));
    act(() => result.current.restart());
    expect(result.current.step?.id).toBe("intro");
  });
});
