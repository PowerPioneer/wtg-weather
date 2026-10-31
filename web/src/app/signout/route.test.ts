import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Sign-out's redirect home. Built from `request.url` it sent every visitor who
 * signed out to `https://0.0.0.0:3000/` — the container's bind address, not
 * the site. It must be absolute against the public origin.
 */

const { POST } = await import("./route");
const { SITE_URL } = await import("@/lib/env");

const INTERNAL = "http://0.0.0.0:3000/signout";

afterEach(() => vi.unstubAllGlobals());

describe("/signout redirect", () => {
  it("sends a signed-in visitor to the public home page and clears the session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204, headers: { "set-cookie": "wtg_session=; Max-Age=0; Path=/" } })),
    );
    const res = await POST(new Request(INTERNAL, { method: "POST", headers: { cookie: "wtg_session=abc" } }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${SITE_URL}/`);
    expect(res.headers.get("set-cookie")).toContain("wtg_session=");
  });

  it("signs this browser out only, by default", async () => {
    const fetchSpy = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchSpy);
    await POST(new Request(INTERNAL, { method: "POST", headers: { cookie: "wtg_session=abc" } }));
    expect(String(fetchSpy.mock.calls[0]?.[0])).toMatch(/\/api\/auth\/logout$/);
  });

  it("revokes every session when the form asks for scope=all", async () => {
    const fetchSpy = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 204, headers: { "set-cookie": "wtg_session=; Max-Age=0; Path=/" } }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const res = await POST(
      new Request(INTERNAL, {
        method: "POST",
        headers: { cookie: "wtg_session=abc", "content-type": "application/x-www-form-urlencoded" },
        body: "scope=all",
      }),
    );
    expect(String(fetchSpy.mock.calls[0]?.[0])).toMatch(/\/api\/auth\/logout-all$/);
    expect(res.headers.get("location")).toBe(`${SITE_URL}/`);
    expect(res.headers.get("set-cookie")).toContain("wtg_session=");
  });

  it("sends a visitor with no session to the public home page too", async () => {
    const res = await POST(new Request(INTERNAL, { method: "POST" }));
    expect(res.headers.get("location")).toBe(`${SITE_URL}/`);
    expect(res.headers.get("location")).not.toContain("0.0.0.0");
  });
});
