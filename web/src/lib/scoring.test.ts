import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BUCKET_SCORES,
  DEFAULT_PREFERENCES,
  DEFAULT_SAFETY_MAX,
  PREFERENCE_LIMITS,
  RAIN_LEVELS,
  clampSafetyMax,
  failsSafetyLimit,
  isDefaultPreferenceSet,
  parseWeatherPreferences,
  rainCeilingForLevel,
  rainLevelForCeiling,
  rainLevelForValue,
  clampPreferences,
  clampScore,
  isDefaultPreferences,
  preferenceRanges,
  preferenceScore,
  scoreBin,
  scoreBucket,
  scoreHex,
  scoreLabel,
  scoreShortLabel,
  SCORE_HEX,
} from "./scoring";

const pipelineSource = (relative: string) =>
  readFileSync(join(process.cwd(), "..", "pipeline/src/wtg_pipeline", relative), "utf8");

describe("scoring", () => {
  it("buckets at bin boundaries", () => {
    expect(scoreBin(100)).toBe("perfect");
    expect(scoreBin(85)).toBe("perfect");
    expect(scoreBin(84)).toBe("good");
    expect(scoreBin(70)).toBe("good");
    expect(scoreBin(69)).toBe("acceptable");
    expect(scoreBin(50)).toBe("acceptable");
    expect(scoreBin(49)).toBe("avoid");
    expect(scoreBin(0)).toBe("avoid");
  });

  it("clamps invalid inputs", () => {
    expect(clampScore(-10)).toBe(0);
    expect(clampScore(150)).toBe(100);
    expect(clampScore(Number.NaN)).toBe(0);
    expect(clampScore(Number.POSITIVE_INFINITY)).toBe(100);
  });

  it("emits a human label for every score", () => {
    expect(scoreLabel(90)).toBe("Perfect match");
    expect(scoreLabel(75)).toBe("Good option");
    expect(scoreLabel(60)).toBe("Acceptable");
    expect(scoreLabel(30)).toBe("Avoid");
  });

  it("emits a short label for compact surfaces", () => {
    expect(scoreShortLabel(90)).toBe("Perfect");
    expect(scoreShortLabel(75)).toBe("Good");
    expect(scoreShortLabel(60)).toBe("Fair");
    expect(scoreShortLabel(30)).toBe("Avoid");
  });

  it("resolves hex values from the Atlas palette", () => {
    expect(scoreHex(90)).toBe(SCORE_HEX.perfect);
    expect(scoreHex(75)).toBe(SCORE_HEX.good);
    expect(scoreHex(60)).toBe(SCORE_HEX.acceptable);
    expect(scoreHex(30)).toBe(SCORE_HEX.avoid);
  });
});

/**
 * The client scorer has to agree with the pipeline's `polygon_score` on the
 * default preferences, because the map paints the pipeline's baked `pref_<mm>`
 * whenever preferences are default and this function's output whenever they
 * are not. Drift shows up as the map changing colour when a user drags a
 * slider back to where it started.
 */
