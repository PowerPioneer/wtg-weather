/**
 * Creating a trip — the only way one has ever been created.
 *
 * The saved object is the *question*, not today's answer: country, region,
 * month, preferences. Nothing about the ranking is stored, because the trip
 * page recomputes it from whatever the pipeline published last. A test that
 * let a score into the payload would be pinning the wrong contract.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { DEFAULT_PREFERENCES } from "@/lib/scoring";

import { SaveTripButton } from "./save-trip-button";

const createTrip = vi.fn();
const push = vi.fn();
const useSession = vi.fn();

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, createTrip: (...args: unknown[]) => createTrip(...args) };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/use-session", () => ({ useSession: () => useSession() }));

const SESSION = {
  id: "usr-1",
  email: "sam@example.com",
  name: "Sam",
  plan: "free" as const,
  role: null,
  createdAt: null,
  org: null,
};

function props() {
  return {
    countryIso2: "PE",
    placeName: "Peru",
    month: 4,
    monthSlug: "april" as const,
    monthName: "April",
    preferences: DEFAULT_PREFERENCES,
  };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("SaveTripButton", () => {
  it("asks an anonymous visitor to sign in rather than failing silently", async () => {
    useSession.mockReturnValue({ session: null, loading: false });
    render(<SaveTripButton {...props()} />);

    const link = screen.getByTestId("save-trip-signin");
    expect(link).toHaveAttribute("href", "/login");
    expect(screen.queryByTestId("save-trip")).not.toBeInTheDocument();
  });

  it("waits for the session before claiming anything", async () => {
    useSession.mockReturnValue({ session: null, loading: true });
    render(<SaveTripButton {...props()} />);

    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.queryByTestId("save-trip-signin")).not.toBeInTheDocument();
  });

  it("saves the question — place, month, preferences — and opens the trip", async () => {
    useSession.mockReturnValue({ session: SESSION, loading: false });
    createTrip.mockResolvedValue({ id: "trip-9" });
    render(<SaveTripButton {...props()} regionCode="PER-1" placeName="Cusco" />);

    await userEvent.click(screen.getByTestId("save-trip"));

    expect(createTrip).toHaveBeenCalledWith({
      title: "Cusco in April",
      countryIso2: "PE",
      regionCode: "PER-1",
      month: 4,
      preferences: DEFAULT_PREFERENCES,
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/trip/trip-9"));
  });

  it("sends a null region for a whole-country trip", async () => {
    useSession.mockReturnValue({ session: SESSION, loading: false });
    createTrip.mockResolvedValue({ id: "trip-9" });
    render(<SaveTripButton {...props()} />);

    await userEvent.click(screen.getByTestId("save-trip"));
    expect(createTrip).toHaveBeenCalledWith(
      expect.objectContaining({ regionCode: null, title: "Peru in April" }),
    );
  });

  it("says so when the save fails, and stays on the page", async () => {
    useSession.mockReturnValue({ session: SESSION, loading: false });
    createTrip.mockRejectedValue(new ApiError(500, "/trips"));
    render(<SaveTripButton {...props()} />);

    await userEvent.click(screen.getByTestId("save-trip"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't save that trip. Try again.",
    );
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByTestId("save-trip")).toBeEnabled();
  });

  it("names an expired session as the reason, not a generic failure", async () => {
    useSession.mockReturnValue({ session: SESSION, loading: false });
    createTrip.mockRejectedValue(new ApiError(401, "/trips"));
    render(<SaveTripButton {...props()} />);

    await userEvent.click(screen.getByTestId("save-trip"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your session expired.",
    );
  });
});
