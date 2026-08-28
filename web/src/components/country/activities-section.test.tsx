import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActivitiesSection } from "./activities-section";
import { PERU_ACTIVITIES } from "@/lib/mock-activities";
import type { CountryData } from "@/lib/types";

const PERU = {
  slug: "peru",
  name: "Peru",
  iso2: "PE",
  region: "South America",
  summary: "",
  bestMonths: [],
  climate: { months: [], t: [], tMin: [], tMax: [], r: [], rDay: [], s: [] },
  regions: [],
  related: [],
  monthNotes: {},
  activities: PERU_ACTIVITIES,
} as unknown as CountryData;

const uncurated = { ...PERU, activities: undefined } as CountryData;

describe("ActivitiesSection", () => {
  it("renders nothing for an uncurated country", () => {
    // Coverage is tiered on purpose; most of the world has no file. An empty
    // section under a heading reads as a page that failed to load.
    const { container } = render(<ActivitiesSection country={uncurated} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when a region has no curated activities", () => {
    const { container } = render(<ActivitiesSection country={PERU} only={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the year lede and every activity on the country view", () => {
    render(<ActivitiesSection country={PERU} />);
    expect(
      screen.getByText(/February is the only month Peru closes anything/),
    ).toBeInTheDocument();
    expect(screen.getByText("Machu Picchu")).toBeInTheDocument();
    expect(screen.getByText("Classic Inca Trail")).toBeInTheDocument();
  });

  it("leads a month view with that month's lede and puts the closure first", () => {
    render(<ActivitiesSection country={PERU} monthIdx={1} monthName="February" />);
    expect(
      screen.getByText("February is the only month Peru closes anything — 1 thing below."),
    ).toBeInTheDocument();

    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("Classic Inca Trail")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Closed")).toBeInTheDocument();
  });

  it("keeps Machu Picchu out of the closed list in February", () => {
    render(<ActivitiesSection country={PERU} monthIdx={1} monthName="February" />);
    const machu = screen.getByText("Machu Picchu").closest("li");
    expect(machu).not.toBeNull();
    expect(within(machu as HTMLElement).queryByText("Closed")).toBeNull();
  });

  it("omits a dated event from a month it does not fall in", () => {
    render(<ActivitiesSection country={PERU} monthIdx={1} monthName="February" />);
    expect(screen.queryByText("Inti Raymi")).toBeNull();
  });

  it("shows a dated event in its own month", () => {
    render(<ActivitiesSection country={PERU} monthIdx={5} monthName="June" />);
    expect(screen.getByText("Inti Raymi")).toBeInTheDocument();
  });

  it("suppresses the country lede on a region-scoped view", () => {
    // The lede counts the country's rows. Above a list narrowed to Arequipa it
    // would announce a closure the list does not contain.
    render(
      <ActivitiesSection
        country={PERU}
        monthIdx={1}
        monthName="February"
        only={["colca-condors"]}
      />,
    );
    expect(screen.queryByText(/closes anything/)).toBeNull();
    expect(screen.getByText("Colca Canyon condors")).toBeInTheDocument();
    expect(screen.queryByText("Classic Inca Trail")).toBeNull();
  });

  it("renders nothing when a region's only activity is off this month", () => {
    const { container } = render(
      <ActivitiesSection country={PERU} monthIdx={1} only={["inti-raymi"]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("prints a checkable source link for every row", () => {
    render(<ActivitiesSection country={PERU} monthIdx={1} monthName="February" />);
    const trail = screen.getByText("Classic Inca Trail").closest("li") as HTMLElement;
    const link = within(trail).getAllByRole("link")[0];
    expect(link).toHaveAttribute("href", expect.stringContaining("https://"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("nofollow"));
  });

  it("says the seasons are checked by hand, not derived from the climate", () => {
    render(<ActivitiesSection country={PERU} />);
    expect(screen.getByText(/not derived from the climate figures/)).toBeInTheDocument();
  });

  it("summarises a year-view calendar as ranges rather than month lists", () => {
    render(<ActivitiesSection country={PERU} />);
    const trail = screen.getByText("Classic Inca Trail").closest("li") as HTMLElement;
    expect(within(trail).getByText(/Closed February/)).toBeInTheDocument();
    expect(within(trail).getByText(/May–September/)).toBeInTheDocument();
  });
});
