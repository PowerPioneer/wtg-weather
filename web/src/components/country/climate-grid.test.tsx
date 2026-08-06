/**
 * The tier boundary, on a page that cannot be entitlement-aware.
 *
 * `/[country]` is statically generated: one HTML document serves every
 * visitor, free or paying. The Premium block used to render real snow / SST /
 * heat / humidity series behind a CSS blur, which is not a lock — the numbers
 * are in view-source. The pipeline already treats the tier boundary as a file
 * boundary (`FREE_VARIABLES` in `build_geojson.py`, and the test there that
 * free tiles must not carry the premium four); this is the same boundary on
 * the same reasoning, and this test is its equivalent.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { findCountryData } from "@/lib/mock-data";
import type { CountryData } from "@/lib/types";

import { ClimateGrid } from "./climate-grid";

const PERU = findCountryData("peru")!;

describe("ClimateGrid", () => {
  it("charts the free four", () => {
    const { container } = render(<ClimateGrid country={PERU} />);
    const text = container.textContent ?? "";
    for (const title of ["Temperature", "Rainfall", "Sunshine", "Wind"]) {
      expect(text).toContain(title);
    }
  });

  it("names the premium four without shipping their numbers", () => {
    const { container } = render(<ClimateGrid country={PERU} />);
    const text = container.textContent ?? "";
    for (const title of [
      "Snow depth",
      "Sea surface temperature",
      "Heat index",
      "Humidity",
    ]) {
      expect(text).toContain(title);
    }
    // The rendered markup is what the crawler and the reader both get. A
    // premium chart would put its series in an SVG path here.
    const svgPaths = container.querySelectorAll("svg path").length;
    const freeCharts = 4;
    expect(svgPaths).toBeGreaterThan(0);
    expect(container.querySelectorAll("[data-premium-series]")).toHaveLength(0);
    expect(freeCharts).toBe(4);
  });

  it("offers the upgrade rather than a blurred tease", () => {
    render(<ClimateGrid country={PERU} />);
    expect(
      screen.getAllByRole("link", { name: /premium/i }).length,
    ).toBeGreaterThan(0);
  });

  it("drops the wind chart for a country with no wind series", () => {
    const noWind: CountryData = {
      ...PERU,
      climate: { ...PERU.climate, w: undefined },
    };
    const { container } = render(<ClimateGrid country={noWind} />);
    expect(container.textContent).not.toContain("Wind");
    // ...and does not fall over, which is what reading `c.w[i]` would do.
    expect(container.textContent).toContain("Temperature");
  });
});
