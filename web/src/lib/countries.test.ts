import { describe, expect, it } from "vitest";

import { COUNTRIES, findCountry, findCountryByIso2 } from "./countries";
import { SUPPRESSED_COUNTRIES } from "./map-style";

/**
 * The registry is generated from Natural Earth
 * (`pipeline/scripts/generate_country_registry.py`), so these are guards on the
 * generator's output rather than on hand-typed data: a wrong-vintage or
 * half-written table is exactly what shipped the "clicking does nothing" bug.
 */
describe("country registry", () => {
  it("covers the whole world, not a sample of it", () => {
    // ~195 sovereign states plus the dependencies Natural Earth gives their
    // own ISO-2 code. A table that has collapsed back to a handful of mock
    // entries fails here.
    expect(COUNTRIES.length).toBeGreaterThan(190);
  });

  it("has one entry per ISO-2 code and per slug", () => {
    const isos = COUNTRIES.map((c) => c.iso2);
    const slugs = COUNTRIES.map((c) => c.slug);
    expect(new Set(isos).size).toBe(isos.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("carries well-formed codes, slugs, names and regions", () => {
    for (const country of COUNTRIES) {
      expect(country.iso2).toMatch(/^[A-Z]{2}$/);
      expect(country.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(country.name.length).toBeGreaterThan(0);
      expect(country.region.length).toBeGreaterThan(0);
    }
  });

  it("resolves the countries that were reported missing", () => {
    // Georgia is present in the tiles but was absent from the nine-entry
    // registry, so clicking it did nothing; Argentina, Chile and Kazakhstan
    // are the suppressed countries that render as an admin-1 mosaic.
    for (const iso2 of ["GE", "AR", "CL", "KZ"]) {
      expect(findCountryByIso2(iso2), iso2).toBeDefined();
    }
    expect(findCountryByIso2("GE")?.slug).toBe("georgia");
  });

  it("resolves every suppressed country, whose polygons are admin-1 only", () => {
    // Their features reach the click handler from the mosaic layer, carrying
    // the country's ISO-2 — a miss here is a dead click on a whole country.
    for (const iso2 of SUPPRESSED_COUNTRIES) {
      expect(findCountryByIso2(iso2), iso2).toBeDefined();
    }
  });

  it("looks codes up case-insensitively and rejects the codeless ones", () => {
    expect(findCountryByIso2("pe")?.slug).toBe("peru");
    // Somaliland, Northern Cyprus and the Siachen Glacier are painted but
    // carry an empty `iso_a2`; the pipeline blanks Natural Earth's `-99`.
    expect(findCountryByIso2("")).toBeUndefined();
    expect(findCountryByIso2("-99")).toBeUndefined();
  });

  it("keeps the slugs the mock fixtures and existing links depend on", () => {
    for (const slug of ["peru", "japan", "iceland"]) {
      expect(findCountry(slug), slug).toBeDefined();
    }
  });

  it("uses common English names for the two countries whose formal name differs", () => {
    // Natural Earth's NAME_EN is "People's Republic of China" / "United States
    // of America"; the slug is a public URL, so the generator overrides both.
    expect(findCountryByIso2("CN")?.slug).toBe("china");
    expect(findCountryByIso2("US")?.slug).toBe("united-states");
  });
});
