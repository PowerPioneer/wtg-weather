/**
 * Contract tests for the account resources — trips, favourites, alerts.
 *
 * These assert the *wire*: method, path, and the snake_case field names the
 * FastAPI schemas in `api/src/wtg_api/schemas/__init__.py` actually declare.
 * That is the RC-6 lesson in test form. A path or field rename on either side
 * is a silent failure otherwise: a `country_iso2` that arrives while the UI
 * reads `countryIso2` renders as blank, forever, and no type checks it because
 * both sides typecheck fine on their own.
 *
 * Keep the fixtures below copied from the schema, not from the UI's wishes.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function load() {
  return import("./api-client");
}

type Call = { url: string; init: RequestInit };

/** A `fetch` stub that records every call and answers with a queue of responses. */
function stubFetch(responses: Array<{ body?: unknown; status?: number }>) {
  const calls: Call[] = [];
  let i = 0;
  const mock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    const next = responses[Math.min(i++, responses.length - 1)] ?? {};
    const status = next.status ?? 200;
    if (status === 204) return new Response(null, { status });
    return new Response(JSON.stringify(next.body ?? {}), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", mock);
  return calls;
}

function body(call: Call): unknown {
  return JSON.parse(String(call.init.body));
}

/** `TripRead`, verbatim. */
const TRIP_READ = {
  id: "1f0c8a54-0000-4000-8000-000000000001",
  title: "Peru in April",
  country_iso2: "PE",
  region_code: "PE-CUS",
  month: 4,
  preferences: { tempMin: 14, tempMax: 22, rainMax: 2, sunMin: 6 },
  client_id: null,
  // Owner-only, and null until the trip is shared.
  share_token: null,
};

/** `FavouriteRead`, verbatim. */
const FAVOURITE_READ = {
  id: "1f0c8a54-0000-4000-8000-000000000002",
  country_iso2: "PT",
  region_code: null,
};

/** `AlertRead`, verbatim. */
const ALERT_READ = {
  id: "1f0c8a54-0000-4000-8000-000000000003",
  country_iso2: "PT",
  region_code: null,
  month: 4,
  preferences: { tempMin: 18, tempMax: 28, rainMax: 2.7, sunMin: 6 },
  active: true,
};

describe("trips", () => {
  it("lists from GET /api/trips and maps every field", async () => {
    const calls = stubFetch([{ body: [TRIP_READ] }]);
    const { listTrips } = await load();

    expect(await listTrips()).toEqual([
      {
        id: TRIP_READ.id,
        title: "Peru in April",
        countryIso2: "PE",
        regionCode: "PE-CUS",
        month: 4,
        preferences: TRIP_READ.preferences,
        clientId: null,
      },
    ]);
    expect(calls[0]!.url).toBe("/api/trips");
    expect(calls[0]!.init.credentials).toBe("same-origin");
  });

  it("creates with the schema's snake_case field names", async () => {
    const calls = stubFetch([{ body: TRIP_READ, status: 201 }]);
    const { createTrip } = await load();

    await createTrip({
      title: "Peru in April",
      countryIso2: "PE",
      regionCode: "PE-CUS",
      month: 4,
      preferences: { tempMin: 14 },
    });

    expect(calls[0]!.url).toBe("/api/trips");
    expect(calls[0]!.init.method).toBe("POST");
    expect(body(calls[0]!)).toEqual({
      title: "Peru in April",
      country_iso2: "PE",
      region_code: "PE-CUS",
      month: 4,
      preferences: { tempMin: 14 },
    });
  });

  it("sends only the fields a patch actually names", async () => {
    // `TripUpdate` uses `exclude_unset`, so an absent key means "leave it".
    // Sending `country_iso2: null` for an untouched field would blank it.
    const calls = stubFetch([{ body: TRIP_READ }]);
    const { updateTrip } = await load();

    await updateTrip(TRIP_READ.id, { title: "Renamed" });

    expect(calls[0]!.init.method).toBe("PATCH");
    expect(body(calls[0]!)).toEqual({ title: "Renamed" });
  });

  it("deletes and tolerates the 204 empty body", async () => {
    const calls = stubFetch([{ status: 204 }]);
    const { deleteTrip } = await load();

    await expect(deleteTrip(TRIP_READ.id)).resolves.toBeUndefined();
    expect(calls[0]!.init.method).toBe("DELETE");
  });

  it("escapes an id it interpolates", async () => {
    const calls = stubFetch([{ body: TRIP_READ }]);
    const { getTrip } = await load();

    await getTrip("../me");
    expect(calls[0]!.url).toBe("/api/trips/..%2Fme");
  });
});

describe("favourites", () => {
  it("creates with a null region for a whole country", async () => {
    const calls = stubFetch([{ body: FAVOURITE_READ, status: 201 }]);
    const { createFavourite } = await load();

    expect(await createFavourite({ countryIso2: "PT" })).toEqual({
      id: FAVOURITE_READ.id,
      countryIso2: "PT",
      regionCode: null,
    });
    expect(body(calls[0]!)).toEqual({ country_iso2: "PT", region_code: null });
  });

  it("deletes by id", async () => {
    const calls = stubFetch([{ status: 204 }]);
    const { deleteFavourite } = await load();

    await deleteFavourite(FAVOURITE_READ.id);
    expect(calls[0]!.url).toBe(`/api/favourites/${FAVOURITE_READ.id}`);
    expect(calls[0]!.init.method).toBe("DELETE");
  });
});

describe("alerts", () => {
  it("lists and maps `active`", async () => {
    stubFetch([{ body: [ALERT_READ, { ...ALERT_READ, id: "b", active: false }] }]);
    const { listAlerts } = await load();

    const alerts = await listAlerts();
    expect(alerts.map((a) => a.active)).toEqual([true, false]);
    expect(alerts[0]!.month).toBe(4);
  });

  it("defaults the whole-world alert's optional fields to null, not undefined", async () => {
    // `AlertCreate` has defaults for all four, but sending `undefined` inside
    // JSON.stringify drops the key entirely — which is fine here and would not
    // be if a default ever changed. Be explicit.
    const calls = stubFetch([{ body: ALERT_READ, status: 201 }]);
    const { createAlert } = await load();

    await createAlert({ countryIso2: "PT", month: 4 });
    expect(body(calls[0]!)).toEqual({
      country_iso2: "PT",
      region_code: null,
      month: 4,
      preferences: {},
    });
  });

  it("pauses via PATCH rather than delete", async () => {
    const calls = stubFetch([{ body: { ...ALERT_READ, active: false } }]);
    const { setAlertActive } = await load();

    expect((await setAlertActive(ALERT_READ.id, false)).active).toBe(false);
    expect(calls[0]!.url).toBe(`/api/alerts/${ALERT_READ.id}`);
    expect(calls[0]!.init.method).toBe("PATCH");
    expect(body(calls[0]!)).toEqual({ active: false });
  });
});

/**
 * The fixtures above are hand-copied, which makes them exactly as trustworthy
 * as the person who copied them. These read the FastAPI source and fail if it
 * moved — the same trick `scoring.test.ts` plays on the pipeline's Python.
 */
describe("against the FastAPI source", () => {
  const apiSource = (relative: string) =>
    readFileSync(join(process.cwd(), "..", "api/src/wtg_api", relative), "utf8");

  const schemas = apiSource("schemas/__init__.py");
  const router = apiSource("routers/trips.py");

  /** Field names declared on a Pydantic model, in declaration order. */
  function fieldsOf(model: string): string[] {
    const start = schemas.indexOf(`class ${model}(`);
    expect(start, `${model} not found in schemas`).toBeGreaterThan(-1);
    const rest = schemas.slice(start);
    const end = rest.indexOf("\nclass ", 1);
    const body = end === -1 ? rest : rest.slice(0, end);
    return [...body.matchAll(/^ {4}(\w+):/gm)].map((m) => m[1]!);
  }

  /** `METHOD path` for every route the router mounts, minus the `/api` prefix. */
  function routes(): string[] {
    return [...router.matchAll(/@router\.(get|post|patch|delete)\(\s*"([^"]+)"/g)].map(
      (m) => `${m[1]!.toUpperCase()} ${m[2]!}`,
    );
  }

  it("mounts every route the client calls", () => {
    expect(routes()).toEqual(
      expect.arrayContaining([
        "GET /trips",
        "POST /trips",
        "GET /trips/{trip_id}",
        "PATCH /trips/{trip_id}",
        "DELETE /trips/{trip_id}",
        "GET /favourites",
        "POST /favourites",
        "DELETE /favourites/{fav_id}",
        "GET /alerts",
        "POST /alerts",
        "PATCH /alerts/{alert_id}",
        "DELETE /alerts/{alert_id}",
      ]),
    );
  });

  it.each([
    ["TripRead", TRIP_READ],
    ["FavouriteRead", FAVOURITE_READ],
    ["AlertRead", ALERT_READ],
  ])("%s fixture matches the schema field for field", (model, fixture) => {
    expect(fieldsOf(model).sort()).toEqual(Object.keys(fixture).sort());
  });

  it("sends nothing a create schema would reject", () => {
    // Extra keys are not an error to Pydantic by default — they are silently
    // dropped, which is how a rename becomes a field that stops being saved
    // without anything failing.
    const tripCreate = fieldsOf("TripCreate");
    expect(tripCreate).toEqual(
      expect.arrayContaining([
        "title",
        "country_iso2",
        "region_code",
        "month",
        "preferences",
        "client_id",
      ]),
    );
    expect(fieldsOf("AlertCreate")).toEqual(
      expect.arrayContaining(["country_iso2", "region_code", "month", "preferences"]),
    );
    expect(fieldsOf("AlertUpdate")).toContain("active");
    expect(fieldsOf("FavouriteCreate")).toEqual(["country_iso2", "region_code"]);
  });
});

describe("errors", () => {
  it("raises a 401 the account surfaces can redirect on", async () => {
    stubFetch([{ status: 401, body: { detail: "not authenticated" } }]);
    const { listTrips, isUnauthorized, isNotFound } = await load();

    const error = await listTrips().catch((e: unknown) => e);
    expect(isUnauthorized(error)).toBe(true);
    expect(isNotFound(error)).toBe(false);
  });

  it("raises a 404 for a trip that is not the caller's", async () => {
    // The API answers "not found" rather than "forbidden" for another user's
    // trip, so the UI must not treat 404 as "this route is broken".
    stubFetch([{ status: 404, body: { detail: "trip not found" } }]);
    const { getTrip, isNotFound } = await load();

    const error = await getTrip("someone-elses").catch((e: unknown) => e);
    expect(isNotFound(error)).toBe(true);
    expect(String(error)).toContain("trip not found");
  });

  it("carries the status for anything else", async () => {
    stubFetch([{ status: 500, body: { detail: "boom" } }]);
    const { listFavourites, isUnauthorized } = await load();

    const error = await listFavourites().catch((e: unknown) => e);
    expect(isUnauthorized(error)).toBe(false);
    expect(String(error)).toContain("500");
  });
});
