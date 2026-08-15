/**
 * Managing alerts in `/account`.
 *
 * The switch used to be a `<div role="img">` — a picture of a toggle with
 * nothing behind it. Pausing has to be distinct from deleting: someone who
 * wants quiet for a month should keep the definition.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import type { AccountAlert } from "@/lib/types";

import { AlertsList } from "./alerts-list";

const setAlertActive = vi.fn();
const deleteAlert = vi.fn();

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    setAlertActive: (...a: unknown[]) => setAlertActive(...a),
    deleteAlert: (...a: unknown[]) => deleteAlert(...a),
  };
});

const ALERTS: AccountAlert[] = [
  { id: "a1", label: "Portugal in April", conditions: "18–28 °C", active: true },
  { id: "a2", label: "Peru in July", conditions: "14–22 °C", active: false },
];

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("AlertsList", () => {
  it("renders each alert as an operable switch, not a picture of one", () => {
    render(<AlertsList initial={ALERTS} />);
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(2);
    expect(switches[0]).toHaveAttribute("aria-checked", "true");
    expect(switches[1]).toHaveAttribute("aria-checked", "false");
  });

  it("pauses without deleting", async () => {
    setAlertActive.mockResolvedValue({});
    render(<AlertsList initial={ALERTS} />);

    await userEvent.click(
      screen.getByRole("switch", { name: "Pause alert for Portugal in April" }),
    );

    expect(setAlertActive).toHaveBeenCalledWith("a1", false);
    expect(deleteAlert).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "Resume alert for Portugal in April" }),
      ).toHaveAttribute("aria-checked", "false"),
    );
  });

  it("puts the switch back if the API refuses", async () => {
    setAlertActive.mockRejectedValue(new ApiError(500, "/alerts/a1"));
    render(<AlertsList initial={ALERTS} />);

    await userEvent.click(
      screen.getByRole("switch", { name: "Pause alert for Portugal in April" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't change that alert.",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "Pause alert for Portugal in April" }),
      ).toHaveAttribute("aria-checked", "true"),
    );
  });

  it("asks before deleting, and drops the row once it is gone", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    deleteAlert.mockResolvedValue(undefined);
    render(<AlertsList initial={ALERTS} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Delete alert for Peru in July" }),
    );

    expect(deleteAlert).toHaveBeenCalledWith("a2");
    await waitFor(() =>
      expect(screen.queryByText("Peru in July")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Portugal in April")).toBeInTheDocument();
  });

  it("keeps the row when the confirm is declined", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    render(<AlertsList initial={ALERTS} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Delete alert for Peru in July" }),
    );

    expect(deleteAlert).not.toHaveBeenCalled();
    expect(screen.getByText("Peru in July")).toBeInTheDocument();
  });

  it("names an expired session rather than blaming the alert", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    deleteAlert.mockRejectedValue(new ApiError(401, "/alerts/a2"));
    render(<AlertsList initial={ALERTS} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Delete alert for Peru in July" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your session expired.",
    );
    expect(screen.getByText("Peru in July")).toBeInTheDocument();
  });
});
