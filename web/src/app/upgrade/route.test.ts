import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/upgrade`'s redirects, which were absolute against the wrong origin.
 *
 * Every one of them was built with `new URL(path, request.url)`. Behind Caddy
 * that resolves to the container's own bind address, so production served
 * `Location: https://0.0.0.0:3000/pricing` — unreachable from any browser. It
 * broke the no-JS upgrade path, the sign-in bounce and the checkout-failure
 * return, and it survived because this route had no test at all: every other
 * assertion in the suite checks the *anchor* points at `/upgrade`, and stops
 * there.
 *
 * So these assert the one property that matters and cannot be satisfied by
 * accident — the Location is absolute against the public origin, and no
 * response ever names the bind address.
 */

const cookieStore = { value: new Map<string, string>() };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.value.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

const { GET } = await import("./route");
const { SITE_URL } = await import("@/lib/env");

/** The internal URL Next sees behind the proxy — the source of the bug. */
const INTERNAL_REQUEST = "http://0.0.0.0:3000/upgrade";

beforeEach(() => {
  cookieStore.value.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function get(query: string): Promise<Response> {
  return GET(new Request(`${INTERNAL_REQUEST}${query}`));
}

describe("/upgrade redirects", () => {
  it("sends an unknown plan to the public pricing page, not the bind address", async () => {
    const res = await get("?plan=nonsense");
    const location = res.headers.get("location") ?? "";
    expect(res.status).toBe(303);
    expect(location).toBe(`${SITE_URL}/pricing`);
    expect(location).not.toContain("0.0.0.0");
  });

  it("bounces an anonymous visitor to the public login page", async () => {
    const res = await get("?plan=consumer_premium");
    const location = res.headers.get("location") ?? "";
    expect(res.status).toBe(303);
    expect(location).toBe(`${SITE_URL}/login`);
    expect(location).not.toContain("0.0.0.0");
  });

  it("marks the intent cookie Secure on an https site", async () => {
    // Read from SITE_URL, not the request: the request's own scheme inside the
    // container is http, so testing it dropped Secure on every production
    // response — the opposite of the intent.
    const res = await get("?plan=consumer_premium");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("wtg_checkout_intent");
    expect(setCookie.toLowerCase()).toContain("httponly");
    if (SITE_URL.startsWith("https:")) {
      expect(setCookie.toLowerCase()).toContain("secure");
    }
  });

  it("returns to the public pricing page when the checkout cannot be minted", async () => {
    cookieStore.value.set("wtg_session", "a-session");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );

    const res = await get("?plan=consumer_premium");
    const location = res.headers.get("location") ?? "";
    expect(res.status).toBe(303);
    expect(location).toBe(`${SITE_URL}/pricing?checkout=error`);
    expect(location).not.toContain("0.0.0.0");
  });

  it("follows the Paddle URL verbatim once one is minted", async () => {
    cookieStore.value.set("wtg_session", "a-session");
    const paddle = "https://example.com/checkout/pay?_ptxn=txn_01abc";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ checkout_url: paddle }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    const res = await get("?plan=consumer_premium");
    // Paddle's own link, untouched — this side never rebuilds one.
    expect(res.headers.get("location")).toBe(paddle);
  });
});
