import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The default payment link page's states.
 *
 * The one under real pressure is the timeout. Paddle accepting a transaction
 * and then failing to render its overlay is a state that actually occurred,
 * and this page used to sit on "Opening checkout…" forever when it did — no
 * error, no way onward, on the page customers reach from a card-expiry email.
 */

const getPaddle = vi.fn();

// The component short-circuits to "unavailable" without a client token, which
// is correct in production and useless here — the token is inlined at build
// time and the test build has none.
vi.mock("@/lib/env", async () => {
  const actual = await vi.importActual<typeof import("@/lib/env")>("@/lib/env");
  return { ...actual, PADDLE_CLIENT_TOKEN: "test_abc123" };
});

vi.mock("@/lib/paddle", async () => {
  const actual = await vi.importActual<typeof import("@/lib/paddle")>("@/lib/paddle");
  return { ...actual, getPaddle: () => getPaddle() };
});

const { PaddlePaymentLink } = await import("./paddle-payment-link");
const { PADDLE_EVENT } = await import("@/lib/paddle");

function withQuery(search: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { search, href: `https://example.com/checkout/pay${search}` },
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  getPaddle.mockResolvedValue({});
  withQuery("?_ptxn=txn_01abc");
});

afterEach(() => {
  vi.useRealTimers();
  getPaddle.mockReset();
});

describe("PaddlePaymentLink", () => {
  it("gives up and offers a way out when the overlay never opens", async () => {
    render(<PaddlePaymentLink />);
    expect(screen.getByText("Opening checkout…")).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(16_000);

    await waitFor(() =>
      expect(screen.getByText("The payment window didn't open")).toBeInTheDocument(),
    );
    // Nothing has been charged is the load-bearing half of that message.
    expect(screen.getByText(/Nothing has been charged/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /account/i })).toBeInTheDocument();
  });

  it("stays quiet when Paddle reports the checkout opened", async () => {
    render(<PaddlePaymentLink />);
    await waitFor(() => expect(getPaddle).toHaveBeenCalled());

    window.dispatchEvent(
      new CustomEvent(PADDLE_EVENT, { detail: "checkout.loaded" }),
    );
    await vi.advanceTimersByTimeAsync(16_000);

    // The overlay is up and covering this text; replacing it with an error
    // behind the checkout would be a lie the moment somebody closed it.
    expect(screen.getByText("Opening checkout…")).toBeInTheDocument();
  });

  it("says so when there is no transaction to open", async () => {
    withQuery("");
    render(<PaddlePaymentLink />);
    await waitFor(() =>
      expect(screen.getByText("Nothing to pay for here")).toBeInTheDocument(),
    );
  });

  it("reports an unconfigured or misconfigured Paddle without waiting", async () => {
    getPaddle.mockRejectedValue(new Error("no token"));
    render(<PaddlePaymentLink />);
    await waitFor(() =>
      expect(screen.getByText("Checkout is unavailable")).toBeInTheDocument(),
    );
  });
});
