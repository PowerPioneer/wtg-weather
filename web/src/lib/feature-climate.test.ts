import { describe, expect, it } from "vitest";

import {
  featureProperties,
  monthKey,
  readFeatureIdentity,
  readModeValue,
  readMonthlyBands,
  readMonthlySeries,
  readNumber,
  readPreferenceScore,
} from "./feature-climate";
import { DEFAULT_PREFERENCES } from "./scoring";

function monthly(prefix: string, base: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (let m = 1; m <= 12; m++) out[monthKey(prefix, m)] = base + m;
  return out;
}

const GEORGIA = {
  id: "GEO",
  iso_a2: "GE",
  admin1_code: "",
  name: "Georgia",
  level: "country",
  ...monthly("t", 5),
  ...monthly("r", 1),
  ...monthly("s", 3),
  ...monthly("pref", 60),
  ...monthly("t2m_p10", 2),
  ...monthly("t2m_p50", 5),
  ...monthly("t2m_p90", 9),
};

describe("readFeatureIdentity", () => {
  it("reads identity off a country feature", () => {
    expect(readFeatureIdentity(GEORGIA)).toEqual({
      id: "GEO",
      name: "Georgia",
      iso2: "GE",
      level: "country",
      admin1Code: "",
    });
  });

  it("keeps the level the pipeline stamped, and defaults an unknown one", () => {
    expect(readFeatureIdentity({ ...GEORGIA, level: "admin2" })?.level).toBe("admin2");
    expect(readFeatureIdentity({ ...GEORGIA, level: "province" })?.level).toBe("country");
  });

  it("returns null without an id, and tolerates missing properties", () => {
    expect(readFeatureIdentity({ name: "Nowhere" })).toBeNull();
    expect(readFeatureIdentity(null)).toBeNull();
    // Somaliland and friends: painted, but no ISO-2 to route on.
    expect(readFeatureIdentity({ id: "SOL", name: "Somaliland" })?.iso2).toBe("");
  });
});

describe("reading values", () => {
  it("rejects non-numeric and non-finite properties rather than coercing", () => {
    expect(readNumber({ t_01: "12.5" }, "t_01")).toBeNull();
    expect(readNumber({ t_01: Number.NaN }, "t_01")).toBeNull();
    expect(readNumber({ t_01: Number.POSITIVE_INFINITY }, "t_01")).toBeNull();
    expect(readNumber({ t_01: 0 }, "t_01")).toBe(0);
  });

  it("reads a 12-month series in calendar order", () => {
    expect(readMonthlySeries(GEORGIA, "t")).toEqual([
      6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
    ]);
  });

  it("returns null for a variable the tier does not carry", () => {
    // Snow, SST, humidity and heat are premium-only; a free feature has none.
    expect(readMonthlySeries(GEORGIA, "snow")).toBeNull();
  });

  it("keeps gaps as null instead of dropping them out of the year", () => {
    const gappy = { ...GEORGIA };
    delete (gappy as Record<string, unknown>)[monthKey("t", 7)];
    const series = readMonthlySeries(gappy, "t");
    expect(series).toHaveLength(12);
    expect(series?.[6]).toBeNull();
  });

  it("reads the percentile triplet, and nothing when one leg is missing", () => {
    const bands = readMonthlyBands(GEORGIA, "t2m");
    expect(bands?.p10[0]).toBe(3);
    expect(bands?.p90[0]).toBe(10);
    // `tp` has only the short alias in this fixture, no percentile triplet.
    expect(readMonthlyBands(GEORGIA, "tp")).toBeNull();
  });

  it("reads the baked preference score for a month", () => {
    expect(readPreferenceScore(GEORGIA, 4)).toBe(64);
    expect(readPreferenceScore({}, 4)).toBeNull();
    // Default preferences are the ones the pipeline baked in, so they must
    // resolve to the baked value rather than recomputing it.
    expect(readPreferenceScore(GEORGIA, 4, DEFAULT_PREFERENCES)).toBe(64);
  });

  it("scores from the raw values once preferences are custom", () => {
    // Georgia in April: 9°C, 5 mm/day, 7 h sun. Under a 5–15°C band the rain
    // is the only hard miss, which the shared rule buckets at 60.
    expect(
      readPreferenceScore(GEORGIA, 4, {
        ...DEFAULT_PREFERENCES,
        tempMin: 5,
        tempMax: 15,
      }),
    ).toBe(60);
    // Still null when the feature carries nothing to score.
    expect(
      readPreferenceScore({}, 4, { ...DEFAULT_PREFERENCES, tempMax: 24 }),
    ).toBeNull();
  });

  it("reads the value the active display mode paints", () => {
    expect(readModeValue(GEORGIA, "temperature", 3)).toBe(8);
    expect(readModeValue(GEORGIA, "rainfall", 3)).toBe(4);
    // Safety is one month-less scalar, not a per-month series (WS-4 data).
    expect(readModeValue({ safety: 2 }, "safety", 3)).toBe(2);
  });
});

describe("featureProperties", () => {
  it("normalises MapLibre's loosely-typed properties bag", () => {
    expect(featureProperties({ properties: { id: "GEO" } })).toEqual({ id: "GEO" });
    expect(featureProperties({})).toEqual({});
    expect(featureProperties({ properties: null })).toEqual({});
  });
});
