import { describe, expect, it } from "vitest";

import {
  DEFAULT_PREFERENCES,
  preferenceScore,
  type ScoredValues,
  type WeatherPreferences,
} from "./scoring";
import {
  ADMIN1_FILL_LAYER,
  ADMIN1_LINE_LAYER,
  ADMIN1_MOSAIC_FILL_LAYER,
  ADMIN1_MOSAIC_LINE_LAYER,
  ADMIN2_FILL_LAYER,
  COUNTRY_FILL_LAYER,
  FILL_LAYER_IDS,
  FREE_SOURCE_ID,
  PREMIUM_SOURCE_ID,
  SUPPRESSED_COUNTRIES,
  activeFillLayerIds,
  buildFillColorExpression,
  buildMapStyle,
  buildPreferenceScoreExpression,
} from "./map-style";

const FREE_URL = "https://example.test/free.pmtiles?exp=1&sig=abc";
const PREMIUM_URL = "https://example.test/premium.pmtiles?exp=1&sig=def";

describe("buildFillColorExpression", () => {
  it("guards null props with the missing sentinel via coalesce", () => {
    // Regression: previously `to-number(null, -9999)` returned 0 (falling
    // into the lowest bin) instead of triggering the missing-fill branch.
    const expr = buildFillColorExpression("preferences", 5);
    const json = JSON.stringify(expr);
    expect(json).toContain("coalesce");
    expect(json).toContain("-9999");
  });

  it("reads pref_<mm> for the preferences mode", () => {
    const expr = buildFillColorExpression("preferences", 5);
    expect(JSON.stringify(expr)).toContain("pref_05");
  });

  it("reads short aliases for ramp modes", () => {
    expect(JSON.stringify(buildFillColorExpression("temperature", 1))).toContain('"t_01"');
    expect(JSON.stringify(buildFillColorExpression("rainfall", 12))).toContain('"r_12"');
    expect(JSON.stringify(buildFillColorExpression("sunshine", 7))).toContain('"s_07"');
    expect(JSON.stringify(buildFillColorExpression("wind", 3))).toContain('"w_03"');
  });
});

/**
 * Just enough of the MapLibre expression language to run the expressions this
 * module emits. The point is to check that the paint expression and
 * `scoring.ts` agree on a score: they are two implementations of one rule, one
 * in TypeScript for the panels and one pushed down into the GPU-side paint, and
 * nothing else in the app compares them.
 */
function evaluateExpression(expr: unknown, props: Record<string, unknown>): unknown {
  if (!Array.isArray(expr)) return expr;
  const [op, ...args] = expr as [string, ...unknown[]];
  const ev = (e: unknown) => evaluateExpression(e, props);
  const num = (e: unknown) => Number(ev(e));

  switch (op) {
    case "literal":
      return args[0];
    case "get": {
      const value = props[String(ev(args[0]))];
      return value === undefined ? null : value;
    }
    case "has":
      return Object.prototype.hasOwnProperty.call(props, String(ev(args[0])));
    case "to-number": {
      const value = ev(args[0]);
      // Matches the spec: null and false convert to 0, which is why every
      // comparison in the score expression is gated on `has`.
      if (value === null || value === false) return 0;
      return Number(value);
    }
    case "coalesce": {
      for (const arg of args) {
        const value = ev(arg);
        if (value !== null && value !== undefined) return value;
      }
      return null;
    }
    case "+":
      return args.reduce<number>((sum, arg) => sum + num(arg), 0);
    case "==":
      return ev(args[0]) === ev(args[1]);
    case ">=":
      return num(args[0]) >= num(args[1]);
    case "<=":
      return num(args[0]) <= num(args[1]);
    case "all":
      return args.every((arg) => ev(arg) === true);
    case "!":
      return ev(args[0]) !== true;
    case "case": {
      for (let i = 0; i + 1 < args.length; i += 2) {
        if (ev(args[i]) === true) return ev(args[i + 1]);
      }
      return ev(args[args.length - 1]);
    }
    case "step": {
      const input = num(args[0]);
      let output = ev(args[1]);
      for (let i = 2; i + 1 < args.length; i += 2) {
        if (input < Number(args[i])) break;
        output = ev(args[i + 1]);
      }
      return output;
    }
    default:
      throw new Error(`test evaluator: unsupported operator ${op}`);
  }
}