describe("preference scoring — parity with the pipeline", () => {
  it("uses the Python DEFAULT_PREFERENCES ranges and buffers", () => {
    const source = pipelineSource("processing/scoring.py");
    const block = source.match(
      /DEFAULT_PREFERENCES:\s*tuple\[VariablePreference,\s*\.\.\.\]\s*=\s*\(([\s\S]*?)\n\)/,
    );
    expect(block, "could not locate DEFAULT_PREFERENCES in scoring.py").toBeTruthy();

    const python = [
      ...block![1].matchAll(
        /VariablePreference\(\s*"(\w+)",\s*lo=([-\d.]+),\s*hi=([-\d.]+),\s*buffer=([-\d.]+)(?:,\s*concern="(\w+)")?\s*\)/g,
      ),
    ].map((m) => ({
      variable: m[1],
      lo: Number(m[2]),
      hi: Number(m[3]),
      buffer: Number(m[4]),
      concern: m[5],
    }));

    // Four variables over three concerns: temperature is a day/night pair.
    expect(python).toHaveLength(4);

    const ALIAS: Record<string, string> = {
      t2m_max: "t",
      t2m_min: "tmin",
      tp: "r",
      sun_hours: "s",
    };
    expect(preferenceRanges(DEFAULT_PREFERENCES)).toEqual(
      python.map((p) => ({
        alias: ALIAS[p.variable],
        variable: p.variable,
        // Python leaves `concern` off where it defaults to the variable name.
        concern: p.concern ?? p.variable,
        lo: p.lo,
        hi: p.hi,
        buffer: p.buffer,
      })),
    );
  });

  it("groups the same variables into the same concerns as the pipeline", () => {
    // The count of *concerns* is what the bucket thresholds are calibrated
    // against, so a split on one side and not the other silently changes what
    // "one variable outside buffer" means and loosens every threshold.
    const source = pipelineSource("processing/scoring.py");
    const block = source.match(
      /DEFAULT_PREFERENCES:\s*tuple\[VariablePreference,\s*\.\.\.\]\s*=\s*\(([\s\S]*?)\n\)/,
    );
    const pythonConcerns = new Set(
      [
        ...block![1].matchAll(
          /VariablePreference\(\s*"(\w+)",[^)]*?(?:concern="(\w+)")?\s*\)/g,
        ),
      ].map((m) => m[2] ?? m[1]),
    );
    const tsConcerns = new Set(preferenceRanges().map((r) => r.concern));

    expect(tsConcerns.size).toBe(pythonConcerns.size);
    expect(tsConcerns.size).toBe(3);
  });

  it("scores exactly the variables the pipeline scores", () => {
    const source = pipelineSource("tiles/build_geojson.py");
    const block = source.match(/SCORED_VARIABLES:\s*tuple\[str,\s*\.\.\.\]\s*=\s*\(([^)]*)\)/);
    expect(block, "could not locate SCORED_VARIABLES in build_geojson.py").toBeTruthy();

    const python = [...block![1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
    expect(preferenceRanges().map((r) => r.variable)).toEqual(python);
  });

  it("maps buckets onto the same 0–100 scale as SCORE_TO_PREF", () => {
    const source = pipelineSource("tiles/build_geojson.py");
    const block = source.match(/SCORE_TO_PREF:\s*dict\[int,\s*int\]\s*=\s*\{([^}]*)\}/);
    expect(block, "could not locate SCORE_TO_PREF in build_geojson.py").toBeTruthy();

    const python = [...block![1].matchAll(/(\d+):\s*(\d+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    expect(python).toHaveLength(4);
    for (const [bucket, score] of python) {
      expect(BUCKET_SCORES[bucket]).toBe(score);
    }
  });

  it("reproduces the pipeline's bucket rule", () => {
    // 3 — every concern inside its range.
    expect(scoreBucket({ t: 26, tmin: 17, r: 1, s: 8 })).toBe(3);
    // 2 — one concern outside its range but inside the buffer.
    expect(scoreBucket({ t: 32, tmin: 17, r: 1, s: 8 })).toBe(2);
    // 1 — one concern past the buffer, whatever the others do.
    expect(scoreBucket({ t: 40, tmin: 17, r: 1, s: 8 })).toBe(1);
    expect(scoreBucket({ t: 40, tmin: 17, r: 3.5, s: 8 })).toBe(1);
    // 0 — two or more past the buffer.
    expect(scoreBucket({ t: 40, tmin: 17, r: 9, s: 8 })).toBe(0);
  });

  it("counts the day/night pair as one concern, like Python does", () => {
    // Both halves wrong is still a single hard miss, so temperature alone
    // cannot reach 0. Counting the four ranges independently would make one
    // miss out of four milder than one out of three and loosen every
    // threshold — see `polygon_score` in processing/scoring.py.
    expect(scoreBucket({ t: 40, tmin: 17, r: 1, s: 8 })).toBe(1);
    expect(scoreBucket({ t: 40, tmin: -10, r: 1, s: 8 })).toBe(1);
    // A second failing concern does reach the bottom.
    expect(scoreBucket({ t: 40, tmin: -10, r: 9, s: 8 })).toBe(0);
  });

  it("scores a sticky tropical night against the place", () => {
    // The case the split exists for: a 30 °C day with a 27 °C night averaged
    // to 28.5 °C, which the old single-mean rule called a perfect match.
    expect(scoreBucket({ t: 30, tmin: 17, r: 1, s: 8 })).toBe(3);
    expect(scoreBucket({ t: 30, tmin: 27, r: 1, s: 8 })).toBe(1);
  });

  it("scores on the boundary the same way Python's <= does", () => {
    // lo and hi are both inclusive, on both halves of the pair.
    expect(scoreBucket({ t: 22, tmin: 12, r: 0, s: 6 })).toBe(3);
    expect(scoreBucket({ t: 30, tmin: 22, r: 2.7, s: 13 })).toBe(3);
    // 33 = hi + buffer, still inside the buffer.
    expect(scoreBucket({ t: 33, tmin: 17, r: 1, s: 8 })).toBe(2);
    expect(scoreBucket({ t: 33.1, tmin: 17, r: 1, s: 8 })).toBe(1);
  });

  it("ignores variables the feature does not carry", () => {
    // A tier or level missing sunshine must not be punished for it — the
    // pipeline skips absent variables rather than scoring them zero.
    expect(scoreBucket({ t: 26, r: 1 })).toBe(3);
    expect(scoreBucket({ t: 26, r: 1, s: null })).toBe(3);
  });

  it("returns null — not zero — for a feature with no scored data", () => {
    // Zero would paint the polygon "Avoid"; the pipeline omits `pref_<mm>`
    // entirely for these, and the map paints them missing-grey.
    expect(scoreBucket({})).toBeNull();
    expect(preferenceScore({ t: null, r: null, s: null })).toBeNull();
  });

  it("converts buckets to the 0–100 bins the map paints", () => {
    expect(preferenceScore({ t: 26, tmin: 17, r: 1, s: 8 })).toBe(90);
    expect(scoreBin(preferenceScore({ t: 26, tmin: 17, r: 1, s: 8 })!)).toBe("perfect");
    expect(scoreBin(preferenceScore({ t: 32, tmin: 17, r: 1, s: 8 })!)).toBe("good");
    expect(scoreBin(preferenceScore({ t: 40, tmin: 17, r: 1, s: 8 })!)).toBe("acceptable");
    expect(scoreBin(preferenceScore({ t: 40, tmin: 17, r: 9, s: 8 })!)).toBe("avoid");
  });
});

describe("preference scoring — custom preferences", () => {
  it("moves the score when the user's band moves", () => {
    const cold = { ...DEFAULT_PREFERENCES, dayMin: 0, dayMax: 10 };
    expect(scoreBucket({ t: 26, r: 1, s: 8 })).toBe(3);
    expect(scoreBucket({ t: 26, r: 1, s: 8 }, cold)).toBe(1);
    expect(scoreBucket({ t: 6, r: 1, s: 8 }, cold)).toBe(3);

    // And the night band moves independently of the day one.
    const mild = { ...DEFAULT_PREFERENCES, nightMin: 18, nightMax: 24 };
    expect(scoreBucket({ t: 26, tmin: 14, r: 1, s: 8 })).toBe(3);
    expect(scoreBucket({ t: 26, tmin: 14, r: 1, s: 8 }, mild)).toBe(1);
  });

  it("treats rainfall as a ceiling and sunshine as a floor", () => {
    const strict = { ...DEFAULT_PREFERENCES, rainMax: 0.5, sunMin: 10 };
    expect(scoreBucket({ t: 26, r: 4, s: 11 }, strict)).toBe(1);
    expect(scoreBucket({ t: 26, r: 0.4, s: 4 }, strict)).toBe(1);
    expect(scoreBucket({ t: 26, r: 0.4, s: 11 }, strict)).toBe(3);
  });
});

describe("clampPreferences", () => {
  it("returns the defaults for empty or nonsense input", () => {
    expect(clampPreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(clampPreferences({})).toEqual(DEFAULT_PREFERENCES);
    expect(clampPreferences({ dayMin: Number.NaN })).toEqual({
      ...DEFAULT_PREFERENCES,
      dayMin: PREFERENCE_LIMITS.day.min,
    });
  });

  it("holds every value inside its slider's range", () => {
    const p = clampPreferences({
      dayMin: -999,
      dayMax: 999,
      nightMin: -999,
      nightMax: 999,
      rainMax: 500,
      sunMin: 99,
    });
    expect(p.dayMin).toBe(PREFERENCE_LIMITS.day.min);
    expect(p.dayMax).toBe(PREFERENCE_LIMITS.day.max);
    expect(p.nightMin).toBe(PREFERENCE_LIMITS.night.min);
    expect(p.nightMax).toBe(PREFERENCE_LIMITS.night.max);
    expect(p.rainMax).toBe(PREFERENCE_LIMITS.rain.max);
    // A sunshine floor above the range's own ceiling would score nothing.
    expect(p.sunMin).toBe(PREFERENCE_LIMITS.sun.max);
    const sun = preferenceRanges(p).find((r) => r.concern === "sun")!;
    expect(p.sunMin).toBe(sun.hi);
  });

  it("swaps an inverted temperature band rather than dropping it", () => {
    // A hand-edited `?dmin=30&dmax=10` is unambiguous about what was meant.
    expect(clampPreferences({ dayMin: 30, dayMax: 10 })).toMatchObject({
      dayMin: 10,
      dayMax: 30,
    });
    expect(clampPreferences({ nightMin: 20, nightMax: 5 })).toMatchObject({
      nightMin: 5,
      nightMax: 20,
    });
  });
});

describe("isDefaultPreferences", () => {
  it("recognises the pipeline's baked defaults", () => {
    expect(isDefaultPreferences(DEFAULT_PREFERENCES)).toBe(true);
    expect(isDefaultPreferences({ ...DEFAULT_PREFERENCES, sunMin: 6.5 })).toBe(false);
  });

  it("treats an out-of-range value as the clamped one it will be scored as", () => {
    expect(isDefaultPreferences({ ...DEFAULT_PREFERENCES, dayMax: 30.04 })).toBe(true);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * The safety limit — a veto over the climate score rather than a fourth
 * ingredient of it. The pipeline bakes no advisory into `pref_<mm>`, so this
 * rule lives entirely on the client and has to agree with the paint expression
 * in `map-style.ts` (pinned there) and with `readPreferenceScore`.
 * ──────────────────────────────────────────────────────────────────────────── */

describe("safety limit", () => {
  const perfect = { t: 22, r: 1, s: 8 };

  it("defaults to level 3 — only 'do not travel' is vetoed out of the box", () => {
    expect(DEFAULT_PREFERENCES.safetyMax).toBe(3);
    expect(scoreBucket({ ...perfect, safety: 3 })).toBe(3);
    expect(scoreBucket({ ...perfect, safety: 4 })).toBe(0);
  });

  it("drops a place to the bottom bin however good its weather is", () => {
    const cautious = { ...DEFAULT_PREFERENCES, safetyMax: 1 as const };
    expect(scoreBin(preferenceScore(perfect, cautious)!)).toBe("perfect");
    expect(scoreBin(preferenceScore({ ...perfect, safety: 2 }, cautious)!)).toBe(
      "avoid",
    );
  });

  it("passes a place no government lists", () => {
    // The tiles omit `safety` entirely for those polygons. Unknown is not
    // level 4, and treating it as a failure would veto most of the map.
    expect(scoreBucket({ ...perfect, safety: null })).toBe(3);
    expect(scoreBucket(perfect)).toBe(3);
    expect(failsSafetyLimit(null)).toBe(false);
    expect(failsSafetyLimit(undefined)).toBe(false);
  });

  it("leaves a feature with no climate data grey rather than vetoing it", () => {
    // "We have nothing to say about this place" outranks "avoid it" — a null
    // here is a grey polygon, and 0 would paint it red.
    expect(scoreBucket({ safety: 4 })).toBeNull();
    expect(scoreBucket({ t: null, safety: 4 })).toBeNull();
  });

  it("clamps a hand-edited limit into the four levels", () => {
    expect(clampSafetyMax(0)).toBe(1);
    expect(clampSafetyMax(9)).toBe(4);
    expect(clampSafetyMax(2.4)).toBe(2);
    expect(clampSafetyMax("3")).toBe(DEFAULT_SAFETY_MAX);
    expect(clampPreferences({ safetyMax: 99 }).safetyMax).toBe(4);
  });

  it("keeps the baked-score predicate blind to it, and the UI one not", () => {
    // `isDefaultPreferences` decides whether the map may read the pipeline's
    // baked `pref_<mm>`, which no advisory ever entered.
    const strict = { ...DEFAULT_PREFERENCES, safetyMax: 1 as const };
    expect(isDefaultPreferences(strict)).toBe(true);
    expect(isDefaultPreferenceSet(strict)).toBe(false);
    expect(isDefaultPreferenceSet(DEFAULT_PREFERENCES)).toBe(true);
  });

  it("survives a round-trip through an untyped blob", () => {
    const parsed = parseWeatherPreferences({ tempMin: 10, safetyMax: 1 });
    expect(parsed?.safetyMax).toBe(1);
    // A record written before the limit existed gets the default, not zero.
    expect(parseWeatherPreferences({ dayMin: 10 })?.safetyMax).toBe(
      DEFAULT_SAFETY_MAX,
    );
  });
});

describe("rainfall levels", () => {
  it("classifies a measured value into the band it falls in", () => {
    expect(rainLevelForValue(0.4).label).toBe("Dry");
    expect(rainLevelForValue(1).label).toBe("Dry");
    expect(rainLevelForValue(2.9).label).toBe("Light rain");
    expect(rainLevelForValue(4).label).toBe("Moderate rain");
    expect(rainLevelForValue(9.9).label).toBe("Rainy");
    expect(rainLevelForValue(40).label).toBe("Very wet");
  });

  it("round-trips a ceiling back to the level that selects it", () => {
    for (const level of RAIN_LEVELS) {
      expect(rainLevelForCeiling(level.max).level).toBe(level.level);
      expect(rainCeilingForLevel(level.level)).toBe(level.max);
    }
  });

  it("keeps the default band on the pipeline's own ceiling", () => {
    // Not 3.0. The map paints the baked `pref_<mm>` while the preferences are
    // the baked defaults, so picking the default band has to land back on the
    // exact value the pipeline baked — otherwise dragging the slider away and
    // back recolours the map for a traveller who changed nothing.
    expect(rainCeilingForLevel(2)).toBe(DEFAULT_PREFERENCES.rainMax);
    expect(rainLevelForCeiling(DEFAULT_PREFERENCES.rainMax).label).toBe(
      "Light rain",
    );
  });

  it("clamps a level outside the scale", () => {
    expect(rainCeilingForLevel(0)).toBe(RAIN_LEVELS[0].max);
    expect(rainCeilingForLevel(99)).toBe(RAIN_LEVELS[RAIN_LEVELS.length - 1].max);
  });
});
