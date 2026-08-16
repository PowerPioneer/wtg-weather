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

/**
 * The downgrade half. A subscription can lapse *while the page is open* —
 * cancelled in another tab, a failed renewal, a refund — and the signed URL is
 * re-requested about a minute before its 15-minute expiry, so the next refresh
 * is the first thing to hear about it.
 *
 * This matters more than it looks because of the RC-8 source flip: a premium
 * session reads country, admin-1 *and* admin-2 from the premium archive, so
 * holding onto a premium URL whose entitlement is gone does not degrade the map
 * to fewer layers — it points every layer at an archive we are about to stop
 * being allowed to fetch, and the map goes blank when the signature expires.
 */
describe("useTileUrls mid-session downgrade", () => {
  it("drops the premium URL when a refresh comes back 403", async () => {
    const soon = Math.floor(Date.now() / 1000) + 61; // refresh in ~1s
    let premiumCalls = 0;
    fetchTileUrl.mockImplementation(async (tier: string) => {
      if (tier === "free") return OK;
      premiumCalls += 1;
      // Entitled on first load, refused on the refresh.
      return premiumCalls === 1
        ? { url: "https://cdn.test/premium.pmtiles?sig=p", expiresAt: soon }
        : "forbidden";
    });

    const { result } = renderHook(() => useTileUrls({ premium: true }));

    await waitFor(() =>
      expect(result.current.premiumUrl).toBe(
        "https://cdn.test/premium.pmtiles?sig=p",
      ),
    );

    // The scheduled refresh fires and is refused.
    await waitFor(() => expect(premiumCalls).toBe(2), { timeout: 4000 });

    await waitFor(() => expect(result.current.premiumUrl).toBeNull());
    expect(result.current.premiumDenied).toBe(true);
    // The free map is untouched — that is the whole point of degrading.
    expect(result.current.freeUrl).toBe(OK.url);
    expect(result.current.error).toBeNull();
  });

  it("drops the premium URL when the refresh throws rather than 403s", async () => {
    const soon = Math.floor(Date.now() / 1000) + 61;
    let premiumCalls = 0;
    fetchTileUrl.mockImplementation(async (tier: string) => {
      if (tier === "free") return OK;
      premiumCalls += 1;
      if (premiumCalls === 1) {
        return { url: "https://cdn.test/premium.pmtiles?sig=q", expiresAt: soon };
      }
      throw new Error("fetchTileUrl(premium) failed: 500");
    });

    const { result } = renderHook(() => useTileUrls({ premium: true }));
    await waitFor(() => expect(result.current.premiumUrl).not.toBeNull());
    await waitFor(() => expect(premiumCalls).toBe(2), { timeout: 4000 });

    // A URL we can no longer refresh is a URL that expires under the user.
    await waitFor(() => expect(result.current.premiumUrl).toBeNull());
    expect(result.current.freeUrl).toBe(OK.url);
    expect(result.current.error).toBeNull();
  });
});
