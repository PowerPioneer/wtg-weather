import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * "Change plan →" for an agency that already pays. It used to open a fresh
 * checkout, which made a second subscription billing beside the first. Now the
 * first click learns the agency is subscribed and asks to confirm; only the
 * second changes the plan, and a third does nothing.
 */

const requestCheckout = vi.fn();
const requestPlanChange = vi.fn();

vi.mock("@/lib/analytics", () => ({
  ANALYTICS_EVENTS: { upgradeClick: "upgrade_click" },
  trackEvent: vi.fn(),
}));

vi.mock("@/lib/paddle", async () => {
  const actual = await vi.importActual<typeof import("@/lib/paddle")>("@/lib/paddle");
  return {
    ...actual,
    requestCheckout: (input: unknown) => requestCheckout(input),
    requestPlanChange: (input: unknown) => requestPlanChange(input),
    openCheckout: vi.fn(),
  };
});

const { UpgradeButton } = await import("./upgrade-button");
const { CheckoutAlreadySubscribed } = await import("@/lib/paddle");
const { CHECKOUT_COPY } = await import("./copy");

afterEach(() => {
  requestCheckout.mockReset();
  requestPlanChange.mockReset();
});

describe("UpgradeButton for a subscribed agency", () => {
  it("confirms, then changes the plan once", async () => {
    requestCheckout.mockRejectedValue(new CheckoutAlreadySubscribed());
    requestPlanChange.mockResolvedValue({ plan: "agency_pro", billed: "immediately" });

    render(
      <UpgradeButton
        plan="agency_pro"
        organizationId="org-1"
        source="account_billing_agency"
        label="Change plan →"
      />,
    );
    const cta = screen.getByTestId("upgrade-cta");

    fireEvent.click(cta);
    await waitFor(() => expect(cta).toHaveTextContent(CHECKOUT_COPY.confirmChange));
    expect(requestPlanChange).not.toHaveBeenCalled();

    fireEvent.click(cta);
    await waitFor(() => expect(cta).toHaveTextContent(CHECKOUT_COPY.changed));
    expect(requestPlanChange).toHaveBeenCalledTimes(1);

    fireEvent.click(cta);
    expect(requestPlanChange).toHaveBeenCalledTimes(1);
    expect(requestCheckout).toHaveBeenCalledTimes(1);
  });
});
