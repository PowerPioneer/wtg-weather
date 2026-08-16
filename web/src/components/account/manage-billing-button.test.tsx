import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The "manage subscription" control.
 *
 * What stood here was `<a href="https://paddle.com">Manage subscription on
 * Paddle ↗</a>` — the company's marketing homepage, shown to every subscriber.
 * Cancelling was, in practice, not possible from the account page.
 *
 * The replacement asks the API to mint a portal session. It never builds a
 * Paddle URL and never sends a customer id: the id is resolved server-side
 * from the caller's own organization, because a portal session opens saved
 * payment methods and invoice history.
 */

const { ManageBillingButton } = await import("./manage-billing-button");

const assign = vi.fn();
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { assign, href: "http://localhost/account" },
  });
});

afterEach(() => {
  fetchMock.mockReset();
  assign.mockReset();
  vi.unstubAllGlobals();
});

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}
function status(code: number) {
  return { ok: false, status: code, json: async () => ({}) } as unknown as Response;
}

describe("ManageBillingButton", () => {
  it("renders nothing when the API says no portal can be minted", () => {
    render(<ManageBillingButton label="Manage" available={false} />);
    // Better than a button that fails on click for a reason the visitor
    // cannot act on.
    expect(screen.queryByTestId("manage-billing")).toBeNull();
  });

  it("follows the URL the API mints, and sends no customer id", async () => {
    fetchMock.mockResolvedValue(
      ok({ portal_url: "https://sandbox-customer-portal.paddle.com/cpl_1", sandbox: true }),
    );

    render(<ManageBillingButton label="Manage" available />);
    await userEvent.click(screen.getByTestId("manage-billing"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/billing/portal");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    // No body at all: nothing this component knows may steer which customer
    // the portal is opened for.
    expect(init.body).toBeUndefined();

    expect(assign).toHaveBeenCalledWith(
      "https://sandbox-customer-portal.paddle.com/cpl_1",
    );
  });

  it("distinguishes 'nothing to manage' from 'that went wrong'", async () => {
    fetchMock.mockResolvedValue(status(404));
    render(<ManageBillingButton label="Manage" available />);
    await userEvent.click(screen.getByTestId("manage-billing"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no subscription on file/i,
    );
    expect(assign).not.toHaveBeenCalled();
  });

  it("reassures that the subscription is untouched when minting fails", async () => {
    // 503 is the unconfigured environment; 502 is Paddle refusing. Neither is
    // anything to do with the subscription, and a vague error here reads as
    // "your billing is broken".
    fetchMock.mockResolvedValue(status(503));
    render(<ManageBillingButton label="Manage" available />);
    await userEvent.click(screen.getByTestId("manage-billing"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /subscription is unaffected/i,
    );
    expect(assign).not.toHaveBeenCalled();
  });

  it("never navigates on a malformed response", async () => {
    fetchMock.mockResolvedValue(ok({ portal_url: 42 }));
    render(<ManageBillingButton label="Manage" available />);
    await userEvent.click(screen.getByTestId("manage-billing"));

    expect(assign).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
