import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { findCountryData, mockCountryRefs } from "@/lib/mock-data";
import type { CountryData } from "@/lib/types";

const getCountry = vi.fn<(slug: string) => Promise<CountryData | null>>();

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  getCountryIndex: async () => mockCountryRefs(),
  getCountry: (slug: string) => getCountry(slug),
}));

const CountryPage = (await import("./page")).default;
const SlugPage = (await import("./[slug]/page")).default;

const PERU = findCountryData("peru")!;

/**
 * The JSON-LD as it actually reaches the document.
 *
 * `seo.test.ts` checks the serialiser; this checks the wiring. The two fail
 * differently: a helper that returns valid JSON is no use if the page embeds
 * it in a way the browser parses as markup, or forgets to embed it at all, and
 * neither shows up in a type check or a screenshot. Rendering the real page
 * and parsing what comes out is the only check that covers both.
 */
function extractJsonLd(container: HTMLElement): Record<string, unknown>[] {
  return [...container.querySelectorAll('script[type="application/ld+json"]')].map(
    (script) => JSON.parse(script.textContent ?? "") as Record<string, unknown>,
  );
}

beforeEach(() => {
  getCountry.mockReset();
  getCountry.mockImplementation(async (slug) => findCountryData(slug));
});

describe("country page structured data", () => {
  it("embeds exactly one JSON-LD block, and it parses", async () => {
    const { container } = render(
      await CountryPage({ params: Promise.resolve({ country: "peru" }) }),
    );

    const blocks = extractJsonLd(container);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      "@context": "https://schema.org",
      "@type": "TouristDestination",
      name: "Peru",
      url: "https://v2.wheretogoforgreatweather.com/peru",
    });
  });

  it("describes the country with the same summary the page prints", async () => {
    const { container } = render(
      await CountryPage({ params: Promise.resolve({ country: "peru" }) }),
    );
    expect(extractJsonLd(container)[0]!.description).toBe(PERU.summary);
  });

  it("emits nothing parseable-as-markup even for a hostile summary", async () => {
    getCountry.mockResolvedValue({
      ...PERU,
      summary: 'A country </script><script>alert("xss")</script> with weather',
    });

    const { container } = render(
      await CountryPage({ params: Promise.resolve({ country: "peru" }) }),
    );

    // One script element, not three: the payload did not close its own tag.
    expect(container.querySelectorAll("script")).toHaveLength(1);
    expect(extractJsonLd(container)[0]!.description).toContain("alert");
  });
});

describe("month page structured data", () => {
  it("embeds a TouristTrip for the country-month page", async () => {
    const { container } = render(
      await SlugPage({ params: Promise.resolve({ country: "peru", slug: "april" }) }),
    );

    const blocks = extractJsonLd(container);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      "@context": "https://schema.org",
      "@type": "TouristTrip",
      name: "Peru in April",
      url: "https://v2.wheretogoforgreatweather.com/peru/april",
    });
  });
});

describe("region page structured data", () => {
  it("embeds a TouristDestination nested in its country", async () => {
    const region = PERU.regions[0]!;
    const slug = region.slug ?? region.name.toLowerCase().replace(/\s+/g, "-");

    const { container } = render(
      await SlugPage({ params: Promise.resolve({ country: "peru", slug }) }),
    );

    const blocks = extractJsonLd(container);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      "@type": "TouristDestination",
      containedInPlace: {
        "@type": "Country",
        name: "Peru",
        url: "https://v2.wheretogoforgreatweather.com/peru",
      },
    });
    expect(blocks[0]!.url).toBe(
      `https://v2.wheretogoforgreatweather.com/peru/${slug}`,
    );
  });
});
