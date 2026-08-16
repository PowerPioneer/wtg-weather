import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What a lapsed subscriber sees.
 *
 * The API answers `/api/tiles/url?tier=premium` with 403 once the entitlement
 * is gone (pinned on the other side by `test_paddle_consumer_lifecycle.py`).
 * From there the requirement is one sentence: the map falls back to free tiles
 * with an upgrade prompt, **not** a blank map.
 *
 * It is worth a whole file because of the RC-8 source flip. A premium session
 * reads country, admin-1 and admin-2 from the premium archive, so "premium is
 * refused" is not the loss of one layer — mishandled, it is the loss of every
 * layer, and the failure looks like the site being broken rather than a plan
 * having ended.
 */

const trackEvent = vi.fn();
vi.mock("@/lib/analytics", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/analytics")>("@/lib/analytics");
  return { ...actual, trackEvent };
});

const FREE_URL = "https://cdn.test/free.pmtiles?sig=free";

// Mutable so each test can pose a different tile outcome.
let tileState = {
  freeUrl: FREE_URL as string | null,
  premiumUrl: null as string | null,
  premiumDenied: false,
  loading: false,
  error: null as string | null,
};

vi.mock("@/hooks/use-tile-urls", () => ({
  useTileUrls: () => tileState,
}));

vi.mock("@/hooks/use-map-state", async () => {
  const { useState } = await import("react");
  const { DEFAULT_PREFERENCES: defaults } = await import("@/lib/scoring");
  return {
    useMapState: () => {
      const [mode, setMode] = useState("preferences");
      const [month, setMonth] = useState(4);
      return {
        mode,
        month,
        unit: "metric",
        preferences: defaults,
        setMode,
        setMonth,
        setUnit: vi.fn(),
        setPreferences: vi.fn(),
        resetPreferences: vi.fn(),
      };
    },
  };
});

vi.mock("@/hooks/use-stored-preferences", () => ({
  useStoredPreferences: () => {},
}));

const requestCheckoutUrl = vi.fn();
const redirectToCheckout = vi.fn();
vi.mock("@/lib/paddle", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/paddle")>("@/lib/paddle");
  return {
    ...actual,
    requestCheckoutUrl: (input: unknown) => requestCheckoutUrl(input),
    redirectToCheckout: (url: string) => redirectToCheckout(url),
  };
});

vi.mock("@/components/map/map-canvas", () => ({
  MapCanvas: ({
    freeTilesUrl,
    premiumTilesUrl,
  }: {
    freeTilesUrl?: string | null;
    premiumTilesUrl?: string | null;
  }) => (
    <div
      data-testid="canvas"
      data-free-url={freeTilesUrl ?? ""}
      data-premium-url={premiumTilesUrl ?? ""}
    />
  ),
}));

const { MapExperience } = await import("./map-experience");

beforeEach(() => {
  tileState = {
    freeUrl: FREE_URL,
    premiumUrl: null,
    premiumDenied: false,
    loading: false,
    error: null,
  };
  trackEvent.mockClear();
  requestCheckoutUrl.mockReset();
  redirectToCheckout.mockReset();
});

afterEach(() => cleanup());

describe("MapExperience when premium tiles are refused", () => {
  it("still draws the free map", async () => {
    // The session still *claims* premium — the plan has lapsed but the page
    // was rendered before the webhook landed. The tile endpoint is the
    // authority, and it said no.
    tileState = { ...tileState, premiumDenied: true };
    render(<MapExperience isPremium />);

    // `next/dynamic`, so the canvas arrives a tick late.
    const canvas = await screen.findByTestId("canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas.getAttribute("data-free-url")).toBe(FREE_URL);
    // Crucially not a stale premium URL: every layer would be pointed at an
    // archive the CDN is about to refuse, and the map would blank.
    expect(canvas.getAttribute("data-premium-url")).toBe("");
    // And not the error screen — the free tiles loaded fine.
    expect(screen.queryByText(/map unavailable/i)).toBeNull();
  });

  it("shows an upgrade prompt rather than failing silently", async () => {
    tileState = { ...tileState, premiumDenied: true };
    render(<MapExperience isPremium />);

    const prompt = await screen.findByRole("dialog", { name: /unlock/i });
    expect(prompt).toBeInTheDocument();
    expect(prompt).toHaveAttribute("data-feature", "admin2");
  });

  it("the prompt's CTA starts a checkout, not a trip to /pricing", async () => {
    tileState = { ...tileState, premiumDenied: true };
    requestCheckoutUrl.mockResolvedValue({
      checkoutUrl: "https://sandbox-checkout.paddle.com/checkout/custom?r=1",
      sandbox: true,
      plan: "consumer_premium",
    });

    render(<MapExperience isPremium />);
    await userEvent.click(await screen.findByTestId("popover-upgrade"));

    expect(requestCheckoutUrl).toHaveBeenCalledWith({
      plan: "consumer_premium",
      organizationId: undefined,
    });
    expect(redirectToCheckout).toHaveBeenCalledWith(
      "https://sandbox-checkout.paddle.com/checkout/custom?r=1",
    );
  });

  it("says so in the prompt when checkout itself fails, and stays open", async () => {
    tileState = { ...tileState, premiumDenied: true };
    requestCheckoutUrl.mockRejectedValue(new Error("failed: 500"));

    render(<MapExperience isPremium />);
    await userEvent.click(await screen.findByTestId("popover-upgrade"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't open checkout/i,
    );
    // The prompt is the only thing on screen explaining the situation; closing
    // it on a failed click would leave a map with no feedback at all.
    expect(screen.getByRole("dialog", { name: /unlock/i })).toBeInTheDocument();
  });

  it("lets the prompt be dismissed and the free map used", async () => {
    tileState = { ...tileState, premiumDenied: true };
    render(<MapExperience isPremium />);

    await userEvent.click(await screen.findByRole("button", { name: /dismiss/i }));
    expect(screen.queryByRole("dialog", { name: /unlock/i })).toBeNull();
    const canvas = await screen.findByTestId("canvas");
    expect(canvas.getAttribute("data-free-url")).toBe(FREE_URL);
  });

  it("shows no upgrade prompt when premium tiles are working", async () => {
    tileState = {
      ...tileState,
      premiumUrl: "https://cdn.test/premium.pmtiles?sig=p",
    };
    render(<MapExperience isPremium />);

    const canvas = await screen.findByTestId("canvas");
    expect(screen.queryByRole("dialog", { name: /unlock/i })).toBeNull();
    expect(canvas.getAttribute("data-premium-url")).toBe(
      "https://cdn.test/premium.pmtiles?sig=p",
    );
  });

  it("keeps the error screen for a free-tier failure only", () => {
    // The distinction the hook draws, checked end to end: losing premium is a
    // degradation, losing free is a broken map and should say so.
    tileState = { ...tileState, freeUrl: null, error: "fetchTileUrl(free) failed: 500" };
    render(<MapExperience isPremium={false} />);

    expect(screen.getByText(/map unavailable/i)).toBeInTheDocument();
    expect(screen.queryByTestId("canvas")).toBeNull();
  });
});
