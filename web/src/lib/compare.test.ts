import { describe, expect, it } from "vitest";

import type { CountryRef } from "./countries";
import { parseCompareParams, resolveCountry } from "./compare";

const c = (slug: string, name: string): CountryRef => ({ slug, name, iso2: slug.slice(0, 2).toUpperCase(), region: "X" });
const WORLD = [
  c("peru", "Peru"),
  c("portugal", "Portugal"),
  c("spain", "Spain"),
  c("republic-of-the-congo", "Republic of the Congo"),
  c("democratic-republic-of-the-congo", "Democratic Republic of the Congo"),
];

describe("resolveCountry", () => {
  it("takes a slug exactly", () => {
    expect(resolveCountry("peru", WORLD)?.slug).toBe("peru");
  });

  it("takes a typed name, accents and case aside", () => {
    expect(resolveCountry("Perú", WORLD)?.slug).toBe("peru");
  });

  it("refuses to guess between two matches", () => {
    expect(resolveCountry("congo", WORLD)).toBeNull();
  });

  it("is null for nothing typed", () => {
    expect(resolveCountry("", WORLD)).toBeNull();
  });
});

describe("parseCompareParams", () => {
  const july = new Date(Date.UTC(2026, 6, 15));

  it("resolves both sides and the month", () => {
    const p = parseCompareParams({ a: "peru", b: "Spain", month: "april" }, WORLD, july);
    expect([p.a?.slug, p.b?.slug, p.month, p.monthIdx]).toEqual(["peru", "spain", "april", 3]);
  });

  it("defaults to the current month and ignores a bad one", () => {
    expect(parseCompareParams({ month: "smarch" }, WORLD, july).month).toBe("july");
    expect(parseCompareParams({}, WORLD, july).monthIdx).toBe(6);
  });

  it("keeps what was typed when it does not resolve", () => {
    const p = parseCompareParams({ a: "congo", b: ["portugal", "spain"] }, WORLD, july);
    expect(p.a).toBeNull();
    expect(p.aQuery).toBe("congo");
    expect(p.b?.slug).toBe("portugal");
  });
});
