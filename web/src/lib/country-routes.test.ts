import { afterEach, describe, expect, it, vi } from "vitest";

import { COUNTRIES } from "./countries";
import { mockCountrySlugs } from "./mock-data";

/**
 * `dynamicParams = false` turns every generated slug without data into a
 * build-time 404, so widening the registry to the whole world must not widen
 * the route tree with it until the API can answer for those slugs.
 */
afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

async function load() {
  const mod = await import("./country-routes");
  return mod.routableCountries();
}

describe("routableCountries", () => {
  it("generates only the countries the fixtures cover while mocks are on", async () => {
    vi.stubEnv("WTG_USE_MOCK_DATA", "1");
    const routable = await load();
    expect(routable.map((c) => c.slug).sort()).toEqual(mockCountrySlugs().sort());
    expect(routable.length).toBeLessThan(COUNTRIES.length);
  });

  it("opens up to the whole registry once the real data path is on", async () => {
    vi.stubEnv("WTG_USE_MOCK_DATA", "0");
    const routable = await load();
    expect(routable).toHaveLength(COUNTRIES.length);
  });
});
