/**
 * The landing page's grid, which shipped fixture-backed.
 *
 * `/` built it from `mockCountrySlugs()` directly — not behind
 * `WTG_USE_MOCK_DATA` — so production's front door advertised three fixture
 * countries. The first test here is that regression: nothing in the grid comes
 * from anywhere but the published index.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import type { CountryData, Monthly } from "./types";

const routableCountries = vi.fn();
const getCountry = vi.fn();

vi.mock("./country-routes", () => ({ routableCountries }));
vi.mock("./api-client", () => ({ getCountry }));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

async function load() {
  return import("./featured");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function flat(value: number): Monthly {
  return Array.from({ length: 12 }, () => value) as unknown as Monthly;
}

/**
 * A country whose every month scores the same. `t` inside 18–28, `rDay` under
 * 2.7 and `s` over 6 is a perfect match under `DEFAULT_PREFERENCES`; pushing
 * temperature far outside the band is a miss.
 */
function country(slug: string, opts: { temp: number } = { temp: 22 }): CountryData {
  return {
    slug,
    name: slug[0]!.toUpperCase() + slug.slice(1),
    iso2: slug.slice(0, 2).toUpperCase(),
    region: "Testland",
    summary: "",
    bestMonths: [],
    climate: {
      months: MONTHS,
      t: flat(opts.temp),
      tMin: flat(opts.temp - 4),
      tMax: flat(opts.temp + 4),
      r: flat(30),
      rDay: flat(1),
      s: flat(8),
    },
    regions: [],
    related: [],
    monthNotes: {},
  };
}

function published(...slugs: string[]) {
  return slugs.map((slug) => ({
    slug,
    name: slug,
    iso2: slug.slice(0, 2).toUpperCase(),
    region: "Testland",
  }));
}

describe("featuredCountries", () => {
  it("shows only countries the API has published", async () => {
    // "atlantis" is on the shortlist's side of the world but not the API's.
    routableCountries.mockResolvedValue(published("peru", "japan"));
    getCountry.mockImplementation(async (slug: string) => country(slug));
    const { featuredCountries } = await load();

    const grid = await featuredCountries(3);

    expect(grid.map((c) => c.slug).sort()).toEqual(["japan", "peru"]);
    expect(getCountry).not.toHaveBeenCalledWith("atlantis");
  });

  it("only ever asks for shortlisted slugs", async () => {
    routableCountries.mockResolvedValue(published("peru", "zimbabwe"));
    getCountry.mockImplementation(async (slug: string) => country(slug));
    const { featuredCountries, FEATURED_CANDIDATES } = await load();

    await featuredCountries(0);

    for (const call of getCountry.mock.calls) {
      expect(FEATURED_CANDIDATES).toContain(call[0]);
    }
  });

  it("ranks by the month's score and breaks ties on slug", async () => {
    // The scoring rule buckets rather than grades — four distinct values — so
    // ties are the common case. Without a tie-break the grid reshuffles on
    // every rebuild for no reason a visitor could see.
    routableCountries.mockResolvedValue(published("peru", "japan", "iceland", "greece"));
    getCountry.mockImplementation(async (slug: string) =>
      country(slug, { temp: slug === "iceland" ? -20 : 22 }),
    );
    const { featuredCountries } = await load();

    const grid = await featuredCountries(6);

    expect(grid.map((c) => c.slug)).toEqual(["greece", "japan", "peru", "iceland"]);
    expect(grid[0]!.score).toBeGreaterThan(grid[3]!.score);
  });

  it("is stable: the same inputs give the same grid", async () => {
    routableCountries.mockResolvedValue(published("peru", "japan", "greece"));
    getCountry.mockImplementation(async (slug: string) => country(slug));
    const { featuredCountries } = await load();

    const a = await featuredCountries(3);
    const b = await featuredCountries(3);
    expect(a).toEqual(b);
  });

  it("caps the grid", async () => {
    const { FEATURED_CANDIDATES, FEATURED_COUNT, featuredCountries } = await load();
    routableCountries.mockResolvedValue(published(...FEATURED_CANDIDATES));
    getCountry.mockImplementation(async (slug: string) => country(slug));

    expect(await featuredCountries(0)).toHaveLength(FEATURED_COUNT);
  });

  it("labels each card with the month it was ranked for", async () => {
    routableCountries.mockResolvedValue(published("peru"));
    getCountry.mockImplementation(async (slug: string) => country(slug));
    const { featuredCountries } = await load();

    const [card] = await featuredCountries(3);
    expect(card).toMatchObject({ month: "april", monthName: "April" });
  });

  it("renders nothing rather than throwing when the API is unreachable", async () => {
    // `routableCountries` already swallows a connection failure into `[]`.
    routableCountries.mockResolvedValue([]);
    const { featuredCountries } = await load();

    expect(await featuredCountries(0)).toEqual([]);
    expect(getCountry).not.toHaveBeenCalled();
  });

  it("drops one country that fails rather than the whole grid", async () => {
    routableCountries.mockResolvedValue(published("peru", "japan"));
    getCountry.mockImplementation(async (slug: string) => {
      if (slug === "japan") throw new Error("500");
      return country(slug);
    });
    const { featuredCountries } = await load();

    expect((await featuredCountries(0)).map((c) => c.slug)).toEqual(["peru"]);
  });
});
