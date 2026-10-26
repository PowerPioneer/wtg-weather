/**
 * The Premium block on a statically generated page.
 *
 * What is pinned: the server-rendered state is the teaser and carries no
 * premium number; only a premium session ever asks for the series; and when it
 * does, the charts replace the teasers — or a "not published" card stands in
 * for a variable the country has no series for.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PremiumClimate } from "@/lib/types";

const entitlement = vi.hoisted(() => ({ premium: false, agency: false, loading: false }));
const fetchPremiumClimate = vi.hoisted(() => vi.fn<(slug: string) => Promise<PremiumClimate | null>>());

vi.mock("@/hooks/use-session", () => ({
  usePremiumEntitlement: () => entitlement,
}));
vi.mock("@/lib/api-client", () => ({ fetchPremiumClimate }));

import { PremiumClimateBlock } from "./premium-climate";

const twelve = (v: number) => Array.from({ length: 12 }, () => v) as unknown as PremiumClimate["sst"];

const PERU: PremiumClimate = {
  slug: "peru",
  snow: twelve(0),
  sst: twelve(20.4),
  sstBandLow: twelve(18.5),
  sstBandHigh: twelve(21.5),
  humidity: twelve(65),
  heat: twelve(27),
};

beforeEach(() => {
  entitlement.premium = false;
  entitlement.loading = false;
  fetchPremiumClimate.mockReset();
});

describe("PremiumClimateBlock", () => {
  it("server-renders the teaser and no premium number", () => {
    entitlement.loading = true;
    const html = renderToString(<PremiumClimateBlock countrySlug="peru" countryName="Peru" />);
    expect(html).toContain("Sea surface temperature");
    expect(html).toContain("Unlock Premium");
    expect(html).not.toContain("20.4");
    expect(html).toContain('data-premium-state="teaser"');
  });

  it("never asks for the series without a premium session", async () => {
    render(<PremiumClimateBlock countrySlug="peru" countryName="Peru" />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchPremiumClimate).not.toHaveBeenCalled();
    expect(screen.getByText("Unlock Premium →")).toBeInTheDocument();
  });

  it("swaps the teasers for charts for a premium visitor", async () => {
    entitlement.premium = true;
    fetchPremiumClimate.mockResolvedValue(PERU);
    const { container } = render(<PremiumClimateBlock countrySlug="peru" countryName="Peru" />);
    await waitFor(() => expect(container.querySelector('[data-premium-state="unlocked"]')).not.toBeNull());
    expect(fetchPremiumClimate).toHaveBeenCalledWith("peru");
    expect(screen.queryByText("Unlock Premium →")).toBeNull();
    expect(screen.queryByText(/is part of the Premium map/)).toBeNull();
    expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(4);
  });

  it("says so when a variable has no series for this country", async () => {
    entitlement.premium = true;
    fetchPremiumClimate.mockResolvedValue({ ...PERU, sst: null, sstBandLow: null, sstBandHigh: null });
    render(<PremiumClimateBlock countrySlug="bolivia" countryName="Bolivia" />);
    expect(
      await screen.findByText("No sea surface temperature series is published for Bolivia."),
    ).toBeInTheDocument();
  });

  it("keeps the teaser when the series cannot be fetched", async () => {
    entitlement.premium = true;
    fetchPremiumClimate.mockResolvedValue(null);
    const { container } = render(<PremiumClimateBlock countrySlug="peru" countryName="Peru" />);
    await waitFor(() => expect(fetchPremiumClimate).toHaveBeenCalled());
    expect(container.querySelector('[data-premium-state="teaser"]')).not.toBeNull();
    expect(screen.getByText("Unlock Premium →")).toBeInTheDocument();
  });
});