describe("buildPreferenceScoreExpression", () => {
  const MONTH = 4;
  const MISSING = -9999;

  const toProps = (values: ScoredValues): Record<string, number> => {
    const props: Record<string, number> = {};
    if (values.t != null) props.t_04 = values.t;
    if (values.r != null) props.r_04 = values.r;
    if (values.s != null) props.s_04 = values.s;
    return props;
  };

  const CASES: ScoredValues[] = [
    { t: 22, r: 1, s: 8 }, // everything in range
    { t: 30, r: 1, s: 8 }, // one in buffer
    { t: 40, r: 1, s: 8 }, // one past buffer
    { t: 40, r: 9, s: 8 }, // two past buffer
    { t: 18, r: 0, s: 6 }, // exactly on the lower bounds
    { t: 28, r: 2.7, s: 13 }, // exactly on the upper bounds
    { t: 22, r: 1 }, // sunshine absent from this tier/level
    { t: 22 }, // only temperature
    {}, // nothing scoreable
  ];

  const PREFERENCE_SETS: WeatherPreferences[] = [
    DEFAULT_PREFERENCES,
    { tempMin: 0, tempMax: 10, rainMax: 2.7, sunMin: 6 },
    { tempMin: 18, tempMax: 28, rainMax: 0.5, sunMin: 10 },
    { tempMin: -10, tempMax: 45, rainMax: 12, sunMin: 0 },
  ];

  it("computes the same score as scoring.ts for every case", () => {
    for (const prefs of PREFERENCE_SETS) {
      const expr = buildPreferenceScoreExpression(prefs, MONTH);
      for (const values of CASES) {
        const expected = preferenceScore(values, prefs) ?? MISSING;
        expect(
          evaluateExpression(expr, toProps(values)),
          `${JSON.stringify(values)} under ${JSON.stringify(prefs)}`,
        ).toBe(expected);
      }
    }
  });

  it("reads the month it was built for, and only that month", () => {
    const expr = JSON.stringify(buildPreferenceScoreExpression(DEFAULT_PREFERENCES, 11));
    expect(expr).toContain('"t_11"');
    expect(expr).toContain('"r_11"');
    expect(expr).toContain('"s_11"');
    expect(expr).not.toContain("_04");
  });

  it("returns the missing sentinel rather than zero for an empty feature", () => {
    // Zero would land in the "avoid" bin and paint an unmeasured polygon dark
    // red; the sentinel routes it to the neutral missing-fill instead.
    const expr = buildPreferenceScoreExpression(DEFAULT_PREFERENCES, MONTH);
    expect(evaluateExpression(expr, {})).toBe(MISSING);
    expect(evaluateExpression(expr, { name: "Nowhere" })).toBe(MISSING);
  });
});

describe("preferences mode paint", () => {
  const MISSING_FILL = "#D9D5C8";

  it("keeps reading the baked pref_<mm> while preferences are default", () => {
    // Default preferences reproduce the pipeline's baked score exactly, so the
    // cheap `get` is the right expression — and it keeps the default map
    // byte-identical to what shipped before preferences existed.
    const expr = JSON.stringify(
      buildFillColorExpression("preferences", 5, DEFAULT_PREFERENCES),
    );
    expect(expr).toContain("pref_05");
    expect(expr).not.toContain("t_05");
  });

  it("scores from the raw per-month properties once preferences are custom", () => {
    const expr = JSON.stringify(
      buildFillColorExpression("preferences", 5, {
        ...DEFAULT_PREFERENCES,
        tempMax: 24,
      }),
    );
    expect(expr).not.toContain("pref_05");
    expect(expr).toContain('"t_05"');
    expect(expr).toContain('"r_05"');
    expect(expr).toContain('"s_05"');
  });

  it("colours a feature by the bin its custom score falls in", () => {
    const chilly = { tempMin: 0, tempMax: 10, rainMax: 2.7, sunMin: 6 };
    const expr = buildFillColorExpression("preferences", 4, chilly);
    // 6°C, dry, sunny — a perfect match for someone who wants it cold.
    expect(evaluateExpression(expr, { t_04: 6, r_04: 1, s_04: 8 })).toBe("#0B6E5F");
    // 22°C is far outside a 0–10° band: one hard miss out of three.
    expect(evaluateExpression(expr, { t_04: 22, r_04: 1, s_04: 8 })).toBe("#B8610E");
    expect(evaluateExpression(expr, { name: "Nowhere" })).toBe(MISSING_FILL);
  });

  it("passes preferences through buildMapStyle to every fill layer", () => {
    const style = buildMapStyle({
      freeTilesUrl: FREE_URL,
      premiumTilesUrl: PREMIUM_URL,
      mode: "preferences",
      month: 4,
      preferences: { ...DEFAULT_PREFERENCES, sunMin: 9 },
    });
    for (const id of [COUNTRY_FILL_LAYER, ADMIN1_FILL_LAYER, ADMIN1_MOSAIC_FILL_LAYER, ADMIN2_FILL_LAYER]) {
      const layer = style.layers.find((l) => l.id === id);
      const paint = layer && "paint" in layer ? layer.paint : undefined;
      expect(JSON.stringify(paint)).toContain('"s_04"');
    }
  });
});

