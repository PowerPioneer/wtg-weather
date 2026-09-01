import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CountryRef } from "./countries";
import type { CountryData, Monthly } from "./types";

const getCountryIndex = vi.fn<() => Promise<readonly CountryRef[]>>();
const getCountry = vi.fn<(slug: string) => Promise<CountryData | null>>();

vi.mock("./api-client", () => ({
  getCountryIndex: (...args: []) => getCountryIndex(...args),
  getCountry: (...args: [string]) => getCountry(...args),
}));

const {
  NoPublishedCountriesError,
  TOP_N,
  comfortMargin,
  monthLandingHref,
  topCountriesForMonth,
} = await import("./month-ranking");
const { DEFAULT_PREFERENCES } = await import("./scoring");
const { MONTH_SLUGS } = await import("./months");

/** Twelve identical values — a country whose year does not vary. */
function flat(value: number): Monthly {
  return Array.from({ length: 12 }, () => value) as unknown as Monthly;
}

function country(
  slug: string,
  { tMax, tMin, rDay, s }: { tMax: number; tMin: number; rDay: number; s: number },
): CountryData {
  return {
    slug,
    name: slug.replace(/(^|-)(\w)/g, (_, sep: string, c: string) => (sep ? " " : "") + c.toUpperCase()),
    iso2: slug.slice(0, 2).toUpperCase(),
    region: "Test Region",
    summary: `${slug} summary`,
    bestMonths: [],
    climate: {
      months: [...MONTH_SLUGS],
      // `t` is an alias of the daily maximum now, not a separate series.
      t: flat(tMax),
      tMin: flat(tMin),
      tMax: flat(tMax),
      r: flat(rDay * 30),
      rDay: flat(rDay),
      s: flat(s),
    },
    regions: [],
    related: [],
    monthNotes: {},
  };
}

/**
 * Dead centre of every default range: 26 °C days, 17 °C nights, 1.35 mm/day,
 * 9.5 h sun.
 */
const IDEAL = { tMax: 26, tMin: 17, rDay: 1.35, s: 9.5 };
/** Scores the same as IDEAL (all inside the ranges) but hugging the edges. */
const EDGE = { tMax: 22.2, tMin: 12.2, rDay: 2.6, s: 6.1 };

function publish(...slugs: string[]): void {
  getCountryIndex.mockResolvedValue(
    slugs.map((slug) => ({
      slug,
      name: slug,
      iso2: slug.slice(0, 2).toUpperCase(),
      region: "Test Region",
    })),
  );
}

beforeEach(() => {
  getCountryIndex.mockReset();
  getCountry.mockReset();
});

describe("comfortMargin", () => {
  it("peaks in the middle of every range and falls off towards the edges", () => {
    const middle = comfortMargin(country("middle", IDEAL), 3);
    const edge = comfortMargin(country("edge", EDGE), 3);
    expect(middle).toBeGreaterThan(edge);
    expect(middle).toBeCloseTo(1, 1);
  });

  it("goes negative for a month outside the ranges", () => {
    expect(
      comfortMargin(country("hot", { tMax: 44, tMin: 32, rDay: 11, s: 1 }), 0),
    ).toBeLessThan(0);
  });

  it("reads the month it is asked about", () => {
    const c = country("seasonal", IDEAL);
    // Rewrite July only, to something far outside every range.
    const tMax = [...c.climate.tMax] as number[];
    tMax[6] = 45;
    const seasonal = {
      ...c,
      climate: {
        ...c.climate,
        t: tMax as unknown as Monthly,
        tMax: tMax as unknown as Monthly,
      },
    };
    expect(comfortMargin(seasonal, 6)).toBeLessThan(comfortMargin(seasonal, 5));
  });

  it("uses only the ranges the scoring rule uses", () => {
    // Same values, custom preferences: a country at 23°C is central under the
    // default band and at the very edge of a 10–23 one.
    const c = country("x", IDEAL);
    const narrow = comfortMargin(c, 0, { ...DEFAULT_PREFERENCES, dayMin: 10, dayMax: 23 });
    expect(narrow).toBeLessThan(comfortMargin(c, 0));
  });
});

