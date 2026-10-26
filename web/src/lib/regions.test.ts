/**
 * A region's month score has to be the same rule the pipeline bakes into
 * `scores` and the map paints — days and nights — or the region page and the
 * region table on the country page tell a reader two different things.
 */

import { describe, expect, it } from "vitest";

import { findCountryData } from "./mock-data";
import { regionMonthScore } from "./regions";
import { BUCKET_SCORES, DEFAULT_PREFERENCES } from "./scoring";
import type { Monthly, RegionRow } from "./types";

const COUNTRY = findCountryData("peru")!;
const twelve = (v: number) => Array.from({ length: 12 }, () => v) as unknown as Monthly;

/** Bonaire: dry and sunny, warm days — and nights near 26 °C. */
const BONAIRE: RegionRow = {
  name: "Bonaire",
  score: 60,
  tl: twelve(28),
  tn: twelve(26),
  rl: twelve(1),
  sl: twelve(9),
};

describe("regionMonthScore", () => {
  it("judges the nights, as the pipeline and the map do", () => {
    // Days in range, nights 26 °C against a 22 °C ceiling plus 3 °C buffer:
    // a hard miss on temperature, so "Acceptable", not "Perfect match".
    expect(regionMonthScore(COUNTRY, BONAIRE, 0)).toBe(BUCKET_SCORES[1]);
  });

  it("gives the same place a perfect match when its nights are mild", () => {
    expect(regionMonthScore(COUNTRY, { ...BONAIRE, tn: twelve(20) }, 0)).toBe(BUCKET_SCORES[3]);
  });

  it("falls back to the pipeline's scores for a bundle without night lows", () => {
    const legacy: RegionRow = { ...BONAIRE, tn: undefined, scores: twelve(60) };
    expect(regionMonthScore(COUNTRY, legacy, 4)).toBe(60);
  });

  it("still rescores a legacy bundle for a traveller's own preferences", () => {
    const legacy: RegionRow = { ...BONAIRE, tn: undefined, scores: twelve(25) };
    const prefs = { ...DEFAULT_PREFERENCES, dayMax: 32 };
    expect(regionMonthScore(COUNTRY, legacy, 4, prefs)).toBe(BUCKET_SCORES[3]);
  });
});