describe("buildMapStyle", () => {
  it("emits an admin-1 mosaic layer at country zoom for suppressed countries", () => {
    const style = buildMapStyle({
      freeTilesUrl: FREE_URL,
      premiumTilesUrl: null,
      mode: "preferences",
      month: 4,
    });
    const mosaicFill = style.layers.find((l) => l.id === ADMIN1_MOSAIC_FILL_LAYER);
    const mosaicLine = style.layers.find((l) => l.id === ADMIN1_MOSAIC_LINE_LAYER);
    expect(mosaicFill).toBeDefined();
    expect(mosaicLine).toBeDefined();
    // The mosaic must cap at the admin-1 transition zoom — above that, the
    // regular admin-1 fill takes over and renders everyone.
    expect(mosaicFill).toMatchObject({ "source-layer": "admin1" });
    // `filter` only exists on non-background layers — narrow before reading.
    const filter =
      mosaicFill && "filter" in mosaicFill ? mosaicFill.filter : undefined;
    const filterStr = JSON.stringify(filter);
    for (const iso of SUPPRESSED_COUNTRIES) {
      expect(filterStr).toContain(iso);
    }
  });

  it("orders mosaic layers below the regular admin-1 fill", () => {
    const style = buildMapStyle({
      freeTilesUrl: FREE_URL,
      premiumTilesUrl: null,
      mode: "preferences",
      month: 4,
    });
    const ids = style.layers.map((l) => l.id);
    expect(ids.indexOf(ADMIN1_MOSAIC_FILL_LAYER)).toBeLessThan(
      ids.indexOf(ADMIN1_FILL_LAYER),
    );
    expect(ids.indexOf(COUNTRY_FILL_LAYER)).toBeLessThan(
      ids.indexOf(ADMIN1_MOSAIC_FILL_LAYER),
    );
  });

  it("omits admin-2 layers without premium tiles", () => {
    const style = buildMapStyle({
      freeTilesUrl: FREE_URL,
      premiumTilesUrl: null,
      mode: "preferences",
      month: 4,
    });
    expect(style.layers.find((l) => l.id === ADMIN2_FILL_LAYER)).toBeUndefined();
  });

  it("includes admin-2 layers with premium tiles", () => {
    const style = buildMapStyle({
      freeTilesUrl: FREE_URL,
      premiumTilesUrl: PREMIUM_URL,
      mode: "preferences",
      month: 4,
    });
    expect(style.layers.find((l) => l.id === ADMIN2_FILL_LAYER)).toBeDefined();
  });

  it("does not duplicate admin-1 lines for suppressed countries above the mosaic zoom", () => {
    // Above ZOOM_ADMIN1_MIN there must be exactly one admin-1 line layer; the
    // mosaic line caps at country zoom so it does not double-paint borders.
    const style = buildMapStyle({
      freeTilesUrl: FREE_URL,
      premiumTilesUrl: null,
      mode: "preferences",
      month: 4,
    });
    const adminLines = style.layers.filter(
      (l) => l.id === ADMIN1_LINE_LAYER || l.id === ADMIN1_MOSAIC_LINE_LAYER,
    );
    expect(adminLines).toHaveLength(2);
  });
});

describe("activeFillLayerIds", () => {
  it("returns every fill layer when premium is enabled", () => {
    expect(activeFillLayerIds(true)).toEqual(FILL_LAYER_IDS);
  });

  it("excludes the admin-2 layer when premium is disabled", () => {
    const ids = activeFillLayerIds(false);
    expect(ids).toContain(COUNTRY_FILL_LAYER);
    expect(ids).toContain(ADMIN1_MOSAIC_FILL_LAYER);
    expect(ids).toContain(ADMIN1_FILL_LAYER);
    expect(ids).not.toContain(ADMIN2_FILL_LAYER);
  });
});