describe("topCountriesForMonth", () => {
  it("ranks by score, best first, and numbers the rows", async () => {
    publish("good", "perfect", "bad");
    getCountry.mockImplementation(async (slug) => {
      if (slug === "perfect") return country("perfect", IDEAL);
      if (slug === "good")
        return country("good", { tMax: 26, tMin: 17, rDay: 1.35, s: 5.2 });
      return country("bad", { tMax: 45, tMin: 33, rDay: 11, s: 0.5 });
    });

    const ranked = await topCountriesForMonth("april");

    expect(ranked.map((c) => c.slug)).toEqual(["perfect", "good", "bad"]);
    expect(ranked.map((c) => c.rank)).toEqual([1, 2, 3]);
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  it("breaks ties on comfort, not on the alphabet", async () => {
    // The scoring rule has four buckets, so ties are the normal case. Both of
    // these score 90; `zulu-central` sits in the middle of the ranges and
    // `alpha-edge` clings to their edges, and the alphabet says otherwise.
    publish("alpha-edge", "zulu-central");
    getCountry.mockImplementation(async (slug) =>
      slug === "alpha-edge" ? country("alpha-edge", EDGE) : country("zulu-central", IDEAL),
    );

    const ranked = await topCountriesForMonth("april");

    expect(ranked[0]!.score).toBe(ranked[1]!.score);
    expect(ranked.map((c) => c.slug)).toEqual(["zulu-central", "alpha-edge"]);
  });

  it("falls back to the slug when score and comfort are identical", async () => {
    publish("bravo", "alpha");
    getCountry.mockImplementation(async (slug) => country(slug, IDEAL));

    const ranked = await topCountriesForMonth("april");

    expect(ranked.map((c) => c.slug)).toEqual(["alpha", "bravo"]);
  });

  it("is deterministic — the same data yields the same page", async () => {
    publish("a", "b", "c", "d");
    getCountry.mockImplementation(async (slug) => country(slug, IDEAL));

    const first = await topCountriesForMonth("july");
    const second = await topCountriesForMonth("july");

    expect(first).toEqual(second);
  });

  it("caps the list at the requested size", async () => {
    publish(...Array.from({ length: 40 }, (_, i) => `country-${String(i).padStart(2, "0")}`));
    getCountry.mockImplementation(async (slug) => country(slug, IDEAL));

    expect(await topCountriesForMonth("may")).toHaveLength(TOP_N);
    expect(await topCountriesForMonth("may", 5)).toHaveLength(5);
  });

  it("drops a country whose payload is missing rather than blanking the page", async () => {
    publish("here", "gone", "broken");
    getCountry.mockImplementation(async (slug) => {
      if (slug === "gone") return null;
      if (slug === "broken") throw new Error("500 from the API");
      return country("here", IDEAL);
    });

    const ranked = await topCountriesForMonth("april");

    expect(ranked.map((c) => c.slug)).toEqual(["here"]);
  });

  it("carries the month's own figures for display", async () => {
    publish("one");
    getCountry.mockResolvedValue(
      country("one", { tMax: 26, tMin: 17, rDay: 2, s: 8 }),
    );

    const [top] = await topCountriesForMonth("april");

    // The figure a card prints is the daytime high.
    expect(top!.temp).toBe(26);
    expect(top!.rain).toBe(60); // rDay × 30 in the fixture
    expect(top!.sun).toBe(8);
    expect(top!.region).toBe("Test Region");
  });

  it("raises rather than caching an empty ranking for a month", async () => {
    // An unreachable API yields an empty index (`routableCountries` swallows
    // connection failures by design). At request time that must not render a
    // month page listing nothing, which `revalidate` would then hold for 30
    // days — the build path never gets here, because generateStaticParams
    // emits no months in that state.
    publish();

    await expect(topCountriesForMonth("april")).rejects.toBeInstanceOf(
      NoPublishedCountriesError,
    );
  });

  it("bounds how many payloads it asks for at once", async () => {
    publish(...Array.from({ length: 30 }, (_, i) => `c${i}`));
    let inFlight = 0;
    let peak = 0;
    getCountry.mockImplementation(async (slug) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return country(slug, IDEAL);
    });

    await topCountriesForMonth("april");

    expect(peak).toBeLessThanOrEqual(8);
    expect(getCountry).toHaveBeenCalledTimes(30);
  });
});

describe("monthLandingHref", () => {
  it("builds the twelve URLs the sitemap and the pagers share", () => {
    expect(monthLandingHref("april")).toBe("/best-weather-in/april");
    expect(MONTH_SLUGS.map(monthLandingHref)).toHaveLength(12);
  });
});
