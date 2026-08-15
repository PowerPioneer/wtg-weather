/**
 * Setting an alert from a country's month page.
 *
 * Alerts are sold as Premium in the pricing table, so the interesting cases
 * are the ones where the button is *not* a button: anonymous, free, and
 * already-alerting. The gate here is presentation only — `POST /api/alerts`
 * enforces the same boundary, and `api/tests/test_trips.py` pins that.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { DEFAULT_PREFERENCES } from "@/lib/scoring";

import { CreateAlertButton } from "./create-alert-button";

const createAlert = vi.fn();
const listAlerts = vi.fn();
const useSession = vi.fn();
const usePremiumEntitlement = vi.fn();

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    createAlert: (...a: unknown[]) => createAlert(...a),
    listAlerts: (...a: unknown[]) => listAlerts(...a),
  };
});

vi.mock("@/hooks/use-session", () => ({
  useSession: () => useSession(),
  usePremiumEntitlement: () => usePremiumEntitlement(),
}));

const SESSION = {
  id: "usr-1",
  email: "lea@example.com",
  name: "Léa",
  plan: "consumer_premium" as const,
  role: null,
  createdAt: null,
  org: null,
};

function signedIn(premium: boolean) {
  useSession.mockReturnValue({ session: SESSION, loading: false });
  usePremiumEntitlement.mockReturnValue({ premium, agency: false, loading: false });
}

function props() {
  return {
    countryIso2: "PT",
    placeName: "Portugal",
    month: 4,
    monthName: "April",
    preferences: DEFAULT_PREFERENCES,
  };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("CreateAlertButton", () => {
  it("asks an anonymous visitor to sign in", () => {
    useSession.mockReturnValue({ session: null, loading: false });
    usePremiumEntitlement.mockReturnValue({ premium: false, agency: false, loading: false });
    render(<CreateAlertButton {...props()} />);

    expect(screen.getByTestId("alert-signin")).toHaveAttribute("href", "/login");
    expect(screen.queryByTestId("alert-create")).not.toBeInTheDocument();
  });

  it("shows the upgrade prompt to a free user, not a button that 403s", async () => {
    signedIn(false);
    render(<CreateAlertButton {...props()} />);

    const prompt = screen.getByTestId("alert-upgrade");
    expect(prompt).toHaveTextContent("Alerts are a Premium feature.");
    expect(screen.getByRole("link", { name: /See Premium/ })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(screen.queryByTestId("alert-create")).not.toBeInTheDocument();
    // A free user's alert list is empty by construction; asking for it only
    // invites a refusal.
    expect(listAlerts).not.toHaveBeenCalled();
  });

  it("creates the alert with the page's place, month and preferences", async () => {
    signedIn(true);
    listAlerts.mockResolvedValue([]);
    createAlert.mockResolvedValue({ id: "a1" });
    render(<CreateAlertButton {...props()} />);

    await waitFor(() => expect(screen.getByTestId("alert-create")).toBeEnabled());
    await userEvent.click(screen.getByTestId("alert-create"));

    expect(createAlert).toHaveBeenCalledWith({
      countryIso2: "PT",
      regionCode: null,
      month: 4,
      preferences: DEFAULT_PREFERENCES,
    });
    expect(await screen.findByTestId("alert-active")).toHaveTextContent(
      "Alerting on Portugal in April",
    );
  });

  it("will not quietly create a second alert for the same place and month", async () => {
    // Two identical alerts means two emails on every transition.
    signedIn(true);
    listAlerts.mockResolvedValue([
      { id: "a1", countryIso2: "PT", regionCode: null, month: 4, preferences: {}, active: true },
    ]);
    render(<CreateAlertButton {...props()} />);

    expect(await screen.findByTestId("alert-active")).toBeInTheDocument();
    expect(screen.queryByTestId("alert-create")).not.toBeInTheDocument();
  });

  it("treats a different month on the same country as a new alert", async () => {
    signedIn(true);
    listAlerts.mockResolvedValue([
      { id: "a1", countryIso2: "PT", regionCode: null, month: 7, preferences: {}, active: true },
    ]);
    render(<CreateAlertButton {...props()} />);

    await waitFor(() => expect(screen.getByTestId("alert-create")).toBeEnabled());
  });

  it("reports a failure instead of claiming the alert is set", async () => {
    signedIn(true);
    listAlerts.mockResolvedValue([]);
    createAlert.mockRejectedValue(new ApiError(500, "/alerts"));
    render(<CreateAlertButton {...props()} />);

    await waitFor(() => expect(screen.getByTestId("alert-create")).toBeEnabled());
    await userEvent.click(screen.getByTestId("alert-create"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't create that alert.",
    );
    expect(screen.queryByTestId("alert-active")).not.toBeInTheDocument();
  });
});
