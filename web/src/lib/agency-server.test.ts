/**
 * The agency read path.
 *
 * The failure this file has always pinned is a reachability bug, not a
 * rendering one: `/account/clients/[id]` resolved its client from the *URL*
 * through `findClientRecord`, with no `WTG_USE_MOCK_DATA` check and no org
 * scoping, so a fixture client's name, email, phone and notes were served to
 * any agency-entitled user in production.
 *
 * WS-C put the reads on `/api/orgs/*`, which changes what "scoped" means but
 * not the assertion: the caller's org and the caller's session decide, never
 * the id in the URL. The fixture is gone entirely, so the first group now pins
 * that no agency fixture resolves *with the flag on either* — there is nothing
 * left for a guessed id to reach.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The fixture ids that used to resolve, kept so a pass cannot be a typo. */
const FIXTURE_CLIENT_ID = "cli_westfield_8421";
const FIXTURE_ORG_ID = "org_cordillera";

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const CLIENT_ID = "22222222-2222-2222-2222-222222222222";

const cookieStore = { value: new Map<string, string>() };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.value.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

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

async function load(flag?: string) {
  vi.resetModules();
  vi.stubEnv("WTG_USE_MOCK_DATA", flag ?? "");
  return import("./agency-server");
}

type Bodies = {
  org?: unknown;
  memberships?: unknown;
  invites?: unknown;
  clients?: unknown;
  client?: unknown;
  trips?: unknown;
  notes?: unknown;
  status?: number;
};

/** Route each `/api/orgs/*` path to a canned body, recording the calls. */
function stubApi(bodies: Bodies) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const mock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (bodies.status && bodies.status !== 200) {
      return new Response("{}", { status: bodies.status });
    }
    if (url.endsWith("/notes")) return Response.json(bodies.notes ?? []);
    if (url.endsWith("/trips")) return Response.json(bodies.trips ?? []);
    if (url.endsWith("/memberships")) return Response.json(bodies.memberships ?? []);
    if (url.endsWith("/invites")) return Response.json(bodies.invites ?? []);
    if (/\/clients\/[^/]+$/.test(url)) {
      return bodies.client === undefined
        ? new Response("{}", { status: 404 })
        : Response.json(bodies.client);
    }
    if (url.endsWith("/clients")) return Response.json(bodies.clients ?? []);
    return Response.json(
      bodies.org ?? {
        id: ORG_ID,
        name: "Cordillera",
        plan: "agency_starter",
        seat_cap: 3,
        seats_used: 1,
        seats_pending: 0,
      },
    );
  });
  vi.stubGlobal("fetch", mock);
  return calls;
}

describe("the agency fixtures are gone", () => {
  it.each([undefined, "1", "0", "true"])(
    "resolves no client record with WTG_USE_MOCK_DATA=%o",
    async (flag) => {
      stubApi({});
      const { getClientRecord } = await load(flag);
      for (const id of [FIXTURE_CLIENT_ID, "cli_hartwell", "cli_okafor"]) {
        await expect(getClientRecord(FIXTURE_ORG_ID, id)).resolves.toBeNull();
      }
    },
  );

  it("gives the fixture org an empty dashboard under the flag, not the fixture's", async () => {
    const { getAgencyAccount } = await load("1");
    const account = await getAgencyAccount(FIXTURE_ORG_ID);
    expect(account).toEqual({
      team: [],
      invites: [],
      clients: [],
      seatsUsed: 0,
      seatsPending: 0,
      seatCap: 0,
    });
  });

  it("never calls the API under the flag, so API-less dev still boots", async () => {
    const calls = stubApi({});
    const { getAgencyAccount, getClientRecord } = await load("1");
    await getAgencyAccount(ORG_ID);
    await getClientRecord(ORG_ID, CLIENT_ID);
    expect(calls).toHaveLength(0);
  });
});

