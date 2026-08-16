import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The moment right after someone pays.
 *
 * The subscription is not active when this page loads: Paddle redirects the
 * browser and posts the webhook separately, and `/api/me` keeps answering with
 * the old plan for up to 60 more seconds because entitlements are cached in
 * Redis for that long. Everything below is about not looking broken during
 * that window, and about the window actually ending.
 *
 * The acceptance criterion this pins is "within ~60s without a reload loop".
 */

const fetchMe = vi.fn();
vi.mock("@/lib/api-client", () => ({ fetchMe: () => fetchMe() }));

const { CheckoutSuccess } = await import("./checkout-success");

const FREE = { id: "u1", email: "a@b.c", name: null, plan: "free", role: null, createdAt: null, org: null };
const PREMIUM = { ...FREE, plan: "consumer_premium" };

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  fetchMe.mockReset();
});

describe("CheckoutSuccess", () => {
  it("says what it is waiting for instead of spinning silently", () => {
    fetchMe.mockResolvedValue(FREE);
    render(<CheckoutSuccess />);

    expect(screen.getByTestId("checkout-success")).toHaveAttribute(
      "data-phase",
      "waiting",
    );
    // The payment is acknowledged immediately — the uncertainty is only about
    // activation, and conflating the two panics people.
    expect(screen.getByText(/payment received/i)).toBeInTheDocument();
    expect(screen.getByText(/activating your subscription/i)).toBeInTheDocument();
    expect(screen.getByTestId("checkout-waiting")).toBeInTheDocument();
  });

  it("flips to active once the webhook has landed, and stops polling", async () => {
    fetchMe.mockResolvedValueOnce(FREE).mockResolvedValue(PREMIUM);
    render(<CheckoutSuccess />);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(screen.getByTestId("checkout-success")).toHaveAttribute("data-phase", "waiting");

    await vi.advanceTimersByTimeAsync(3_000);
    await waitFor(() =>
      expect(screen.getByTestId("checkout-success")).toHaveAttribute(
        "data-phase",
        "active",
      ),
    );
    expect(screen.getByText(/premium is active/i)).toBeInTheDocument();

    // The poll must stop. A page that keeps asking forever after it has its
    // answer is the "reload loop" the acceptance criterion rules out.
    const callsAtSuccess = fetchMe.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMe.mock.calls.length).toBe(callsAtSuccess);
  });

  it("gives up with an explanation rather than polling forever", async () => {
    fetchMe.mockResolvedValue(FREE);
    render(<CheckoutSuccess />);

    await vi.advanceTimersByTimeAsync(130_000);
    await waitFor(() =>
      expect(screen.getByTestId("checkout-success")).toHaveAttribute(
        "data-phase",
        "slow",
      ),
    );
    // It must still be clear the money moved and the receipt exists — this is
    // the state where a vague message reads as "your payment vanished".
    expect(screen.getByText(/payment went through/i)).toBeInTheDocument();

    const callsAtDeadline = fetchMe.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMe.mock.calls.length).toBe(callsAtDeadline);
  });

  it("does not treat a failed poll as a failed payment", async () => {
    fetchMe.mockRejectedValueOnce(new Error("network")).mockResolvedValue(PREMIUM);
    render(<CheckoutSuccess />);

    await vi.advanceTimersByTimeAsync(3_000);
    // Still waiting, not erroring — one dropped fetch says nothing about the
    // transaction, which already completed at Paddle.
    expect(screen.getByTestId("checkout-success")).toHaveAttribute("data-phase", "waiting");

    await vi.advanceTimersByTimeAsync(3_000);
    await waitFor(() =>
      expect(screen.getByTestId("checkout-success")).toHaveAttribute("data-phase", "active"),
    );
  });

  it("renders active immediately when the server already saw the upgrade", () => {
    fetchMe.mockResolvedValue(PREMIUM);
    render(<CheckoutSuccess initiallyPremium />);

    expect(screen.getByTestId("checkout-success")).toHaveAttribute("data-phase", "active");
    // No poll at all — the answer was in the server render.
    expect(fetchMe).not.toHaveBeenCalled();
  });

  it("always offers a way onward", () => {
    fetchMe.mockResolvedValue(FREE);
    render(<CheckoutSuccess />);
    expect(screen.getByRole("link", { name: /open the map/i })).toHaveAttribute(
      "href",
      "/map",
    );
    expect(screen.getByRole("link", { name: /account/i })).toHaveAttribute(
      "href",
      "/account?s=billing",
    );
  });
});
