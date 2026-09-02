import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CountryRef } from "@/lib/countries";
import type { CountryData, Monthly } from "@/lib/types";

const getCountryIndex = vi.fn<() => Promise<readonly CountryRef[]>>();
const getCountry = vi.fn<(slug: string) => Promise<CountryData | null>>();

vi.mock("@/lib/api-client", () => ({
  getCountryIndex: (...args: []) => getCountryIndex(...args),
  getCountry: (...args: [string]) => getCountry(...args),
  // The page renders `PageHeader`, whose account CTA resolves the session in
  // the browser — so every page rendering the header now reaches for
  // `/api/me`. Anonymous is the right default here: these assertions are about
  // the ranked list and its JSON-LD, not about who is reading it.
  fetchMe: () => Promise.resolve(null),
}));

class NotFoundSignal extends Error {
  constructor() {
    super("notFound()");
    this.name = "NotFoundSignal";
  }
}

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: () => {
    throw new NotFoundSignal();
  },
}));

const Page = (await import("./page")).default;
const { generateMetadata, generateStaticParams } = await import("./page");

const PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");

function flat(value: number): Monthly {
  return Array.from({ length: 12 }, () => value) as unknown as Monthly;
}

function country(slug: string, name: string, t: number, s: number): CountryData {
  return {
    slug,
    name,
    iso2: slug.slice(0, 2).toUpperCase(),
    region: "Southern Europe",
    summary: `${name} summary`,
    bestMonths: [],
    climate: {
      months: [],
      t: flat(t),
      tMin: flat(t - 5),
      tMax: flat(t + 5),
      r: flat(30),
      rDay: flat(1),
      s: flat(s),
    },
    regions: [],
    related: [],
    monthNotes: {},
  };
}

const FIXTURES: Record<string, CountryData> = {
  portugal: country("portugal", "Portugal", 23, 9.5),
  greece: country("greece", "Greece", 19, 7),
  svalbard: country("svalbard", "Svalbard", -8, 0.5),
};

function publishAll(): void {
  getCountryIndex.mockResolvedValue(
    Object.values(FIXTURES).map((c) => ({
      slug: c.slug,
      name: c.name,
      iso2: c.iso2,
      region: c.region,
    })),
  );
  getCountry.mockImplementation(async (slug) => FIXTURES[slug] ?? null);
}

/** The page is an async server component; render what it resolves to. */
async function renderPage(month: string) {
  return render(await Page({ params: Promise.resolve({ month }) }));
}

beforeEach(() => {
  getCountryIndex.mockReset();
  getCountry.mockReset();
  publishAll();
});

