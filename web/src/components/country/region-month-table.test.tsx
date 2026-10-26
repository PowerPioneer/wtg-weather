import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { findCountryData } from "@/lib/mock-data";
import type { CountryData, RegionRow } from "@/lib/types";

import { RegionMonthTable } from "./region-month-table";

const PERU = findCountryData("peru")!;

function withRegions(regions: readonly RegionRow[]): CountryData {
  return { ...PERU, regions };
}

const CUSCO: RegionRow = {
  name: "Cusco",
  slug: "cusco",
  score: 90,
  scores: [25, 60, 60, 75, 90, 90, 90, 90, 90, 75, 60, 25],
  tl: [13, 13, 13, 13, 11, 10, 9, 11, 12, 13, 13, 13],
};

describe("RegionMonthTable", () => {
  it("gives every region a row of twelve months", () => {
    render(<RegionMonthTable country={PERU} />);
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    // One header row, then one per region.
    expect(rows).toHaveLength(PERU.regions.length + 1);
    expect(within(rows[1]!).getAllByRole("cell")).toHaveLength(12);
  });

  it("names each month's verdict in words, never as a number", () => {
    render(<RegionMonthTable country={withRegions([CUSCO])} />);
    const row = screen.getByRole("row", { name: /Cusco/ });
    const cells = within(row).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("Avoid");
    expect(cells[3]).toHaveTextContent("Good option");
    expect(cells[6]).toHaveTextContent("Perfect match");
    expect(cells[10]).toHaveTextContent("Acceptable");
    for (const cell of cells) {
      expect(cell.textContent).not.toMatch(/\d/);
    }
  });

  it("links a row to the region page, or to its month inside a month page", () => {
    const { rerender } = render(<RegionMonthTable country={withRegions([CUSCO])} />);
    expect(screen.getByRole("link", { name: "Cusco" })).toHaveAttribute(
      "href",
      "/peru/cusco",
    );
    rerender(<RegionMonthTable country={withRegions([CUSCO])} currentMonthIdx={6} />);
    expect(screen.getByRole("link", { name: "Cusco" })).toHaveAttribute(
      "href",
      "/peru/cusco/july",
    );
  });

  it("serves a region published before monthly scores existed", () => {
    const legacy: RegionRow = { ...CUSCO, scores: undefined };
    render(<RegionMonthTable country={withRegions([legacy])} />);
    const row = screen.getByRole("row", { name: /Cusco/ });
    for (const cell of within(row).getAllByRole("cell")) {
      expect(cell).toHaveTextContent("No data");
    }
  });

  it("flags a region whose advisory is worse than its country's", () => {
    render(
      <RegionMonthTable
        country={withRegions([
          { ...CUSCO, advisory: { level: 4, label: "Do not travel", code: "PE-CUS" } },
        ])}
      />,
    );
    expect(screen.getByText(/Advisory in parts: Do not travel/)).toBeInTheDocument();
  });

  it("says so when there are no regions", () => {
    render(<RegionMonthTable country={withRegions([])} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(/not yet available/)).toBeInTheDocument();
  });
});