describe("getAgencyAccount", () => {
  it("forwards the session cookie and reads under the caller's org", async () => {
    const calls = stubApi({});
    const { getAgencyAccount } = await load();

    await getAgencyAccount(ORG_ID);

    expect(calls.map((c) => c.url).sort()).toEqual([
      `http://api:8000/api/orgs/${ORG_ID}`,
      `http://api:8000/api/orgs/${ORG_ID}/clients`,
      `http://api:8000/api/orgs/${ORG_ID}/invites`,
      `http://api:8000/api/orgs/${ORG_ID}/memberships`,
    ]);
    for (const call of calls) {
      const headers = call.init.headers as Record<string, string>;
      expect(headers.cookie).toBe("wtg_session=a-valid-token");
      // Per-org data. A cache here would serve one agency's team to the next.
      expect(call.init.cache).toBe("no-store");
    }
  });

  it("returns null without a session, and never calls the API", async () => {
    cookieStore.value.clear();
    const calls = stubApi({});
    const { getAgencyAccount } = await load();
    expect(await getAgencyAccount(ORG_ID)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it.each([401, 403, 404])(
    "returns null on %i rather than an empty organisation",
    async (status) => {
      stubApi({ status });
      const { getAgencyAccount } = await load();
      expect(await getAgencyAccount(ORG_ID)).toBeNull();
    },
  );

  it("maps members, invitations and seats", async () => {
    stubApi({
      org: {
        id: ORG_ID,
        name: "Cordillera",
        plan: "agency_starter",
        seat_cap: 3,
        seats_used: 2,
        seats_pending: 1,
      },
      memberships: [
        {
          id: "m1",
          user_id: "u1",
          role: "owner",
          email: "ada@example.com",
          name: "Ada",
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "m2",
          user_id: "u2",
          role: "agent",
          email: "bo@example.com",
          name: null,
          created_at: "2026-02-01T00:00:00Z",
        },
      ],
      invites: [
        {
          id: "i1",
          email: "new@example.com",
          role: "agent",
          expires_at: "2026-09-01T00:00:00Z",
          created_at: "2026-08-16T00:00:00Z",
        },
      ],
      clients: [
        {
          id: CLIENT_ID,
          name: "Westfield",
          email: null,
          notes: null,
          trip_count: 3,
          created_at: "2026-03-01T00:00:00Z",
        },
      ],
    });
    const { getAgencyAccount } = await load();

    const account = await getAgencyAccount(ORG_ID, "u2");
    expect(account).not.toBeNull();
    expect(account!.seatsUsed).toBe(2);
    expect(account!.seatsPending).toBe(1);
    expect(account!.seatCap).toBe(3);
    // "Which of these is you" is answered from the caller's session, because
    // the API cannot know who is asking about whom.
    expect(account!.team.map((m) => m.you)).toEqual([false, true]);
    expect(account!.team[1]!.name).toBeNull();
    expect(account!.invites[0]!.email).toBe("new@example.com");
    expect(account!.clients[0]!.trips).toBe(3);
  });

  it("falls back to a safe role for a value it does not recognise", async () => {
    stubApi({
      memberships: [
        {
          id: "m1",
          user_id: "u1",
          role: "superuser",
          email: "x@example.com",
          name: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    const { getAgencyAccount } = await load();
    const account = await getAgencyAccount(ORG_ID);
    // Same rule as the plan vocabulary: an unknown value resolves to the least
    // privileged reading, never the most.
    expect(account!.team[0]!.role).toBe("member");
  });
});

describe("getClientRecord", () => {
  const CLIENT = {
    id: CLIENT_ID,
    name: "Westfield",
    email: "them@example.com",
    notes: "Prefers shoulder season",
    trip_count: 1,
    created_at: "2026-03-01T00:00:00Z",
  };

  it("asks under the caller's org, not by id alone", async () => {
    const calls = stubApi({ client: CLIENT });
    const { getClientRecord } = await load();

    await getClientRecord(ORG_ID, CLIENT_ID);

    // The org is in every path. The fixture version took only an id, which is
    // exactly how the id became the grant.
    for (const call of calls) {
      expect(call.url).toContain(`/api/orgs/${ORG_ID}/clients/${CLIENT_ID}`);
    }
    expect(calls).toHaveLength(3); // client, trips, notes
  });

  it("returns null when the API says 404 — another agency's client", async () => {
    stubApi({ status: 404 });
    const { getClientRecord } = await load();
    expect(await getClientRecord(ORG_ID, CLIENT_ID)).toBeNull();
  });

  it("returns null without a session", async () => {
    cookieStore.value.clear();
    stubApi({ client: CLIENT });
    const { getClientRecord } = await load();
    expect(await getClientRecord(ORG_ID, CLIENT_ID)).toBeNull();
  });

  it("maps trips and notes, and never exposes a share token", async () => {
    stubApi({
      client: CLIENT,
      trips: [
        {
          id: "t1",
          title: "Peru in April",
          country_iso2: "PE",
          month: 4,
          owner_name: "Ada",
          owner_email: "ada@example.com",
          shared: true,
          updated_at: "2026-04-01T00:00:00Z",
        },
        {
          id: "t2",
          title: "Somewhere",
          country_iso2: null,
          month: null,
          owner_name: null,
          owner_email: "bo@example.com",
          shared: false,
          updated_at: "2026-04-02T00:00:00Z",
        },
      ],
      notes: [
        {
          id: "n1",
          body: "Called them",
          author_name: null,
          author_email: "ada@example.com",
          created_at: "2026-04-03T00:00:00Z",
        },
      ],
    });
    const { getClientRecord } = await load();

    const record = await getClientRecord(ORG_ID, CLIENT_ID);
    expect(record).not.toBeNull();
    expect(record!.profileNotes).toBe("Prefers shoulder season");
    expect(record!.trips[0]).toMatchObject({
      countryName: "Peru",
      countrySlug: "peru",
      monthName: "April",
      agent: "Ada",
      shared: true,
    });
    // No month, no country, no name: nulls, not invented values — and the
    // author falls back to an address rather than to nothing.
    expect(record!.trips[1]).toMatchObject({
      countryName: null,
      monthName: null,
      agent: "bo@example.com",
    });
    expect(JSON.stringify(record)).not.toContain("share_token");
    expect(record!.notes[0]!.author).toBe("ada@example.com");
  });

  it("renders a client whose trips or notes could not be read", async () => {
    // The record itself is the page; a failure on one of its lists should not
    // 404 the client.
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/trips") || url.endsWith("/notes")) {
        return new Response("{}", { status: 404 });
      }
      return Response.json(CLIENT);
    });
    vi.stubGlobal("fetch", mock);
    const { getClientRecord } = await load();

    const record = await getClientRecord(ORG_ID, CLIENT_ID);
    expect(record!.trips).toEqual([]);
    expect(record!.notes).toEqual([]);
  });
});
