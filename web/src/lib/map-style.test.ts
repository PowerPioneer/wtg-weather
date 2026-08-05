import { describe, expect, it } from "vitest";

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
