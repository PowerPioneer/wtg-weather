import { afterEach, describe, expect, it, vi } from "vitest";

import { COUNTRIES } from "./countries";
import { mockCountrySlugs } from "./mock-data";

/**
 * The route tree has to be exactly what the data path can answer for.
 *
 * `/[country]` sets `dynamicParams = false`, so a generated slug with nothing
 * behind it is a 404 baked into the build plus a line in the sitemap pointing
 * at it. That is why this is driven by the API's published index rather than
 * by the country registry — the registry is every ISO-2 code a *polygon* can
 * carry, which is a strictly larger set than the countries the pipeline could
 * build a complete climate series for.
 */
afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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

  it("follows the API's published index, not the registry", async () => {
    vi.stubEnv("WTG_USE_MOCK_DATA", "0");
    // Deliberately a country the registry knows and one it does not: the route
    // tree is the *published* set, and inventing entries from the registry to
    // pad it out is the failure this guards.
    const published = [
      { slug: "georgia", name: "Georgia", iso2: "GE", region: "Asia" },
      { slug: "argentina", name: "Argentina", iso2: "AR", region: "South America" },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return Response.json(published);
    });
    vi.stubGlobal("fetch", fetchMock);

    const routable = await load();
    expect(routable.map((c) => c.slug)).toEqual(["georgia", "argentina"]);
    expect(routable.length).toBeLessThan(COUNTRIES.length);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/v1/countries");
  });

  it("throws when a reachable API answers badly", async () => {
    vi.stubEnv("WTG_USE_MOCK_DATA", "0");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no bundle mounted", { status: 503 })),
    );
    // A deploy that forgot the read-only mount answers 503. Degrading to an
    // empty list here would produce a build that succeeds and ships a site
    // with no country pages and no error anywhere.
    await expect(load()).rejects.toThrow(/getCountryIndex failed: 503/);
  });

  it("falls back to on-demand rendering when nothing answers at all", async () => {
    vi.stubEnv("WTG_USE_MOCK_DATA", "0");
    // `pnpm build` runs inside `docker build`, off the compose network, where
    // `http://api:8000` does not resolve. That is a normal build condition,
    // not a misconfiguration — the pages render on first request instead.
    const refused = Object.assign(new TypeError("fetch failed"), {
      cause: { code: "ECONNREFUSED" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw refused;
      }),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(load()).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("rendered on demand"));
    warn.mockRestore();
  });
});
