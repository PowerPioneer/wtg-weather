/**
 * The trip read path.
 *
 * What shipped: `/trip/[id]` called `findTripData(id)`, which knew exactly one
 * trip — a honeymoon in Peru belonging to a fixture user. Every real trip
 * 404'd, and that one was readable by anyone, signed in or not, because the
 * only thing separating the owner view from the public one was a `?view=public`
 * query parameter the visitor controlled.
 *
 * So the two things pinned hardest here are: the owner read forwards the
 * session cookie, and the shared read does not need one but also cannot be
 * turned back into an owner-scoped request.
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
  vi.unstubAllGlobals();
});

async function load() {
  return import("./trip-server");
}

function flat(value: number): Monthly {
  return Array.from({ length: 12 }, () => value) as unknown as Monthly;
}

/**
 * Peru with three regions: two comfortable under the default preferences, one
 * that is not. Enough to check ranking, the cut, and the tie-break.
 */
const PERU: CountryData = {
  slug: "peru",
  name: "Peru",
  iso2: "PE",
  region: "South America",
  summary: "",
  bestMonths: [],
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
    { name: "Puno", slug: "puno", code: "PER-3", score: 40, tl: flat(-15), rl: flat(9), sl: flat(1) },
    { name: "Cusco", slug: "cusco", code: "PER-1", score: 90, tl: flat(22), rl: flat(1), sl: flat(8) },
    { name: "Arequipa", slug: "arequipa", code: "PER-2", score: 88, tl: flat(22), rl: flat(1), sl: flat(8) },
  ],
  related: [],
  monthNotes: {},
};

const OWNER_TRIP = {
  id: "trip-1",
  title: "Peru in April",
  country_iso2: "PE",
  region_code: null,
  month: 4,
  preferences: { dayMin: 22, dayMax: 30, nightMin: 12, nightMax: 22, rainMax: 2.7, sunMin: 6 },
  client_id: null,
  share_token: null,
};

/** `TripPublicRead` — narrower on purpose. */
const SHARED_TRIP = {
  title: "Peru in April",
  country_iso2: "PE",
  region_code: null,
  month: 4,
  preferences: { dayMin: 22, dayMax: 30, nightMin: 12, nightMax: 22, rainMax: 2.7, sunMin: 6 },
};

function stubFetch(body: unknown, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      calls.push({ url: String(input), init });
      return status === 200
        ? Response.json(body)
        : new Response("{}", { status });
    }),
  );
  return calls;
}

