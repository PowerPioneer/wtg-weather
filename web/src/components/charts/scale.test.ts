import { describe, expect, it } from "vitest";

import {
  buildBandPath,
  buildBars,
  buildGeometry,
  buildLinePath,
} from "./scale";

const MONTH_12 = [10, 12, 14, 16, 18, 20, 22, 20, 18, 16, 14, 12];

describe("buildGeometry", () => {
  it("is deterministic for the same inputs", () => {
    const a = buildGeometry({ values: MONTH_12 });
    const b = buildGeometry({ values: MONTH_12 });
    expect(a.yTicks).toEqual(b.yTicks);
    expect(a.xOf(0)).toBe(b.xOf(0));
    expect(a.xOf(11)).toBe(b.xOf(11));
    expect(a.yOf(15)).toBe(b.yOf(15));
  });

  it("honours override bounds", () => {
    const g = buildGeometry({
      values: MONTH_12,
      minOverride: 0,
      maxOverride: 100,
    });
    expect(g.min).toBe(0);
    expect(g.max).toBe(100);
    expect(g.yTicks).toEqual([0, 25, 50, 75, 100]);
  });

  it("places months at the centre of each 1/12th column", () => {
    const g = buildGeometry({
      width: 480,
      padL: 36,
      padR: 12,
      values: MONTH_12,
    });
    // innerW = 432; bucket width = 36; so month 0 centres at 36 + 18 = 54.
    expect(g.xOf(0)).toBe(54);
    expect(g.xOf(11)).toBe(54 + 11 * 36);
  });
});

describe("buildLinePath", () => {
  it("emits a stable path for a known series", () => {
    const g = buildGeometry({ values: MONTH_12 });
    const d = buildLinePath(MONTH_12, g);
    expect(d).toMatch(/^M /);
    expect(d).toMatchSnapshot();
  });

  it("is byte-identical across runs with the same inputs", () => {
    const g1 = buildGeometry({ values: MONTH_12 });
    const g2 = buildGeometry({ values: MONTH_12 });
    expect(buildLinePath(MONTH_12, g1)).toBe(buildLinePath(MONTH_12, g2));
  });

  it("returns empty for empty input", () => {
    const g = buildGeometry({ values: [] });
    expect(buildLinePath([], g)).toBe("");
  });
});

describe("buildBars", () => {
  it("anchors bars to the zero baseline when includeZero is on", () => {
    const g = buildGeometry({
      values: [0, 10, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      includeZero: true,
    });
    const bars = buildBars([0, 10, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0], g);
    expect(bars).toHaveLength(12);
    // Bar for month 0 (value 0) has zero height.
    expect(bars[0]!.height).toBe(0);
    // Bar for month 2 (value 20 = max) reaches the top padding.
    expect(Math.round(bars[2]!.y)).toBe(16);
  });
});

describe("buildBandPath", () => {
  it("returns empty when lengths are wrong", () => {
    const g = buildGeometry({ values: MONTH_12 });
    expect(
      buildBandPath({ p10: [1, 2, 3], p90: [4, 5, 6] }, g),
    ).toBe("");
  });

  it("emits a closed polygon for 12-month bands", () => {
    const g = buildGeometry({ values: MONTH_12 });
    const d = buildBandPath(
      {
        p10: MONTH_12.map((v) => v - 2),
        p90: MONTH_12.map((v) => v + 2),
      },
      g,
    );
    expect(d.startsWith("M ")).toBe(true);
    expect(d.endsWith(" Z")).toBe(true);
  });
});
