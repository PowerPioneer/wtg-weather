import { describe, expect, it } from "vitest";

import type { CountryRef } from "./countries";
import { directHit, normaliseQuery, searchCountries } from "./country-search";

const c = (name: string, iso2: string): CountryRef => ({
  name,
  iso2,
  slug: name.toLowerCase().replace(/[^a-z]+/g, "-"),
  region: "X",
});

const WORLD = [
  c("Côte d'Ivoire", "CI"),
  c("Democratic Republic of the Congo", "CD"),
  c("Republic of the Congo", "CG"),
  c("Peru", "PE"),
  c("Portugal", "PT"),
  c("Papua New Guinea", "PG"),
  c("Guinea", "GN"),
  c("Spain", "ES"),
];

describe("normaliseQuery", () => {
  it("drops accents, apostrophes and case", () => {
    expect(normaliseQuery("  Côte d’Ivoire ")).toBe("cote divoire");
  });
});

describe("searchCountries", () => {
  it("matches without accents", () => {
    expect(searchCountries("cote", WORLD).map((x) => x.iso2)).toEqual(["CI"]);
  });

  it("ranks exact, then prefix, then word-prefix, then substring", () => {
    expect(searchCountries("guinea", WORLD).map((x) => x.iso2)).toEqual([
      "GN",
      "PG",
    ]);
    expect(searchCountries("p", WORLD)).toEqual([]);
    expect(searchCountries("pe", WORLD).map((x) => x.iso2)).toEqual(["PE"]);
  });

  it("finds a word inside a longer name", () => {
    expect(searchCountries("congo", WORLD).map((x) => x.iso2)).toEqual([
      "CD",
      "CG",
    ]);
  });

  it("accepts an ISO-2 code", () => {
    expect(searchCountries("ES", WORLD)[0].iso2).toBe("ES");
  });

  it("ignores a one-letter or empty query", () => {
    expect(searchCountries("", WORLD)).toEqual([]);
    expect(searchCountries(" s ", WORLD)).toEqual([]);
  });
});

describe("directHit", () => {
  it("goes straight to a single match", () => {
    expect(directHit("portu", searchCountries("portu", WORLD))?.iso2).toBe("PT");
  });

  it("goes straight to an exact name even among several", () => {
    expect(directHit("Guinea", searchCountries("Guinea", WORLD))?.iso2).toBe("GN");
  });

  it("shows the list when the query is ambiguous", () => {
    expect(directHit("congo", searchCountries("congo", WORLD))).toBeNull();
  });
});
