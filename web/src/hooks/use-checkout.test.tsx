import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The checkout handoff, which before WS-B did not exist on any surface: the
 * pricing page's Try Premium pointed at `/api/billing/checkout`, a route this
 * repo has never had, and the map's popover CTA navigated to `/pricing` — the
 * page the visitor had usually just come from.
 *
 * Three behaviours are load-bearing and each has cost something before:
 *   - the browser never names a price (that is `lib/paddle.ts`'s contract;
 *     the price ids and `custom_data` live server-side and nowhere else, so
 *     the overlay is opened by transaction id),
 *   - an anonymous click is a sign-in bounce that *resumes*, not an error,
 *   - a double click is one checkout, not two.
 */

const requestCheckout = vi.fn();
const openCheckout = vi.fn();
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
    requestCheckout: (input: unknown) => requestCheckout(input),
    openCheckout: (checkout: unknown) => openCheckout(checkout),
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
  requestCheckout.mockReset();
  openCheckout.mockReset();
  trackEvent.mockReset();
  assign.mockReset();
});

describe("useCheckout", () => {
  it("asks the API for a transaction and opens the overlay on it", async () => {
    requestCheckout.mockResolvedValue({
      transactionId: "txn_01aaa",
      checkoutUrl: null,
      sandbox: true,
      plan: "consumer_premium",
    });

    const { result } = renderHook(() => useCheckout());
    await act(async () => {
      await result.current.start({ plan: "consumer_premium", source: "pricing" });
    });

    expect(requestCheckout).toHaveBeenCalledWith({
      plan: "consumer_premium",
      organizationId: undefined,
    });
    expect(openCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: "txn_01aaa" }),
    );
    expect(result.current.error).toBeNull();
  });

  it("passes the organization through for an agency plan", async () => {
    requestCheckout.mockResolvedValue({
      transactionId: "txn_01bbb",
      checkoutUrl: null,
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

    expect(requestCheckout).toHaveBeenCalledWith({
      plan: "agency_pro",
      organizationId: "org-1",
    });
  });

  it("bounces an anonymous visitor through sign-in, carrying the plan", async () => {
    requestCheckout.mockRejectedValue(new CheckoutSignInRequired());

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
    requestCheckout.mockRejectedValue(
      new Error("requestCheckout(consumer_premium) failed: 500"),
    );

    const { result } = renderHook(() => useCheckout());
    await act(async () => {
      await result.current.start({ plan: "consumer_premium", source: "pricing" });
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("checkout-failed");
    expect(result.current.error).not.toContain("500");
    expect(openCheckout).not.toHaveBeenCalled();
  });

  it("lets a failed attempt be retried after reset", async () => {
    requestCheckout.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useCheckout());
    await act(async () => {
      await result.current.start({ plan: "consumer_premium", source: "pricing" });
    });
    expect(result.current.status).toBe("error");

    requestCheckout.mockResolvedValue({
      transactionId: "txn_01ccc",
      checkoutUrl: null,
      sandbox: true,
      plan: "consumer_premium",
    });
    act(() => result.current.reset());
    await act(async () => {
      await result.current.start({ plan: "consumer_premium", source: "pricing" });
    });
    expect(openCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: "txn_01ccc" }),
    );
  });

  it("does not start a second checkout while one is in flight", async () => {
    requestCheckout.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                transactionId: "txn_01ddd",
      checkoutUrl: null,
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

    expect(requestCheckout).toHaveBeenCalledTimes(1);
  });

  it("reports the source it was started from", async () => {
    requestCheckout.mockResolvedValue({
      transactionId: "txn_01eee",
      checkoutUrl: null,
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