describe("SUPPRESSED_COUNTRIES parity with the pipeline", () => {
  // These countries emit no country-level row, so the map paints their
  // admin-1 polygons as a mosaic instead. The list is duplicated here and in
  // pipeline/src/wtg_pipeline/processing/country_rules.py; if the two drift,
  // a country is either painted twice or not at all — Argentina, Chile and
  // Kazakhstan were invisible for exactly this class of mismatch.
  it("matches the Python SUPPRESSED_COUNTRIES table", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const source = readFileSync(
      join(
        process.cwd(),
        "..",
        "pipeline/src/wtg_pipeline/processing/country_rules.py",
      ),
      "utf8",
    );

    const block = source.match(
      /SUPPRESSED_COUNTRIES:\s*frozenset\[str\]\s*=\s*frozenset\(\s*\{([\s\S]*?)\}\s*\)/,
    );
    expect(block, "could not locate SUPPRESSED_COUNTRIES in country_rules.py").toBeTruthy();

    const pythonCodes = [...block![1].matchAll(/"([A-Z]{2})"/g)].map((m) => m[1]);
    expect(pythonCodes.length).toBeGreaterThan(0);
    expect([...pythonCodes].sort()).toEqual([...SUPPRESSED_COUNTRIES].sort());
  });
});

describe("tier source selection", () => {
  // A layer reads properties only from its own source, and the premium-only
  // variables live solely in the premium archive. If country and admin-1 keep
  // pointing at the free archive, an entitled user selecting Snow depth or Sea
  // surface temp gets missing-grey everywhere above admin-2 zoom.
  const base = { mode: "preferences" as const, month: 4 };

  const sourceOf = (style: ReturnType<typeof buildMapStyle>, layerId: string) => {
    const layer = style.layers.find((l) => l.id === layerId);
    return layer && "source" in layer ? layer.source : undefined;
  };

  it("reads every base layer from the free archive without premium", () => {
    const style = buildMapStyle({ ...base, freeTilesUrl: FREE_URL, premiumTilesUrl: null });
    for (const id of [COUNTRY_FILL_LAYER, ADMIN1_FILL_LAYER, ADMIN1_MOSAIC_FILL_LAYER]) {
      expect(sourceOf(style, id)).toBe(FREE_SOURCE_ID);
    }
  });

  it("reads every base layer from the premium archive when entitled", () => {
    const style = buildMapStyle({
      ...base,
      freeTilesUrl: FREE_URL,
      premiumTilesUrl: PREMIUM_URL,
    });
    for (const id of [
      COUNTRY_FILL_LAYER,
      ADMIN1_FILL_LAYER,
      ADMIN1_MOSAIC_FILL_LAYER,
      ADMIN2_FILL_LAYER,
    ]) {
      expect(sourceOf(style, id)).toBe(PREMIUM_SOURCE_ID);
    }
  });

  it("falls back to the free archive when premium is denied", () => {
    // `useTileUrls` nulls the premium URL on a 403 rather than crashing; the
    // map must degrade to the free variable set, not go blank.
    const style = buildMapStyle({ ...base, freeTilesUrl: FREE_URL, premiumTilesUrl: null });
    expect(Object.keys(style.sources)).toEqual([FREE_SOURCE_ID]);
    expect(style.layers.find((l) => l.id === ADMIN2_FILL_LAYER)).toBeUndefined();
  });

  it("declares no source it does not use, and uses none it did not declare", () => {
    for (const premiumTilesUrl of [null, PREMIUM_URL]) {
      const style = buildMapStyle({ ...base, freeTilesUrl: FREE_URL, premiumTilesUrl });
      const declared = new Set(Object.keys(style.sources));
      const referenced = new Set(
        style.layers.flatMap((l) => ("source" in l && l.source ? [l.source] : [])),
      );
      expect([...referenced].sort()).toEqual([...declared].sort());
    }
  });

  it("never emits a camera, so setStyle preserves the user's viewport", () => {
    const style = buildMapStyle({ ...base, freeTilesUrl: FREE_URL, premiumTilesUrl: null });
    expect(style).not.toHaveProperty("center");
    expect(style).not.toHaveProperty("zoom");
  });
});
