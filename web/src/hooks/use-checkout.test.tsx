import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The checkout handoff, which before WS-B did not exist on any surface: the
 * pricing page's Try Premium pointed at `/api/billing/checkout`, a route this
 * repo has never had, and the map's popover CTA navigated to `/pricing` — the
 * page the visitor had usually just come from.
 *
 * Three behaviours are load-bearing and each has cost something before:
 *   - the browser never builds a Paddle URL (that is `lib/paddle.ts`'s
 *     contract; the price ids live server-side and nowhere else),
 *   - an anonymous click is a sign-in bounce that *resumes*, not an error,
 *   - a double click is one checkout, not two.
 */

const requestCheckoutUrl = vi.fn();
const redirectToCheckout = vi.fn();
const trackEvent = vi.fn();

vi.mock("@/lib/analytics", () => ({
  ANALYTICS_EVENTS: { upgradeClick: "upgrade_click" },
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

vi.mock("@/lib/paddle", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/paddle")>("@/lib/paddle");
  return {
    ...actual,
    requestCheckoutUrl: (input: unknown) => requestCheckoutUrl(input),
    redirectToCheckout: (url: string) => redirectToCheckout(url),
  };
});

const { useCheckout } = await import("./use-checkout");
const { CheckoutSignInRequired } = await import("@/lib/paddle");

const assign = vi.fn();

beforeEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { assign, href: "http://localhost/pricing" },
  });
});

afterEach(() => {
  requestCheckoutUrl.mockReset();
  redirectToCheckout.mockReset();
  trackEvent.mockReset();
  assign.mockReset();
});

describe("useCheckout", () => {
  it("asks the API for a URL and hands the browser to it", async () => {
    requestCheckoutUrl.mockResolvedValue({
      checkoutUrl: "https://sandbox-checkout.paddle.com/checkout/custom?x=1",
      sandbox: true,
      plan: "consumer_premium",
    });

    const { result } = renderHook(() => useCheckout());
    await act(async () => {
      await result.current.start({ plan: "consumer_premium", source: "pricing" });
    });

    expect(requestCheckoutUrl).toHaveBeenCalledWith({
      plan: "consumer_premium",
      organizationId: undefined,
    });
    expect(redirectToCheckout).toHaveBeenCalledWith(
      "https://sandbox-checkout.paddle.com/checkout/custom?x=1",
    );
    expect(result.current.error).toBeNull();
  });

  it("passes the organization through for an agency plan", async () => {
    requestCheckoutUrl.mockResolvedValue({
      checkoutUrl: "https://sandbox-checkout.paddle.com/x",
      sandbox: true,
      plan: "agency_pro",
    });

    const { result } = renderHook(() => useCheckout());
    await act(async () => {
      await result.current.start({
        plan: "agency_pro",
        organizationId: "org-1",
        source: "pricing",
      });
    });

    expect(requestCheckoutUrl).toHaveBeenCalledWith({
      plan: "agency_pro",
      organizationId: "org-1",
    });
  });

  it("bounces an anonymous visitor through sign-in, carrying the plan", async () => {
    requestCheckoutUrl.mockRejectedValue(new CheckoutSignInRequired());

    const { result } = renderHook(() => useCheckout());
    await act(async () => {
      await result.current.start({ plan: "consumer_premium", source: "pricing" });
    });

    // Not an error state — this is the expected path for a signed-out click,
    // and the destination has to be recoverable or the visitor lands back on a
    // generic page having forgotten what they were buying.
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe("signin");
    expect(assign).toHaveBeenCalledTimes(1);
    const target = assign.mock.calls[0][0] as string;
    expect(target).toContain("/login?next=");
    expect(decodeURIComponent(target)).toContain("/upgrade?plan=consumer_premium");
  });

  it("surfaces a failure without leaking the status code", async () => {
    requestCheckoutUrl.mockRejectedValue(
      new Error("requestCheckoutUrl(consumer_premium) failed: 500"),
    );

    const { result } = renderHook(() => useCheckout());
    await act(async () => {
      await result.current.start({ plan: "consumer_premium", source: "pricing" });
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("checkout-failed");
    expect(result.current.error).not.toContain("500");
    expect(redirectToCheckout).not.toHaveBeenCalled();
  });

  it("lets a failed attempt be retried after reset", async () => {
    requestCheckoutUrl.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useCheckout());
    await act(async () => {
      await result.current.start({ plan: "consumer_premium", source: "pricing" });
    });
    expect(result.current.status).toBe("error");

    requestCheckoutUrl.mockResolvedValue({
      checkoutUrl: "https://sandbox-checkout.paddle.com/y",
      sandbox: true,
      plan: "consumer_premium",
    });
    act(() => result.current.reset());
    await act(async () => {
      await result.current.start({ plan: "consumer_premium", source: "pricing" });
    });
    expect(redirectToCheckout).toHaveBeenCalledWith(
      "https://sandbox-checkout.paddle.com/y",
    );
  });

  it("does not start a second checkout while one is in flight", async () => {
    requestCheckoutUrl.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                checkoutUrl: "https://sandbox-checkout.paddle.com/z",
                sandbox: true,
                plan: "consumer_premium",
              }),
            10,
          ),
        ),
    );

    const { result } = renderHook(() => useCheckout());
    await act(async () => {
      const a = result.current.start({ plan: "consumer_premium", source: "pricing" });
      const b = result.current.start({ plan: "consumer_premium", source: "pricing" });
      await Promise.all([a, b]);
    });

    expect(requestCheckoutUrl).toHaveBeenCalledTimes(1);
  });

  it("reports the source it was started from", async () => {
    requestCheckoutUrl.mockResolvedValue({
      checkoutUrl: "https://sandbox-checkout.paddle.com/q",
      sandbox: true,
      plan: "consumer_premium",
    });
    const { result } = renderHook(() => useCheckout());
    await act(async () => {
      await result.current.start({
        plan: "consumer_premium",
        source: "map_popover",
        properties: { feature: "admin2" },
      });
    });

    expect(trackEvent).toHaveBeenCalledWith("upgrade_click", {
      source: "map_popover",
      plan: "consumer_premium",
      feature: "admin2",
    });
  });
});
