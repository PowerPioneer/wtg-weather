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

  /**
   * WS-E: the panel has to distinguish "this advisory has not moved" from
   * "nobody has looked". Both dates are printed per government, and the
   * combined badge goes neutral only when the payload's own `checked` dates
   * say every source has gone cold.
   */
  describe("freshness", () => {
    const NOW = new Date("2026-08-16T09:00:00Z");
    const withChecked = (checked: string): AdvisorySummary => ({
      ...SUMMARY,
      sources: SUMMARY.sources.map((s) => ({ ...s, checked })),
    });

    it("prints when each government last changed and when it was last checked", () => {
      const { container } = render(
        <SafetySection
          advisories={withChecked("2026-08-15")}
          countryName="Peru"
          now={NOW}
        />,
      );

      expect(container.textContent).toContain("Changed 2026-04-17");
      expect(container.textContent).toContain("Checked 2026-08-15");
    });

    it("keeps the level colour while the data is being refreshed", () => {
      const { container } = render(
        <SafetySection
          advisories={withChecked("2026-08-15")}
          countryName="Peru"
          now={NOW}
        />,
      );

      expect(container.querySelector(".bg-border-strong")).toBeNull();
      expect(container.textContent).not.toContain("has not been refreshed");
    });

    it("neutralises the badge and says so when every source has gone cold", () => {
      const { container } = render(
        <SafetySection
          advisories={withChecked("2026-06-01")}
          countryName="Peru"
          now={NOW}
        />,
      );

      // HANDOFF § Risks: stale data downgrades the badge to
      // --color-border-strong rather than presenting it at its level colour.
      expect(container.querySelector(".bg-border-strong")).not.toBeNull();
      expect(container.textContent).toContain("has not been refreshed");
      expect(container.textContent).toContain("2026-06-01");
      // The level is still reported — it is the best anyone has.
      expect(container.textContent).toContain("Exercise increased caution");
      expect(
        screen.getByLabelText(/level 2 .* \(data may be out of date\)/),
      ).toBeInTheDocument();
    });

    it("leaves the badge alone when the bundle carries no checked dates", () => {
      // Pre-WS-E bundles. Absence of evidence is not a staleness claim.
      const { container } = render(
        <SafetySection advisories={SUMMARY} countryName="Peru" now={NOW} />,
      );

      expect(container.querySelector(".bg-border-strong")).toBeNull();
      expect(container.textContent).not.toContain("has not been refreshed");
    });

    it("stays fresh while one government is still being read", () => {
      const mixed: AdvisorySummary = {
        ...SUMMARY,
        sources: [
          { ...SUMMARY.sources[0], checked: "2026-03-01" },
          { ...SUMMARY.sources[1], checked: "2026-08-14" },
        ],
      };
      const { container } = render(
        <SafetySection advisories={mixed} countryName="Peru" now={NOW} />,
      );

      expect(container.querySelector(".bg-border-strong")).toBeNull();
      expect(container.textContent).toContain("Checked 2026-03-01");
    });
  });
});
