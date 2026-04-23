import { describe, expect, it } from "vitest";

import {
  clampScore,
  scoreBin,
  scoreHex,
  scoreLabel,
  scoreShortLabel,
  SCORE_HEX,
} from "./scoring";

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
