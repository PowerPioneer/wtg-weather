/**
 * The advisory section against what WS-4 actually publishes.
 *
 * Three things had drifted: the scrapers became six governments while the
 * heading still said five and the code table still had five entries (so the
 * Netherlands rendered as "NE"); a country nobody lists carries no advisory at
 * all rather than an implicit level 1; and `regional_max` — the carve-out WS-4
 * deliberately kept out of the tiles because it names no polygon — had nowhere
 * on the site to be said.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AdvisorySummary } from "@/lib/types";

import { SafetySection } from "./safety-section";

const SUMMARY: AdvisorySummary = {
  combined: { level: 2, label: "Exercise increased caution" },
  lastUpdated: "2026-04-18",
  sources: [
    {
      gov: "Netherlands",
      level: 2,
      label: "Exercise increased caution",
      date: "2026-04-17",
      url: "https://www.nederlandwereldwijd.nl/peru/reisadvies",
    },
    {
      gov: "United States",
      level: 1,
      label: "Exercise normal precautions",
      date: "2026-04-12",
      url: "https://travel.state.gov/peru",
    },
  ],
};

describe("SafetySection", () => {
  it("codes the Netherlands as NL, not as the first two letters", () => {
    render(<SafetySection advisories={SUMMARY} countryName="Peru" />);
    expect(screen.getByText("NL")).toBeInTheDocument();
    expect(screen.queryByText("NE")).not.toBeInTheDocument();
  });

  it("counts the governments it actually has rather than saying five", () => {
    const { container } = render(
      <SafetySection advisories={SUMMARY} countryName="Peru" />,
    );
    expect(container.textContent).toContain("2 governments");
    expect(container.textContent).not.toContain("five governments");
  });

  it("says nobody has published rather than implying a clean bill", () => {
    const { container } = render(<SafetySection countryName="Iceland" />);
    expect(container.textContent).toContain("No advisory on file for Iceland");
    // Specifically not "Exercise normal precautions", which is a claim.
    expect(container.textContent).not.toContain("Exercise normal precautions");
  });

  it("reports a regional carve-out and explains why it is not on the map", () => {
    const { container } = render(
      <SafetySection
        advisories={{ ...SUMMARY, regionalMax: 4, regionalMaxLabel: "Do not travel" }}
        countryName="Peru"
      />,
    );
    expect(container.textContent).toContain("Parts of Peru carry a higher advisory");
    expect(container.textContent).toContain("Do not travel");
    expect(container.textContent).toContain("not drawn on the map");
  });

  it("says nothing about carve-outs when there is none", () => {
    const { container } = render(
      <SafetySection advisories={SUMMARY} countryName="Peru" />,
    );
    expect(container.textContent).not.toContain("higher advisory");
  });
});
