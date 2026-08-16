import type { Metadata } from "next";
import { describe, expect, it } from "vitest";

import { findCountryData } from "./mock-data";
import { regionHref } from "./regions";
import {
  canonical,
  countryJsonLd,
  countryMetadata,
  monthJsonLd,
  monthLandingJsonLd,
  monthLandingMetadata,
  monthMetadata,
  regionJsonLd,
  regionMetadata,
  regionMonthJsonLd,
  regionMonthMetadata,
} from "./seo";
import type { CountryData, RegionRow } from "./types";

/**
 * The structured data and canonicals every SSR page emits.
 *
 * Two things are checked. First that each payload is *parseable* — it is
 * injected with `dangerouslySetInnerHTML`, so a serialisation bug produces a
 * page that renders perfectly and carries silently broken markup: nothing in a
 * build, a type check or a screenshot would show it, and the only symptom is
 * search engines quietly ignoring the page. Second that every page type
 * declares a canonical URL, since the region tree is reachable by more than
 * one route shape.
 */

const PERU = findCountryData("peru")!;
const REGION: RegionRow = PERU.regions[0]!;

function parse(payload: string): Record<string, unknown> {
  return JSON.parse(payload) as Record<string, unknown>;
}

const PAYLOADS: readonly [string, string][] = [
  ["country", countryJsonLd(PERU)],
  [
    "country month",
    monthJsonLd({
      country: PERU,
      month: "april",
      monthName: "April",
      monthIdx: 3,
      verdict: "",
      narrative: "",
      score: 75,
      rank: 4,
    }),
  ],
  ["region", regionJsonLd(PERU, REGION)],
  ["region month", regionMonthJsonLd(PERU, REGION, "april", "April")],
  [
    "month landing",
    monthLandingJsonLd("april", "April", [
      { slug: "peru", name: "Peru", rank: 1 },
      { slug: "japan", name: "Japan", rank: 2 },
    ]),
  ],
];

describe.each(PAYLOADS)("%s JSON-LD", (_name, payload) => {
  it("parses as JSON", () => {
    expect(() => parse(payload)).not.toThrow();
  });

  it("declares the schema.org context and a type", () => {
    const parsed = parse(payload);
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(typeof parsed["@type"]).toBe("string");
  });

  it("carries an absolute canonical url", () => {
    const url = parse(payload).url;
    expect(typeof url).toBe("string");
    expect(url as string).toMatch(/^https:\/\/[^/]+\/./);
  });

  it("is safe to embed in a script element", () => {
    // `JSON.stringify` leaves `<` alone, so any payload string containing
    // `</script>` would close the element early and spill the rest of the
    // document as markup. Every `<` is escaped instead.
    expect(payload).not.toContain("<");
  });
});

describe("countryJsonLd", () => {
  it("is a TouristDestination naming the country", () => {
    const parsed = parse(countryJsonLd(PERU));
    expect(parsed["@type"]).toBe("TouristDestination");
    expect(parsed.name).toBe("Peru");
    expect(parsed.description).toBe(PERU.summary);
    expect(parsed.url).toBe("https://v2.wheretogoforgreatweather.com/peru");
    expect(parsed.address).toMatchObject({
      "@type": "PostalAddress",
      addressCountry: "Peru",
    });
  });

  it("survives a payload string that would close the script element", () => {
    // Country summaries are generated from upstream data, so this is a
    // question of what the serialiser does rather than of what the pipeline
    // happens to emit today.
    const hostile: CountryData = {
      ...PERU,
      summary: 'Ends early </script><img src=x onerror="alert(1)">',
    };
    const payload = countryJsonLd(hostile);

    expect(payload).not.toContain("</script>");
    expect(payload).not.toContain("<img");
    // Still the original text once parsed — escaped, not mangled.
    expect(parse(payload).description).toBe(hostile.summary);
  });
});

describe("regionJsonLd", () => {
  it("nests the region inside its country", () => {
    const parsed = parse(regionJsonLd(PERU, REGION));
    expect(parsed["@type"]).toBe("TouristDestination");
    expect(parsed.name).toBe(`${REGION.name}, Peru`);
    expect(parsed.containedInPlace).toMatchObject({
      "@type": "Country",
      name: "Peru",
      url: "https://v2.wheretogoforgreatweather.com/peru",
    });
  });
});

describe("monthLandingJsonLd", () => {
  it("is an ordered ItemList pointing at country-month pages", () => {
    const parsed = parse(
      monthLandingJsonLd("april", "April", [
        { slug: "peru", name: "Peru", rank: 1 },
        { slug: "japan", name: "Japan", rank: 2 },
      ]),
    ) as {
      "@type": string;
      numberOfItems: number;
      itemListOrder: string;
      itemListElement: { position: number; url: string }[];
    };

    expect(parsed["@type"]).toBe("ItemList");
    expect(parsed.numberOfItems).toBe(2);
    expect(parsed.itemListOrder).toBe("https://schema.org/ItemListOrderDescending");
    expect(parsed.itemListElement.map((e) => e.url)).toEqual([
      "https://v2.wheretogoforgreatweather.com/peru/april",
      "https://v2.wheretogoforgreatweather.com/japan/april",
    ]);
  });

  it("reports an empty list honestly rather than omitting the count", () => {
    const parsed = parse(monthLandingJsonLd("april", "April", []));
    expect(parsed.numberOfItems).toBe(0);
    expect(parsed.itemListElement).toEqual([]);
  });
});

describe("canonical URLs", () => {
  it("builds absolute URLs from a path", () => {
    expect(canonical("/peru")).toBe("https://v2.wheretogoforgreatweather.com/peru");
    expect(canonical("peru")).toBe("https://v2.wheretogoforgreatweather.com/peru");
  });

  const cases: readonly [string, () => Metadata, string][] = [
    ["country", () => countryMetadata(PERU), "/peru"],
    [
      "country month",
      () =>
        monthMetadata({
          country: PERU,
          month: "april",
          monthName: "April",
          monthIdx: 3,
          verdict: "",
          narrative: "",
          score: 75,
          rank: 4,
        }),
      "/peru/april",
    ],
    ["region", () => regionMetadata(PERU, REGION), `/peru/${regionHref(REGION)}`],
    [
      "region month",
      () => regionMonthMetadata(PERU, REGION, "april", "April"),
      `/peru/${regionHref(REGION)}/april`,
    ],
    [
      "month landing",
      () => monthLandingMetadata("april", "April", 15),
      "/best-weather-in/april",
    ],
  ];

  it.each(cases)("the %s page declares one", (_name, build, path) => {
    // Region pages in particular: they are the largest part of the URL space
    // and the only ones rendered on demand rather than pre-rendered, which is
    // exactly where a missing canonical would go unnoticed.
    expect(build().alternates?.canonical).toBe(canonical(path));
  });
});
