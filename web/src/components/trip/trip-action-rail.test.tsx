/**
 * Owner controls: rename, share, revoke, delete.
 *
 * Every one of these used to be a stub — the buttons rendered and did nothing,
 * and the share box displayed `atlasweather.io/t/8h2k9p-honeymoon`, a URL that
 * resolved nowhere. The two rules worth pinning are that sharing is opt-in (no
 * link exists until asked for) and that deleting asks first, because the API
 * has no undo.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { TripActionRail } from "./trip-action-rail";

const shareTrip = vi.fn();
const unshareTrip = vi.fn();
const deleteTrip = vi.fn();
const updateTrip = vi.fn();
const push = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    shareTrip: (...a: unknown[]) => shareTrip(...a),
    unshareTrip: (...a: unknown[]) => unshareTrip(...a),
    deleteTrip: (...a: unknown[]) => deleteTrip(...a),
    updateTrip: (...a: unknown[]) => updateTrip(...a),
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

function rail(shareToken: string | null = null) {
  return (
    <TripActionRail
      tripId="trip-1"
      title="Peru in April"
      shareToken={shareToken}
      siteUrl="https://example.test"
    />
  );
}

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("sharing", () => {
  it("starts private, with no link to copy", () => {
    render(rail());
    expect(screen.getByText("○ Private")).toBeInTheDocument();
    expect(screen.queryByLabelText("Share link")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create share link" })).toBeInTheDocument();
  });

  it("shows the absolute URL once a token exists", async () => {
    shareTrip.mockResolvedValue("tok_abc");
    render(rail());

    await userEvent.click(screen.getByRole("button", { name: "Create share link" }));

    expect(shareTrip).toHaveBeenCalledWith("trip-1");
    await waitFor(() =>
      expect(screen.getByLabelText("Share link")).toHaveValue(
        "https://example.test/trip/share/tok_abc",
      ),
    );
    expect(screen.getByText("● Anyone with the link")).toBeInTheDocument();
  });

  it("revokes back to private", async () => {
    unshareTrip.mockResolvedValue(undefined);
    render(rail("tok_abc"));

    await userEvent.click(screen.getByRole("button", { name: "Stop sharing" }));

    expect(unshareTrip).toHaveBeenCalledWith("trip-1");
    await waitFor(() => expect(screen.getByText("○ Private")).toBeInTheDocument());
    expect(screen.queryByLabelText("Share link")).not.toBeInTheDocument();
  });
});

describe("rename", () => {
  it("will not submit an unchanged or empty title", async () => {
    render(rail());
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    await userEvent.clear(screen.getByLabelText("Title"));
    expect(save).toBeDisabled();
    expect(updateTrip).not.toHaveBeenCalled();
  });

  it("patches only the title", async () => {
    updateTrip.mockResolvedValue({});
    render(rail());

    const input = screen.getByLabelText("Title");
    await userEvent.clear(input);
    await userEvent.type(input, "Andes trek");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(updateTrip).toHaveBeenCalledWith("trip-1", { title: "Andes trek" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});

describe("delete", () => {
  it("asks first, and does nothing if the answer is no", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    render(rail());

    await userEvent.click(screen.getByRole("button", { name: "Delete trip" }));

    expect(deleteTrip).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("deletes and returns to the trips list", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    deleteTrip.mockResolvedValue(undefined);
    render(rail());

    await userEvent.click(screen.getByRole("button", { name: "Delete trip" }));

    expect(deleteTrip).toHaveBeenCalledWith("trip-1");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/account?s=trips"));
  });

  it("reports a failure instead of navigating away", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    deleteTrip.mockRejectedValue(new ApiError(500, "/trips/trip-1"));
    render(rail());

    await userEvent.click(screen.getByRole("button", { name: "Delete trip" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't delete that. Try again.",
    );
    expect(push).not.toHaveBeenCalled();
  });
});
