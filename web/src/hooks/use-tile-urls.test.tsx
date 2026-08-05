import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Regression: an anonymous visitor was resolved to a *premium* session (mock
 * data defaults to premium and is opt-out, so it was live in production). The
 * browser asked for premium tiles, the API correctly answered 401, and the
 * thrown error replaced the entire map with "Map unavailable" — even though
 * the free tiles had already loaded successfully.
 *
 * The premium archive is an enhancement. Failing to get one must always
 * degrade to the free map, never blank it.
 */

const fetchTileUrl = vi.fn();
vi.mock("@/lib/api-client", () => ({
  fetchTileUrl: (tier: string) => fetchTileUrl(tier),
}));

const { useTileUrls } = await import("./use-tile-urls");

// Expiry an hour out: far enough that the refresh timer never fires mid-test,
// near enough that the scheduled delay stays a sane 32-bit millisecond value.
const OK = {
  url: "https://cdn.test/free.pmtiles?sig=a",
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
};

afterEach(() => {
  fetchTileUrl.mockReset();
  vi.useRealTimers();
});

describe("useTileUrls premium failures", () => {
  it("keeps the free map when premium is refused for want of a session", async () => {
    fetchTileUrl.mockImplementation(async (tier: string) =>
      tier === "free" ? OK : "forbidden",
    );

    const { result } = renderHook(() => useTileUrls({ premium: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.freeUrl).toBe(OK.url);
    expect(result.current.premiumUrl).toBeNull();
    expect(result.current.premiumDenied).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("keeps the free map when the premium request throws outright", async () => {
    fetchTileUrl.mockImplementation(async (tier: string) => {
      if (tier === "free") return OK;
      throw new Error("fetchTileUrl(premium) failed: 500");
    });

    const { result } = renderHook(() => useTileUrls({ premium: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.freeUrl).toBe(OK.url);
    // The map stays usable; the failure shows up as a denial, not an error.
    expect(result.current.error).toBeNull();
    expect(result.current.premiumDenied).toBe(true);
  });

  it("still reports a fatal error when the free tier itself fails", async () => {
    fetchTileUrl.mockImplementation(async () => {
      throw new Error("fetchTileUrl(free) failed: 500");
    });

    const { result } = renderHook(() => useTileUrls({ premium: false }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toContain("free");
    expect(result.current.freeUrl).toBeNull();
  });
});
