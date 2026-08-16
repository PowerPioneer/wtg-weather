/**
 * The freshness rule behind the neutral badge (WS-E).
 *
 * The interesting cases are all about which date the rule reads: a country
 * whose governments have not moved in years is not stale, and a country whose
 * scrapers stopped running last month is — and the payload's `date` field
 * cannot tell those two apart, which is why `checked` exists.
 */

import { describe, expect, it } from "vitest";

import { ADVISORY_STALE_AFTER_DAYS, advisoryFreshness } from "./advisory-freshness";
import type { AdvisorySummary } from "./types";

const NOW = new Date("2026-08-16T09:00:00Z");

function summary(
  sources: Array<{ date: string; checked?: string }>,
): AdvisorySummary {
  return {
    combined: { level: 2, label: "Exercise increased caution" },
    lastUpdated: sources[0]?.date ?? "",
    sources: sources.map((s, i) => ({
      gov: `Gov ${i}`,
      level: 2 as const,
      label: "Exercise increased caution",
      date: s.date,
      url: "https://example.gov/x",
      checked: s.checked,
    })),
  };
}

describe("advisoryFreshness", () => {
  it("is fresh when a government was read within the window", () => {
    const result = advisoryFreshness(
      summary([
        { date: "2020-01-01", checked: "2026-08-10" },
        { date: "2019-06-01", checked: "2026-06-01" },
      ]),
      NOW,
    );

    expect(result.stale).toBe(false);
    expect(result.lastChecked).toBe("2026-08-10");
    expect(result.ageDays).toBe(6);
  });

  it("is stale only when every source is past the threshold", () => {
    // One live scraper is enough to keep the panel current: the combined
    // level is a max across whoever answered.
    const oneLive = advisoryFreshness(
      summary([
        { date: "2026-01-01", checked: "2026-05-01" },
        { date: "2026-01-01", checked: "2026-08-14" },
      ]),
      NOW,
    );
    expect(oneLive.stale).toBe(false);

    const allCold = advisoryFreshness(
      summary([
        { date: "2026-01-01", checked: "2026-05-01" },
        { date: "2026-01-01", checked: "2026-06-02" },
      ]),
      NOW,
    );
    expect(allCold.stale).toBe(true);
    expect(allCold.lastChecked).toBe("2026-06-02");
    expect(allCold.ageDays).toBe(75);
  });

  it("does not call a long-unchanged advisory stale", () => {
    // The whole reason the rule reads `checked` and not `date`. Most of the
    // world's advisories have not moved in years; that is stability, not rot.
    const result = advisoryFreshness(
      summary([{ date: "2019-03-02", checked: "2026-08-16" }]),
      NOW,
    );

    expect(result.stale).toBe(false);
    expect(result.ageDays).toBe(0);
  });

  it("treats a payload with no checked dates as unknown, not stale", () => {
    // A bundle published before the pipeline emitted the field. Greying the
    // badge would be asserting something the data does not say.
    const result = advisoryFreshness(summary([{ date: "2026-08-15" }]), NOW);

    expect(result.stale).toBe(false);
    expect(result.lastChecked).toBeUndefined();
    expect(result.ageDays).toBeUndefined();
  });

  it("handles a missing advisory block at all", () => {
    expect(advisoryFreshness(undefined, NOW)).toEqual({ stale: false });
  });

  it("puts the boundary a day past the threshold", () => {
    const at = advisoryFreshness(
      summary([{ date: "2026-01-01", checked: "2026-08-02" }]),
      NOW,
    );
    expect(at.ageDays).toBe(ADVISORY_STALE_AFTER_DAYS);
    expect(at.stale).toBe(false);

    const past = advisoryFreshness(
      summary([{ date: "2026-01-01", checked: "2026-08-01" }]),
      NOW,
    );
    expect(past.ageDays).toBe(ADVISORY_STALE_AFTER_DAYS + 1);
    expect(past.stale).toBe(true);
  });

  it("ignores an unparseable date rather than reading it as epoch zero", () => {
    const result = advisoryFreshness(
      summary([
        { date: "2026-08-01", checked: "not-a-date" },
        { date: "2026-08-01", checked: "2026-08-15" },
      ]),
      NOW,
    );

    expect(result.stale).toBe(false);
    expect(result.lastChecked).toBe("2026-08-15");
  });

  it("reads a date-only string as UTC, not as the server's local midnight", () => {
    // A box in UTC+13 parsing "2026-08-02" as local midnight would place the
    // check 13 hours earlier and could tip a boundary case into stale.
    const result = advisoryFreshness(
      summary([{ date: "2026-01-01", checked: "2026-08-02" }]),
      new Date("2026-08-16T00:30:00Z"),
    );

    expect(result.ageDays).toBe(14);
    expect(result.stale).toBe(false);
  });

  it("never reports a future check as negative age", () => {
    const result = advisoryFreshness(
      summary([{ date: "2026-08-20", checked: "2026-08-20" }]),
      NOW,
    );

    expect(result.ageDays).toBe(0);
    expect(result.stale).toBe(false);
  });
});
