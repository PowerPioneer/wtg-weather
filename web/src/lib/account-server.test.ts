/**
 * `/account`'s read path.
 *
 * The page used to resolve `findConsumerAccount(session.id)` against fixtures
 * keyed by `usr_sam` / `usr_lea`, so every real user fell through to the empty
 * account. These pin the two things that were wrong: the rows come from the
 * API, and the session cookie is forwarded so they are the *caller's* rows.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CountryData, Monthly } from "./types";

const cookieStore = { value: new Map<string, string>() };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.value.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

const getCountry = vi.fn();
vi.mock("./api-client", () => ({ getCountry }));

beforeEach(() => {
  cookieStore.value.set("wtg_session", "a-valid-token");
});

afterEach(() => {
  cookieStore.value.clear();
  vi.resetAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function load() {
  return import("./account-server");
}

function flat(value: number): Monthly {
  return Array.from({ length: 12 }, () => value) as unknown as Monthly;
}

/** Peru, trimmed to what the account assembler reads. */
const PERU: CountryData = {
  slug: "peru",
  name: "Peru",
  iso2: "PE",
  region: "South America",
  summary: "",
  bestMonths: [
    { month: "June", score: 94, note: "" },
    { month: "July", score: 92, note: "" },
    { month: "August", score: 89, note: "" },
  ],
  climate: {
    months: [],
    t: flat(22),
    tMin: flat(18),
    tMax: flat(26),
    r: flat(30),
    rDay: flat(1),
    s: flat(8),
  },
  regions: [
    // Two comfortable, one freezing — so "regions match" is a real count.
    { name: "Cusco", slug: "cusco", code: "PER-1", score: 90, tl: flat(22), rl: flat(1), sl: flat(8) },
    { name: "Arequipa", slug: "arequipa", code: "PER-2", score: 88, tl: flat(21), rl: flat(1), sl: flat(8) },
    { name: "Puno", slug: "puno", code: "PER-3", score: 40, tl: flat(-15), rl: flat(9), sl: flat(1) },
  ],
  related: [],
  monthNotes: {},
};

/** Route each `/api/*` collection to a canned body. */
function stubApi(bodies: {
  trips?: unknown;
  favourites?: unknown;
  alerts?: unknown;
  status?: number;
}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const mock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (bodies.status && bodies.status !== 200) {
      return new Response("{}", { status: bodies.status });
    }
    const key = url.includes("/trips")
      ? "trips"
      : url.includes("/favourites")
        ? "favourites"
        : "alerts";
    return Response.json(bodies[key] ?? []);
  });
  vi.stubGlobal("fetch", mock);
  return calls;
}

