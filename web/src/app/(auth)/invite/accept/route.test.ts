import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Accepting an agency invitation. Same bug class as `/login/verify`: redirects
 * built from `request.url` pointed at the container's bind address. Both the
 * success landing and every refusal must use the public origin.
 */

const { POST } = await import("./route");
const { SITE_URL } = await import("@/lib/env");

const INTERNAL = "http://0.0.0.0:3000/invite/accept";

afterEach(() => vi.unstubAllGlobals());

function post(token: string | null): Promise<Response> {
  const body = new FormData();
  if (token !== null) body.set("token", token);
  return POST(new Request(INTERNAL, { method: "POST", body }));
}

describe("/invite/accept redirects", () => {
  it("lands an accepted invitation on the public account page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200, headers: { "set-cookie": "wtg_session=abc; Path=/" } })),
    );
    const res = await post("tok");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${SITE_URL}/account`);
  });

  it("sends a refusal back to the public invite page with its reason", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    const res = await post("tok");
    expect(res.headers.get("location")).toBe(`${SITE_URL}/invite?token=tok&error=unknown`);
  });

  it("never names the bind address", async () => {
    const res = await post(null);
    expect(res.headers.get("location")).not.toContain("0.0.0.0");
  });
});
