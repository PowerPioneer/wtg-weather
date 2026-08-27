import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The durable half of the preferences: what a signed-in user's record holds,
 * and which source wins when two of them disagree. The precedence rules are
 * the whole point of this hook and each has a way of being wrong that is
 * invisible until someone opens a shared link or a second device.
 */

const fetchOnboarding = vi.fn();
const patchOnboarding = vi.fn();

vi.mock("@/lib/api-client", () => ({
  fetchOnboarding: () => fetchOnboarding(),
  patchOnboarding: (input: unknown) => patchOnboarding(input),
}));

const { useStoredPreferences, STORED_UNIT_KEY, STORED_PREFERENCES_KEY } =
  await import("./use-stored-preferences");
const { DEFAULT_PREFERENCES } = await import("@/lib/scoring");

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchOnboarding.mockReset();
  patchOnboarding.mockReset().mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useStoredPreferences", () => {
  it("hydrates a stored unit when this browser has stated nothing", async () => {
    fetchOnboarding.mockResolvedValue({ data: { [STORED_UNIT_KEY]: "imperial" } });
    const onHydrateUnit = vi.fn();

    renderHook(() =>
      useStoredPreferences({
        preferences: DEFAULT_PREFERENCES,
        onHydrate: vi.fn(),
        unit: "metric",
        unitFromThisBrowser: false,
        onHydrateUnit,
      }),
    );

    await waitFor(() => expect(onHydrateUnit).toHaveBeenCalledWith("imperial"));
  });

  it("leaves this browser's own choice alone", async () => {
    // The cookie is a more recent statement than another device's record.
    fetchOnboarding.mockResolvedValue({ data: { [STORED_UNIT_KEY]: "imperial" } });
    const onHydrateUnit = vi.fn();

    renderHook(() =>
      useStoredPreferences({
        preferences: DEFAULT_PREFERENCES,
        onHydrate: vi.fn(),
        unit: "metric",
        unitFromThisBrowser: true,
        onHydrateUnit,
      }),
    );

    await waitFor(() => expect(fetchOnboarding).toHaveBeenCalled());
    expect(onHydrateUnit).not.toHaveBeenCalled();
  });

  it("writes a changed unit back, and does not rewrite the one it just read", async () => {
    fetchOnboarding.mockResolvedValue({ data: { [STORED_UNIT_KEY]: "metric" } });

    const { rerender } = renderHook(
      ({ unit }: { unit: "metric" | "imperial" }) =>
        useStoredPreferences({
          preferences: DEFAULT_PREFERENCES,
          onHydrate: vi.fn(),
          unit,
          unitFromThisBrowser: true,
          onHydrateUnit: vi.fn(),
        }),
      { initialProps: { unit: "metric" as "metric" | "imperial" } },
    );

    await waitFor(() => expect(fetchOnboarding).toHaveBeenCalled());
    rerender({ unit: "metric" });
    expect(patchOnboarding).not.toHaveBeenCalled();

    rerender({ unit: "imperial" });
    await waitFor(() =>
      expect(patchOnboarding).toHaveBeenCalledWith({
        data: { [STORED_UNIT_KEY]: "imperial" },
      }),
    );
  });

  it("never writes for an anonymous visitor", async () => {
    // A 401 answers `null`; the hook must not retry on every change.
    fetchOnboarding.mockResolvedValue(null);

    const { rerender } = renderHook(
      ({ unit }: { unit: "metric" | "imperial" }) =>
        useStoredPreferences({
          preferences: DEFAULT_PREFERENCES,
          onHydrate: vi.fn(),
          unit,
          onHydrateUnit: vi.fn(),
        }),
      { initialProps: { unit: "metric" as "metric" | "imperial" } },
    );

    await waitFor(() => expect(fetchOnboarding).toHaveBeenCalled());
    rerender({ unit: "imperial" });
    expect(patchOnboarding).not.toHaveBeenCalled();
  });

  it("hydrates stored preferences, safety limit included", async () => {
    fetchOnboarding.mockResolvedValue({
      data: {
        [STORED_PREFERENCES_KEY]: { ...DEFAULT_PREFERENCES, safetyMax: 1 },
      },
    });
    const onHydrate = vi.fn();

    renderHook(() =>
      useStoredPreferences({
        preferences: DEFAULT_PREFERENCES,
        onHydrate,
      }),
    );

    await waitFor(() =>
      expect(onHydrate).toHaveBeenCalledWith(
        expect.objectContaining({ safetyMax: 1 }),
      ),
    );
  });

  it("does not overwrite a URL that carried only a safety limit", async () => {
    // `?smax=1` is still a link that said something. Hydrating over it would
    // show the reader their own limit on someone else's map.
    fetchOnboarding.mockResolvedValue({
      data: {
        [STORED_PREFERENCES_KEY]: { ...DEFAULT_PREFERENCES, tempMin: 2 },
      },
    });
    const onHydrate = vi.fn();

    renderHook(() =>
      useStoredPreferences({
        preferences: { ...DEFAULT_PREFERENCES, safetyMax: 1 },
        onHydrate,
      }),
    );

    await waitFor(() => expect(fetchOnboarding).toHaveBeenCalled());
    expect(onHydrate).not.toHaveBeenCalled();
  });
});
