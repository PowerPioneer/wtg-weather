/**
 * The consumer account sections, rendered from API-shaped data.
 *
 * Two failures are pinned here. The first is what shipped: these sections read
 * fixtures, so a signed-in user saw an empty account no matter what they had
 * saved, and a *subscriber* saw four invented invoices and a month of activity
 * that no event log backs. The second is the null handling — the API's rows
 * carry nullable names, months and countries, and `session.name.split(" ")`
 * used to throw on a magic-link user who never gave one.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ConsumerAccount, SessionUser } from "@/lib/types";

import {
  ConsumerAlerts,
  ConsumerBilling,
  ConsumerFavourites,
  ConsumerOverview,
  ConsumerTrips,
} from "./consumer-sections";

function session(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "usr-1",
    email: "sam@example.com",
    name: "Sam Patel",
    plan: "free",
    role: null,
    createdAt: "2026-03-04T09:12:00Z",
    org: null,
    ...overrides,
  };
}

const EMPTY: ConsumerAccount = { trips: [], favourites: [], alerts: [] };

const POPULATED: ConsumerAccount = {
  trips: [
    {
      id: "t1",
      title: "Honeymoon",
      countryName: "Peru",
      countrySlug: "peru",
      monthName: "April",
      monthSlug: "april",
      score: 90,
      matchingRegions: 2,
    },
  ],
  favourites: [
    { id: "f1", name: "Cusco", sub: "Peru", href: "/peru/cusco", best: "June · July" },
  ],
  alerts: [
    { id: "a1", label: "Cusco in July", conditions: "14–22 °C", active: true },
    { id: "a2", label: "Lisbon in May", conditions: "18–26 °C", active: false },
  ],
};

describe("ConsumerOverview", () => {
  it("greets a user who never gave a name", () => {
    // Magic-link sign-up collects an address and nothing else, so this is the
    // common case. It used to throw on `session.name.split(" ")`.
    render(<ConsumerOverview session={session({ name: null })} account={EMPTY} />);
    expect(screen.getByText("Hello, sam@example.com.")).toBeInTheDocument();
  });

  it("counts what the account actually holds", () => {
    render(<ConsumerOverview session={session()} account={POPULATED} />);
    const trips = screen.getByText("Saved trips").parentElement!;
    expect(trips).toHaveTextContent("1");
    const alerts = screen.getByText("Active alerts").parentElement!;
    // One of the two is paused.
    expect(alerts).toHaveTextContent("1");
    expect(alerts).toHaveTextContent("2 total");
  });

  it("shows the real account age, not a fixture string", () => {
    render(<ConsumerOverview session={session()} account={EMPTY} />);
    expect(screen.getByText(/Member since Mar 2026/)).toBeInTheDocument();
  });

  it("renders no activity feed, because there is no event log to render", () => {
    render(<ConsumerOverview session={session()} account={POPULATED} />);
    expect(screen.queryByText(/Recent activity/i)).not.toBeInTheDocument();
  });
});

describe("ConsumerTrips", () => {
  it("shows the empty state rather than a fixture trip", () => {
    render(<ConsumerTrips session={session()} account={EMPTY} />);
    expect(screen.getByText("No saved trips yet.")).toBeInTheDocument();
    // The old empty state linked to `/trip/trp_8h2k9p`, the mock trip.
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toContain("trp_8h2k9p");
    }
  });

  it("renders a trip with its country, month, score and region count", () => {
    render(<ConsumerTrips session={session()} account={POPULATED} />);
    const link = screen.getByRole("link", { name: /Honeymoon/ });
    expect(link).toHaveAttribute("href", "/trip/t1");
    expect(link).toHaveTextContent("Peru · April");
    expect(link).toHaveTextContent("2 regions match");
  });

  it("omits the score and the region count when they are unknown", () => {
    render(
      <ConsumerTrips
        session={session()}
        account={{
          ...EMPTY,
          trips: [
            {
              id: "t2",
              title: "Someday",
              countryName: null,
              countrySlug: null,
              monthName: null,
              monthSlug: null,
              score: null,
              matchingRegions: null,
            },
          ],
        }}
      />,
    );
    const link = screen.getByRole("link", { name: /Someday/ });
    expect(link).toHaveTextContent("Year-round");
    expect(link).not.toHaveTextContent(/regions? match/);
  });
});

describe("ConsumerFavourites", () => {
  it("links a favourited region to its own page", () => {
    render(<ConsumerFavourites session={session()} account={POPULATED} />);
    expect(screen.getByRole("link", { name: /Cusco/ })).toHaveAttribute(
      "href",
      "/peru/cusco",
    );
  });

  it("lists an unresolvable favourite without a dead link", () => {
    render(
      <ConsumerFavourites
        session={session()}
        account={{
          ...EMPTY,
          favourites: [{ id: "f9", name: "XK", sub: "", href: null, best: null }],
        }}
      />,
    );
    expect(screen.getByText("XK")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /XK/ })).not.toBeInTheDocument();
  });
});

describe("ConsumerAlerts", () => {
  it("states the cadence the job actually runs at", () => {
    // The page used to offer Realtime / Daily / Weekly per alert. There is one
    // job, `weekly-alerts.sh`, and it runs weekly.
    render(<ConsumerAlerts session={session()} account={POPULATED} />);
    expect(screen.getByText(/Checked weekly/)).toBeInTheDocument();
    expect(screen.queryByText(/Realtime/)).not.toBeInTheDocument();
  });

  it("distinguishes a paused alert from an active one, and lets you flip it", () => {
    // The switch used to be a `<div role="img">` — a picture of a toggle.
    render(<ConsumerAlerts session={session()} account={POPULATED} />);
    const switches = screen.getAllByRole("switch");
    expect(switches.map((s) => s.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
    ]);
  });
});

describe("ConsumerBilling", () => {
  it("does not invent a renewal date, a card, or invoices", () => {
    render(
      <ConsumerBilling session={session({ plan: "consumer_premium" })} account={EMPTY} />,
    );
    expect(screen.queryByText(/card ending/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/INV-/)).not.toBeInTheDocument();
    expect(screen.getByText(/Renewal date and invoices are on Paddle/)).toBeInTheDocument();
  });

  it("offers the upgrade path on free", () => {
    render(<ConsumerBilling session={session()} account={EMPTY} />);
    expect(screen.getByText("You're on Free.")).toBeInTheDocument();
    expect(screen.getByText("No active subscription")).toBeInTheDocument();
  });
});
