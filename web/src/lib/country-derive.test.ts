/**
 * The SSR half of "scoring is shared between the map paint expressions and the
 * SSR pages" (`web/CLAUDE.md`).
 *
 * WS-3 wired the paint expression to `preferenceScore` and left the country
 * pages on a hand-rolled heuristic that agreed with nothing — a month could
 * read 74/100 on the page and paint "Perfect match" on the map. These pin the
 * two together. `scoring.test.ts` separately pins `preferenceScore` against
 * the Python it mirrors, so the chain runs page → shared rule → pipeline.
 */

import { describe, expect, it } from "vitest";

import { estimateMonthScore, monthRank, monthScore } from "./country-derive";
import { findCountryData } from "./mock-data";
import { regionMonthScore } from "./regions";
import { DEFAULT_PREFERENCES, preferenceScore } from "./scoring";
import type { CountryData, Monthly } from "./types";

const PERU = findCountryData("peru")!;

function series(value: number): Monthly {
  return Array.from({ length: 12 }, () => value) as unknown as Monthly;
}

function country(overrides: Partial<CountryData["climate"]>): CountryData {
  return {
    ...PERU,
    climate: { ...PERU.climate, ...overrides },
  };
}

describe("monthScore", () => {
  it("is preferenceScore over the country's own series", () => {
    for (let i = 0; i < 12; i++) {
      expect(monthScore(PERU, i)).toBe(
        preferenceScore(
          {
            t: PERU.climate.t[i],
            r: PERU.climate.rDay[i],
            s: PERU.climate.s[i],
          },
          DEFAULT_PREFERENCES,
        ),
      );
    }
  });

  it("reads rainfall in mm/day, not the monthly total the page prints", () => {
    // 60 mm across a 31-day January is 1.9 mm/day — inside the default
    // preference's 2.7 ceiling. Scoring the monthly total instead would put it
    // 22× outside the buffer and drag every wet-ish country to "Avoid".
    const wet = country({
      t: series(22),
      s: series(7),
      r: series(60),
      rDay: series(1.9),
    });
    expect(monthScore(wet, 0)).toBe(90);
  });

  it("returns null when the country carries no usable series", () => {
    const blank = country({
      t: series(Number.NaN),
      rDay: series(Number.NaN),
      s: series(Number.NaN),
    });
    expect(monthScore(blank, 0)).toBeNull();
    // ...and the rendering wrapper flattens that to a number, because a
    // ScoreBadge cannot draw `null`.
    expect(estimateMonthScore(blank, 0)).toBe(0);
  });
});

describe("monthRank", () => {
  it("breaks ties toward the earlier month", () => {
    // The rule buckets rather than grades, so every month of a flat country
    // scores identically and ties are the common case, not the edge case.
    const flat = country({ t: series(22), rDay: series(1), s: series(7) });
    expect(monthRank(flat, 0)).toBe(1);
    expect(monthRank(flat, 11)).toBe(12);
  });
});

describe("regionMonthScore", () => {
  it("uses the region's own rain and sun when the pipeline ships them", () => {
    const region = {
      name: "Test",
      slug: "test",
      score: 0,
      tl: series(22),
      rl: series(0.5),
      sl: series(8),
    };
    expect(regionMonthScore(PERU, region, 0)).toBe(90);
  });

  it("falls back to the country's series for a region without them", () => {
    const region = { name: "Test", slug: "test", score: 0, tl: series(22) };
    expect(regionMonthScore(PERU, region, 0)).toBe(
      preferenceScore(
        { t: 22, r: PERU.climate.rDay[0], s: PERU.climate.s[0] },
        DEFAULT_PREFERENCES,
      ),
    );
  });
});
