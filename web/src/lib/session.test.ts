/**
 * Entitlement resolution for a visitor with no session.
 *
 * RC-6: the mock session defaulted to the *premium* persona, and
 * `USE_MOCK_DATA` defaulted on, so a production build served every anonymous
 * visitor the paid tier — premium tile URLs, premium display modes, no upgrade
 * prompt. Both defaults have flipped; these pin them, because the failure is
 * silent from the inside (the site looks fine, it is just being given away).
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
    expect(session?.plan).toBe("premium");
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
});

describe("getEntitlement", () => {
  it("maps plans onto the two gates", async () => {
    const { getEntitlement } = await load();
    const base = {
      id: "u",
      name: "n",
      email: "e",
      role: "consumer" as const,
      signedInAt: "",
      memberSince: "",
    };
    expect(getEntitlement({ ...base, plan: "free" })).toEqual({
      premium: false,
      agency: false,
      seatCap: undefined,
    });
    expect(getEntitlement({ ...base, plan: "premium" }).premium).toBe(true);
    expect(getEntitlement({ ...base, plan: "agency_pro" }).agency).toBe(true);
  });
});