describe("getOwnTrip", () => {
  it("asks the owner-scoped route with the caller's cookie", async () => {
    getCountry.mockResolvedValue(PERU);
    const calls = stubFetch(OWNER_TRIP);
    const { getOwnTrip } = await load();

    await getOwnTrip("trip-1");

    expect(calls[0]!.url).toBe("http://api:8000/api/trips/trip-1");
    expect((calls[0]!.init.headers as Record<string, string>).cookie).toBe(
      "wtg_session=a-valid-token",
    );
    expect(calls[0]!.init.cache).toBe("no-store");
  });

  it("returns null without a session and never calls the API", async () => {
    cookieStore.value.clear();
    const calls = stubFetch(OWNER_TRIP);
    const { getOwnTrip } = await load();

    expect(await getOwnTrip("trip-1")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("returns null for someone else's trip", async () => {
    // The API answers 404 rather than 403 — a trip you do not own should be
    // indistinguishable from one that does not exist.
    stubFetch({}, 404);
    const { getOwnTrip } = await load();
    expect(await getOwnTrip("someone-elses")).toBeNull();
  });

  it("escapes the id it interpolates", async () => {
    const calls = stubFetch({}, 404);
    const { getOwnTrip } = await load();
    await getOwnTrip("../me");
    expect(calls[0]!.url).toBe("http://api:8000/api/trips/..%2Fme");
  });

  it("ranks the country's regions for the trip's month and preferences", async () => {
    getCountry.mockResolvedValue(PERU);
    stubFetch(OWNER_TRIP);
    const { getOwnTrip } = await load();

    const trip = await getOwnTrip("trip-1");

    expect(trip!.countryName).toBe("Peru");
    expect(trip!.monthName).toBe("April");
    // Cusco and Arequipa tie on score, so the name breaks it and the order is
    // the same on every render. Puno is last, not omitted.
    expect(trip!.destinations.map((d) => d.name)).toEqual([
      "Arequipa",
      "Cusco",
      "Puno",
    ]);
    expect(trip!.destinations[0]).toMatchObject({
      rank: 1,
      href: "/peru/arequipa",
      temp: "22 °C",
      rain: "1 mm/day",
      sun: "8 hr/day",
    });
    expect(trip!.destinations[2]!.score).toBeLessThan(trip!.destinations[0]!.score);
  });

  it("carries the share token so the owner can see their own link", async () => {
    getCountry.mockResolvedValue(PERU);
    stubFetch({ ...OWNER_TRIP, share_token: "abc123" });
    const { getOwnTrip } = await load();
    expect((await getOwnTrip("trip-1"))!.shareToken).toBe("abc123");
  });

  it("scores a region trip on that region, not on the country", async () => {
    getCountry.mockResolvedValue(PERU);
    stubFetch({ ...OWNER_TRIP, region_code: "PER-3" });
    const { getOwnTrip } = await load();

    const trip = await getOwnTrip("trip-1");
    expect(trip!.regionName).toBe("Puno");
    // Puno is the freezing one; the national figure is comfortable.
    expect(trip!.score).toBeLessThan(50);
  });

  it("renders a trip whose country is not published, minus the ranking", async () => {
    getCountry.mockResolvedValue(null);
    stubFetch(OWNER_TRIP);
    const { getOwnTrip } = await load();

    const trip = await getOwnTrip("trip-1");
    expect(trip!.title).toBe("Peru in April");
    expect(trip!.countrySlug).toBeNull();
    expect(trip!.score).toBeNull();
    expect(trip!.destinations).toEqual([]);
  });

  it("falls back to default preferences for a trip saved without any", async () => {
    getCountry.mockResolvedValue(PERU);
    stubFetch({ ...OWNER_TRIP, preferences: {} });
    const { getOwnTrip } = await load();

    const trip = await getOwnTrip("trip-1");
    expect(trip!.usesDefaultPreferences).toBe(true);
    expect(trip!.preferences).toEqual({
      safetyMax: 3,
      dayMin: 22,
      dayMax: 30,
      nightMin: 12,
      nightMax: 22,
      rainMax: 2.7,
      sunMin: 6,
    });
  });
});

describe("getSharedTrip", () => {
  it("reads by token, with no session at all", async () => {
    cookieStore.value.clear();
    getCountry.mockResolvedValue(PERU);
    const calls = stubFetch(SHARED_TRIP);
    const { getSharedTrip } = await load();

    const trip = await getSharedTrip("tok_abc");

    expect(calls[0]!.url).toBe("http://api:8000/api/trips/shared/tok_abc");
    expect(calls[0]!.init.headers).not.toHaveProperty("cookie");
    expect(trip!.title).toBe("Peru in April");
    expect(trip!.destinations).toHaveLength(3);
  });

  it("exposes no trip id, so the share view cannot become an owner request", async () => {
    getCountry.mockResolvedValue(PERU);
    stubFetch(SHARED_TRIP);
    const { getSharedTrip } = await load();
    expect((await getSharedTrip("tok_abc"))!.id).toBeNull();
  });

  it("treats a revoked token the same as one that never existed", async () => {
    stubFetch({}, 404);
    const { getSharedTrip } = await load();
    expect(await getSharedTrip("revoked")).toBeNull();
  });
});

describe("describeTrip", () => {
  it("summarises without inventing a place or a month", async () => {
    getCountry.mockResolvedValue(PERU);
    stubFetch({ ...OWNER_TRIP, country_iso2: null, month: null });
    const { describeTrip, getOwnTrip } = await load();

    const trip = await getOwnTrip("trip-1");
    expect(describeTrip(trip!)).toBe("Climate-matched trip.");
  });
});
