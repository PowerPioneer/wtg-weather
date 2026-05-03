import { describe, expect, it } from "vitest";

import {
  ADMIN1_FILL_LAYER,
  ADMIN1_LINE_LAYER,
  ADMIN1_MOSAIC_FILL_LAYER,
  ADMIN1_MOSAIC_LINE_LAYER,
  ADMIN2_FILL_LAYER,
  COUNTRY_FILL_LAYER,
  FILL_LAYER_IDS,
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
    const filterStr = JSON.stringify(mosaicFill?.filter);
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
