import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CountryRef } from "@/lib/countries";

const getCountryIndex = vi.fn<() => Promise<readonly CountryRef[]>>();

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  getCountryIndex: () => getCountryIndex(),
}));

const sitemap = (await import("./sitemap")).default;

const BASE = "https://v2.wheretogoforgreatweather.com";

function publish(...slugs: string[]): void {
  getCountryIndex.mockResolvedValue(
    slugs.map((slug) => ({ slug, name: slug, iso2: "XX", region: "Test" })),
  );
}

beforeEach(() => {
  getCountryIndex.mockReset();
});

describe("sitemap", () => {
  it("lists the marketing pages, the month landings, and every country-month", async () => {
    publish("peru", "japan");
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toContain(`${BASE}/`);
    expect(urls).toContain(`${BASE}/map`);
    expect(urls).toContain(`${BASE}/pricing`);

    expect(urls).toContain(`${BASE}/best-weather-in/january`);
    expect(urls).toContain(`${BASE}/best-weather-in/december`);
    expect(urls.filter((u) => u.startsWith(`${BASE}/best-weather-in/`))).toHaveLength(12);

    expect(urls).toContain(`${BASE}/peru`);
    expect(urls).toContain(`${BASE}/peru/april`);
    // 3 marketing + 12 months + 2 countries × 13
    expect(urls).toHaveLength(3 + 12 + 26);
  });

  it("omits the month landings when nothing is published", async () => {
    // Same rule the country pages follow. Each landing page ranks the
    // published index and raises rather than rendering an empty list, so
    // advertising twelve of them while the API is unreachable would fill the
    // sitemap with URLs that error.
    const failure = Object.assign(new TypeError("fetch failed"), {
      cause: { code: "ECONNREFUSED" },
    });
    getCountryIndex.mockRejectedValue(failure);

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toEqual([`${BASE}/`, `${BASE}/map`, `${BASE}/pricing`]);
  });

  it("does not advertise the legal pages", async () => {
    // Linked from every footer, so crawlers find them; nobody should arrive
    // at a privacy policy from a search result.
    publish("peru");
    const urls = (await sitemap()).map((entry) => entry.url);

    for (const path of ["/privacy", "/terms", "/refunds", "/contact"]) {
      expect(urls).not.toContain(`${BASE}${path}`);
    }
  });

  it("is built per request, not baked into the image", async () => {
    // A prerendered sitemap is generated inside `docker build`, where the API
    // is unreachable — which once shipped an image whose sitemap listed three
    // URLs and no countries at all.
    const mod = await import("./sitemap");
    expect(mod.dynamic).toBe("force-dynamic");
  });
});
