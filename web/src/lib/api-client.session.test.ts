/**
 * The session reads every page makes on mount.
 *
 * On `/map` three components asked `/api/me` and two hooks asked
 * `/api/onboarding` in the same millisecond, and a signed-out visitor got two
 * onboarding 401s on every view. Concurrent callers now share one request, and
 * the onboarding store is only asked once `/api/me` says somebody is signed in.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

const ME = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "a@example.com",
  name: null,
  plan: "free",
  organization_id: null,
  is_premium: false,
  is_agency: false,
};

function stubApi(signedIn: boolean) {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.endsWith("/api/me")) {
      return signedIn ? Response.json(ME) : new Response(null, { status: 401 });
    }
    if (url.endsWith("/api/onboarding")) {
      return Response.json({ kind: null, step: 0, completed: false, data: {} });
    }
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const calls = (path: string) =>
    fetchMock.mock.calls.filter(([input]) => String(input).endsWith(path)).length;
  return { calls };
}

describe("fetchMe", () => {
  it("sends one request for callers that ask at the same time", async () => {
    const { calls } = stubApi(true);
    const { fetchMe } = await import("./api-client");

    const results = await Promise.all([fetchMe(), fetchMe(), fetchMe()]);

    expect(calls("/api/me")).toBe(1);
    expect(results.every((me) => me?.email === "a@example.com")).toBe(true);
  });

  it("asks again once the earlier request has settled — nothing is cached", async () => {
    const { calls } = stubApi(true);
    const { fetchMe } = await import("./api-client");

    await fetchMe();
    await fetchMe();

    expect(calls("/api/me")).toBe(2);
  });
});

describe("fetchOnboarding", () => {
  it("does not ask the store for a signed-out visitor", async () => {
    const { calls } = stubApi(false);
    const { fetchOnboarding } = await import("./api-client");

    await expect(Promise.all([fetchOnboarding(), fetchOnboarding()])).resolves.toEqual([
      null,
      null,
    ]);
    expect(calls("/api/onboarding")).toBe(0);
    expect(calls("/api/me")).toBe(1);
  });

  it("reads the store once for a signed-in user, sharing /api/me with other callers", async () => {
    const { calls } = stubApi(true);
    const { fetchMe, fetchOnboarding } = await import("./api-client");

    const [, a, b] = await Promise.all([fetchMe(), fetchOnboarding(), fetchOnboarding()]);

    expect(a?.completed).toBe(false);
    expect(b).toBe(a);
    expect(calls("/api/me")).toBe(1);
    expect(calls("/api/onboarding")).toBe(1);
  });
});
