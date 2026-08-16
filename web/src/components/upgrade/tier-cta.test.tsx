import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The pricing page's CTAs. The regression being pinned is blunt: all three
 * paid tiers linked to `/api/billing/checkout?tier=…`, a route that has never
 * existed in this repo, so the primary action of the pricing page 404'd.
 *
 * The other half of what these assert is progressive enhancement. The CTA is a
 * real anchor at a working server route, because hydration on the pricing page
 * is not instant and a visitor who clicks in that window must not be ignored.
 */

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

const { TierCta } = await import("./tier-cta");
const { findTier, consumerTiers } = await import("./copy");

afterEach(() => {
  requestCheckoutUrl.mockReset();
  redirectToCheckout.mockReset();
});

function tier(id: Parameters<typeof findTier>[0]) {
  const t = findTier(id);
  if (!t) throw new Error(`missing tier ${id}`);
  return t;
}

describe("TierCta", () => {
  it("points the premium tier at a route that exists", () => {
    render(<TierCta tier={tier("premium")} />);
    const cta = screen.getByTestId("upgrade-cta");
    // Not `/api/billing/checkout` — nothing serves that.
    expect(cta.getAttribute("href")).toBe("/upgrade?plan=consumer_premium");
    expect(cta).toHaveAttribute("data-plan", "consumer_premium");
  });

  it("requests a checkout URL with the right plan on click", async () => {
    requestCheckoutUrl.mockResolvedValue({
      checkoutUrl: "https://sandbox-checkout.paddle.com/checkout/custom?p=1",
      sandbox: true,
      plan: "consumer_premium",
    });

    render(<TierCta tier={tier("premium")} />);
    await userEvent.click(screen.getByTestId("upgrade-cta"));

    expect(requestCheckoutUrl).toHaveBeenCalledWith({
      plan: "consumer_premium",
      organizationId: undefined,
    });
    expect(redirectToCheckout).toHaveBeenCalledWith(
      "https://sandbox-checkout.paddle.com/checkout/custom?p=1",
    );
  });

  it("maps each agency tier to its own plan", () => {
    const { rerender } = render(<TierCta tier={tier("starter")} />);
    expect(screen.getByTestId("upgrade-cta")).toHaveAttribute(
      "data-plan",
      "agency_starter",
    );
    rerender(<TierCta tier={tier("pro")} />);
    expect(screen.getByTestId("upgrade-cta")).toHaveAttribute(
      "data-plan",
      "agency_pro",
    );
  });

  it("leaves the free tier as an ordinary link to the map", () => {
    render(<TierCta tier={tier("free")} />);
    expect(screen.queryByTestId("upgrade-cta")).toBeNull();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/map");
  });

  it("sends enterprise to a conversation, not to checkout", () => {
    render(<TierCta tier={tier("enterprise")} />);
    expect(screen.queryByTestId("upgrade-cta")).toBeNull();
    expect(screen.getByRole("link").getAttribute("href")).toMatch(/^mailto:/);
  });

  it("says so when checkout cannot be opened, and charges nothing", async () => {
    requestCheckoutUrl.mockRejectedValue(new Error("failed: 502"));
    render(<TierCta tier={tier("premium")} />);
    await userEvent.click(screen.getByTestId("upgrade-cta"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't open checkout/i);
    expect(redirectToCheckout).not.toHaveBeenCalled();
  });

  it("gives every publicly listed tier a working destination", () => {
    // The blanket version of the first test: no tier on the pricing page may
    // render a CTA that goes nowhere.
    for (const t of consumerTiers()) {
      const { unmount } = render(<TierCta tier={t} />);
      const link = screen.getByRole("link");
      const href = link.getAttribute("href") ?? "";
      expect(href).not.toBe("");
      expect(href).not.toContain("/api/billing/checkout");
      unmount();
    }
  });
});