describe("getConsumerAccount", () => {
  it("forwards the session cookie so the rows are the caller's", async () => {
    const calls = stubApi({});
    const { getConsumerAccount } = await load();

    await getConsumerAccount();

    expect(calls.map((c) => c.url).sort()).toEqual([
      "http://api:8000/api/alerts",
      "http://api:8000/api/favourites",
      "http://api:8000/api/trips",
    ]);
    for (const call of calls) {
      const headers = call.init.headers as Record<string, string>;
      expect(headers.cookie).toBe("wtg_session=a-valid-token");
      // Per-user data: caching it would serve one user's trips to the next.
      expect(call.init.cache).toBe("no-store");
    }
  });

  it("returns null without a session cookie, and never calls the API", async () => {
    cookieStore.value.clear();
    const calls = stubApi({});
    const { getConsumerAccount } = await load();

    expect(await getConsumerAccount()).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("returns null on 401 so the page can redirect to sign-in", async () => {
    stubApi({ status: 401 });
    const { getConsumerAccount } = await load();
    expect(await getConsumerAccount()).toBeNull();
  });

  it("throws on 500 rather than rendering an empty account", async () => {
    // Someone with three trips seeing "No saved trips yet" is worse than an
    // error page: it looks like their data is gone.
    stubApi({ status: 500 });
    const { getConsumerAccount } = await load();
    await expect(getConsumerAccount()).rejects.toThrow(/failed: 500/);
  });

  it("scores a trip for its own month under its own saved preferences", async () => {
    getCountry.mockResolvedValue(PERU);
    stubApi({
      trips: [
        {
          id: "t1",
          title: "Honeymoon",
          country_iso2: "PE",
          region_code: null,
          month: 4,
          preferences: { tempMin: 18, tempMax: 28, rainMax: 2.7, sunMin: 6 },
        },
      ],
    });
    const { getConsumerAccount } = await load();

    const account = await getConsumerAccount();
    expect(account!.trips[0]).toEqual({
      id: "t1",
      title: "Honeymoon",
      countryName: "Peru",
      countrySlug: "peru",
      monthName: "April",
      monthSlug: "april",
      score: 90,
      matchingRegions: 2,
    });
  });

  it("says null, not zero, where it cannot score", async () => {
    // A whole-year trip has no month to score, and an unpublished country has
    // no series. Zero would be a claim about the weather.
    getCountry.mockResolvedValue(null);
    stubApi({
      trips: [
        { id: "t1", title: "Someday", country_iso2: null, region_code: null, month: null, preferences: {} },
        { id: "t2", title: "Nowhere", country_iso2: "PE", region_code: null, month: 4, preferences: {} },
      ],
    });
    const { getConsumerAccount } = await load();

    const trips = (await getConsumerAccount())!.trips;
    expect(trips[0]).toMatchObject({ score: null, matchingRegions: null, monthName: null });
    expect(trips[1]).toMatchObject({ score: null, matchingRegions: null, countryName: "Peru" });
  });

  it("resolves a favourited region to its own page", async () => {
    getCountry.mockResolvedValue(PERU);
    stubApi({
      favourites: [
        { id: "f1", country_iso2: "PE", region_code: "PER-1" },
        { id: "f2", country_iso2: "PE", region_code: null },
      ],
    });
    const { getConsumerAccount } = await load();

    const favourites = (await getConsumerAccount())!.favourites;
    expect(favourites[0]).toEqual({
      id: "f1",
      name: "Cusco",
      sub: "Peru",
      href: "/peru/cusco",
      best: "June · July",
    });
    expect(favourites[1]).toMatchObject({ name: "Peru", href: "/peru" });
  });

  it("still lists a favourite whose country the registry cannot resolve", async () => {
    stubApi({ favourites: [{ id: "f1", country_iso2: "XX", region_code: null }] });
    const { getConsumerAccount } = await load();

    // It is the user's row. It just has no page to link to.
    expect((await getConsumerAccount())!.favourites[0]).toMatchObject({
      name: "XX",
      href: null,
    });
  });

  it("describes an alert from its own fields", async () => {
    getCountry.mockResolvedValue(PERU);
    stubApi({
      alerts: [
        {
          id: "a1",
          country_iso2: "PE",
          region_code: "PER-1",
          month: 7,
          preferences: { tempMin: 14, tempMax: 22, rainMax: 2, sunMin: 6 },
          active: false,
        },
      ],
    });
    const { getConsumerAccount } = await load();

    expect((await getConsumerAccount())!.alerts[0]).toEqual({
      id: "a1",
      label: "Cusco in July",
      conditions:
        "14–22 °C · light rain or drier · over 6 h sun · advisories to reconsider travel",
      active: false,
    });
  });

  it("fetches each referenced country once, however many rows point at it", async () => {
    getCountry.mockResolvedValue(PERU);
    stubApi({
      trips: [
        { id: "t1", title: "A", country_iso2: "PE", region_code: null, month: 4, preferences: {} },
        { id: "t2", title: "B", country_iso2: "pe", region_code: null, month: 5, preferences: {} },
      ],
      favourites: [{ id: "f1", country_iso2: "PE", region_code: null }],
      alerts: [{ id: "a1", country_iso2: "PE", region_code: null, month: 7, preferences: {}, active: true }],
    });
    const { getConsumerAccount } = await load();

    await getConsumerAccount();
    expect(getCountry).toHaveBeenCalledTimes(1);
    expect(getCountry).toHaveBeenCalledWith("peru");
  });

  it("renders an empty account under the fixture flag rather than calling the API", async () => {
    vi.stubEnv("WTG_USE_MOCK_DATA", "1");
    const calls = stubApi({});
    const { getConsumerAccount, EMPTY_ACCOUNT } = await load();

    expect(await getConsumerAccount()).toEqual(EMPTY_ACCOUNT);
    expect(calls).toHaveLength(0);
  });
});