describe("/best-weather-in/[month] — rendering", () => {
  it("is a server component with no client JS", () => {
    // The zero-JS rule. This page is pure SEO surface: if it needs a bundle to
    // show a list of links, it has failed at the only job it has.
    expect(PAGE_SOURCE).not.toMatch(/["']use client["']/);
  });

  it("heads the page with the month and lists the countries in rank order", async () => {
    await renderPage("april");

    expect(
      screen.getByRole("heading", { level: 1, name: "Best weather in April" }),
    ).toBeInTheDocument();

    const items = screen.getAllByRole("listitem");
    const names = items
      .map((li) => within(li).queryByRole("link", { name: / in April$/ })?.textContent)
      .filter(Boolean);
    expect(names).toEqual([
      "Portugal in April",
      "Greece in April",
      "Svalbard in April",
    ]);
  });

  it("links each country to its month page and to its year page", async () => {
    await renderPage("april");

    expect(screen.getByRole("link", { name: "Portugal in April" })).toHaveAttribute(
      "href",
      "/portugal/april",
    );
    const allYear = screen.getAllByRole("link", { name: "All year" });
    expect(allYear[0]).toHaveAttribute("href", "/portugal");
  });

  it("offers the other eleven months, and marks the current one", async () => {
    await renderPage("april");

    expect(screen.getByRole("link", { name: "July" })).toHaveAttribute(
      "href",
      "/best-weather-in/july",
    );
    expect(screen.getByRole("link", { name: "April" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "← Best weather in March" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Best weather in May →" }),
    ).toBeInTheDocument();
  });

  it("says the figures are averages rather than a forecast", async () => {
    const { container } = await renderPage("april");
    expect(container.textContent).toMatch(/not a forecast/);
    expect(container.textContent).toMatch(/ten years of ERA5/);
  });
});

describe("/best-weather-in/[month] — structured data", () => {
  it("emits an ItemList that parses as JSON-LD", async () => {
    const { container } = await renderPage("april");

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();

    const parsed: unknown = JSON.parse(script!.textContent ?? "");
    expect(parsed).toMatchObject({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Best weather in April",
      url: "https://v2.wheretogoforgreatweather.com/best-weather-in/april",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
    });
  });

  it("numbers its entries from 1 and points them at the country-month pages", async () => {
    const { container } = await renderPage("april");
    const parsed = JSON.parse(
      container.querySelector('script[type="application/ld+json"]')!.textContent ?? "",
    ) as {
      numberOfItems: number;
      itemListElement: {
        "@type": string;
        position: number;
        name: string;
        url: string;
        item: { "@type": string; url: string };
      }[];
    };

    expect(parsed.numberOfItems).toBe(parsed.itemListElement.length);
    expect(parsed.itemListElement.map((e) => e.position)).toEqual([1, 2, 3]);
    expect(parsed.itemListElement[0]).toMatchObject({
      "@type": "ListItem",
      position: 1,
      name: "Portugal in April",
      url: "https://v2.wheretogoforgreatweather.com/portugal/april",
      item: {
        "@type": "TouristDestination",
        url: "https://v2.wheretogoforgreatweather.com/portugal",
      },
    });
  });

  it("survives a country name that would break the surrounding script tag", async () => {
    getCountryIndex.mockResolvedValue([
      { slug: "odd", name: "Odd", iso2: "OD", region: "Nowhere" },
    ]);
    getCountry.mockResolvedValue(
      country("odd", 'Land of </script><script>alert("x")</script>', 23, 9.5),
    );

    const { container } = await renderPage("april");
    const raw = container.querySelector('script[type="application/ld+json"]')!.textContent ?? "";

    // JSON.stringify escapes the quotes but not `</script>`; the assertion
    // that matters is that the payload still parses and the name round-trips,
    // which is what a consumer of the JSON-LD sees.
    const parsed = JSON.parse(raw) as { itemListElement: { name: string }[] };
    expect(parsed.itemListElement[0]!.name).toContain("Land of");
  });
});

describe("/best-weather-in/[month] — metadata", () => {
  it("declares a canonical URL for the month", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ month: "september" }),
    });
    expect(meta.alternates?.canonical).toBe(
      "https://v2.wheretogoforgreatweather.com/best-weather-in/september",
    );
    expect(meta.title).toContain("September");
    expect(meta.openGraph?.url).toBe(
      "https://v2.wheretogoforgreatweather.com/best-weather-in/september",
    );
  });

  it("does not invent metadata for a month that does not exist", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ month: "smarch" }),
    });
    expect(meta.title).toBe("Month not found");
    expect(meta.alternates?.canonical).toBeUndefined();
  });
});

describe("/best-weather-in/[month] — routing", () => {
  it("404s an unknown month rather than guessing at a near miss", async () => {
    await expect(renderPage("smarch")).rejects.toBeInstanceOf(NotFoundSignal);
    await expect(renderPage("13")).rejects.toBeInstanceOf(NotFoundSignal);
    // Capitalised is not the slug: the URL set is closed and lowercase.
    await expect(renderPage("April")).rejects.toBeInstanceOf(NotFoundSignal);
  });

  it("pre-renders twelve months when the API answers", async () => {
    const params = await generateStaticParams();
    expect(params.map((p) => p.month)).toEqual([
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ]);
  });

  it("pre-renders nothing when the API is unreachable, so the build still passes", async () => {
    // `routableCountries` swallows connection failures and returns [] — the
    // documented state of a `pnpm build` with no stack up. Emitting twelve
    // months here would bake twelve empty rankings into the image and cache
    // them for thirty days.
    const failure = Object.assign(new TypeError("fetch failed"), {
      cause: { code: "ECONNREFUSED" },
    });
    getCountryIndex.mockRejectedValue(failure);

    expect(await generateStaticParams()).toEqual([]);
  });
});
