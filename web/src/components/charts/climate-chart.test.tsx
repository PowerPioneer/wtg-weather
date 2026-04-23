import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { ClimateChart, type ClimateChartKind, type MonthDatum } from "./climate-chart";

const FIXTURE: Record<ClimateChartKind, number[]> = {
  temp: [21.1, 21.3, 20.8, 18.9, 16.2, 14.1, 13.6, 14.8, 16.5, 18.3, 19.7, 20.8],
  rain: [85, 94, 78, 42, 14, 3, 2, 4, 18, 38, 60, 82],
  sun: [5.2, 5.4, 6.1, 6.8, 7.2, 7.0, 6.9, 7.1, 7.4, 6.8, 5.9, 5.1],
  wind: [8.4, 8.9, 9.2, 9.6, 10.1, 10.6, 11.2, 11.4, 10.8, 9.7, 8.9, 8.3],
  snow: [0, 0, 0, 0, 0, 0, 12, 22, 18, 2, 0, 0],
  sst: [22.1, 22.6, 22.3, 21.4, 19.8, 18.2, 17.9, 18.1, 18.9, 19.8, 20.7, 21.6],
  humidity: [78, 76, 74, 70, 66, 62, 60, 62, 66, 70, 74, 77],
  heat: [24.2, 24.8, 24.1, 21.9, 18.6, 16.1, 15.4, 16.9, 19.1, 21.3, 22.9, 23.8],
};

function toMonths(values: number[]): MonthDatum[] {
  return values.map((value, month) => ({ month, value }));
}

describe("ClimateChart — determinism", () => {
  (Object.keys(FIXTURE) as ClimateChartKind[]).forEach((kind) => {
    it(`${kind} renders a deterministic SVG path`, () => {
      const { container } = render(
        <ClimateChart kind={kind} months={toMonths(FIXTURE[kind])} />,
      );
      // Line charts emit a <path d="...">, bar charts emit <rect> set.
      // Both are captured in the same snapshot.
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg!.outerHTML).toMatchSnapshot();
    });
  });

  it("renders p10/p90 bands when provided", () => {
    const months: MonthDatum[] = FIXTURE.temp.map((value, month) => ({
      month,
      value,
      p10: value - 3,
      p90: value + 3,
    }));
    const { container } = render(<ClimateChart kind="temp" months={months} />);
    const bandPath = container.querySelector("path[fill-opacity]");
    expect(bandPath).not.toBeNull();
    expect(bandPath!.getAttribute("d")).toMatchSnapshot();
  });

  it("renders a screen-reader data table", () => {
    const { getByRole } = render(
      <ClimateChart kind="rain" months={toMonths(FIXTURE.rain)} />,
    );
    const table = getByRole("table");
    expect(table).toBeInTheDocument();
    // 12 rows in tbody + 1 header row
    expect(table.querySelectorAll("tbody tr")).toHaveLength(12);
  });

  it("applies locked blur styling", () => {
    const { container } = render(
      <ClimateChart kind="snow" months={toMonths(FIXTURE.snow)} locked />,
    );
    const svg = container.querySelector("svg");
    expect(svg!.getAttribute("style")).toContain("blur");
  });

  it("throws when month count is wrong", () => {
    expect(() =>
      render(
        <ClimateChart kind="temp" months={toMonths([1, 2, 3])} />,
      ),
    ).toThrow(/expects exactly 12 months/);
  });
});
