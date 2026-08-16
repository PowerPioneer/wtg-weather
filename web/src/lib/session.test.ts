/**
 * The server half of the session contract: cookie in, `SessionUser` out.
 *
 * RC-6: the mock session defaulted to the *premium* persona, and
 * `USE_MOCK_DATA` defaulted on, so a production build served every anonymous
 * visitor the paid tier — premium tile URLs, premium display modes, no upgrade
 * prompt. Both defaults have flipped; these pin them, because the failure is
 * silent from the inside (the site looks fine, it is just being given away).
 *
 * The parse/entitlement rules themselves are pinned in `session-user.test.ts`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const cookieStore = { value: new Map<string, string>() };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.value.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

afterEach(() => {
  cookieStore.value.clear();
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function load() {
  return import("./session");
}

function meResponse(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("getSessionServer under mocks", () => {
  it("resolves an anonymous visitor to no session, not to the premium persona", async () => {
    vi.stubEnv("WTG_USE_MOCK_DATA", "1");
    const { getSessionServer, getEntitlement } = await load();

    const session = await getSessionServer();
    expect(session).toBeNull();
    expect(getEntitlement(session)).toEqual({ premium: false, agency: false });
  });

  it("still switches persona when the preview cookie asks for one", async () => {
    vi.stubEnv("WTG_USE_MOCK_DATA", "1");
    cookieStore.value.set("wtg_mock_session", "premium");
    const { getSessionServer, getEntitlement } = await load();

    const session = await getSessionServer();
    expect(session?.plan).toBe("consumer_premium");
    expect(getEntitlement(session).premium).toBe(true);
  });
});

describe("getSessionServer against the API", () => {
  it("returns null without a session cookie and never calls the API", async () => {
    vi.stubEnv("WTG_USE_MOCK_DATA", "0");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { getSessionServer } = await load();

    expect(await getSessionServer()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a rejected session as signed out", async () => {
    vi.stubEnv("WTG_USE_MOCK_DATA", "0");
    cookieStore.value.set("wtg_session", "stale-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 401 })),
    );
    const { getSessionServer, getEntitlement } = await load();

    const session = await getSessionServer();
    expect(session).toBeNull();
    expect(getEntitlement(session).premium).toBe(false);
  });

  it("maps the API payload into the web's shape", async () => {
    vi.stubEnv("WTG_USE_MOCK_DATA", "0");
    cookieStore.value.set("wtg_session", "good-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        meResponse({
          id: "5f2b",
          email: "lea@example.com",
          name: null,
          plan: "consumer_premium",
          organization_id: "org-1",
          is_premium: true,
          is_agency: false,
          role: "owner",
          created_at: "2024-09-14T17:40:00Z",
          organization: {
            id: "org-1",
            name: "Léa Marchetti",
            plan: "consumer_premium",
            seat_cap: 1,
            seats_used: 1,
            created_at: "2024-09-14T17:40:00Z",
            is_personal: true,
          },
        }),
      ),
    );
    const { getSessionServer, getEntitlement } = await load();

    const session = await getSessionServer();
    expect(session).toEqual({
      id: "5f2b",
      email: "lea@example.com",
      name: null,
      plan: "consumer_premium",
      role: "owner",
      createdAt: "2024-09-14T17:40:00Z",
      org: {
        id: "org-1",
        name: "Léa Marchetti",
        plan: "consumer_premium",
        seatCap: 1,
        seatsUsed: 1,
        createdAt: "2024-09-14T17:40:00Z",
        // A consumer's subscription hangs off a single-seat organization of
        // their own. It is a wallet, not a workspace — `isAgencyWorkspace`
        // reads this so `/account` does not offer them a team page.
        isPersonal: true,
      },
    });
    expect(getEntitlement(session)).toEqual({
      premium: true,
      agency: false,
      seatCap: 1,
    });
  });

  it("treats a 200 that is not a session as signed out", async () => {
    // A proxy or a mis-routed path can answer 200 with something that is not a
    // user. Casting it would have produced a `SessionUser` with no plan.
    vi.stubEnv("WTG_USE_MOCK_DATA", "0");
    cookieStore.value.set("wtg_session", "good-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => meResponse({ detail: "Not Found" })),
    );
    const { getSessionServer } = await load();

    expect(await getSessionServer()).toBeNull();
  });
});
