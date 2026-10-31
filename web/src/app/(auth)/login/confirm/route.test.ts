import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The magic link's landing. Behind Caddy the request a route handler sees is
 * addressed to the container's bind address, and building the redirect from
 * `request.url` sent every signed-in visitor to `https://0.0.0.0:3000/account`
 * (ERR_ADDRESS_INVALID) — found on the first sign-in after the apex cutover.
 * Every Location here must be absolute against the public origin.
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

const { POST } = await import("./route");
const { SITE_URL } = await import("@/lib/env");

const INTERNAL = "http://0.0.0.0:3000/login/confirm";

/** What the button on `/login/verify` sends: a same-origin form post. */
function confirm(token: string | null, origin: string | null = SITE_URL): Request {
  const body = new URLSearchParams();
  if (token !== null) body.set("token", token);
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
  };
  if (origin) headers.origin = origin;
  return new Request(INTERNAL, { method: "POST", headers, body });
}

beforeEach(() => cookieStore.value.clear());
afterEach(() => vi.unstubAllGlobals());

function apiAnswers(res: Response | null): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (!res) throw new Error("unreachable");
      return res;
    }),
  );
}

describe("/login/confirm redirects", () => {
  it("lands a verified token on the public account page, with the session cookie", async () => {
    apiAnswers(
      new Response(null, { status: 200, headers: { "set-cookie": "wtg_session=abc; Path=/; HttpOnly" } }),
    );
    const res = await POST(confirm("t"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${SITE_URL}/account`);
    expect(res.headers.get("set-cookie")).toContain("wtg_session=abc");
  });

  it("sends an expired token back to the public login page", async () => {
    apiAnswers(new Response(null, { status: 400 }));
    const res = await POST(confirm("t"));
    expect(res.headers.get("location")).toBe(`${SITE_URL}/login?error=expired`);
  });

  // On 2026-10-27 a full disk took Postgres down, every verify answered 500,
  // and visitors were told their minute-old link had expired.
  it("reports an API failure as unavailable, not as an expired link", async () => {
    apiAnswers(new Response(null, { status: 500 }));
    const res = await POST(confirm("t"));
    expect(res.headers.get("location")).toBe(`${SITE_URL}/login?error=unavailable`);
  });

  it("treats a malformed token the API rejects as an invalid link", async () => {
    apiAnswers(new Response(null, { status: 422 }));
    const res = await POST(confirm("t"));
    expect(res.headers.get("location")).toBe(`${SITE_URL}/login?error=expired`);
  });

  it("sends a missing token back to the public login page", async () => {
    const res = await POST(confirm(null));
    expect(res.headers.get("location")).toBe(`${SITE_URL}/login?error=missing`);
  });

  it("never names the bind address", async () => {
    apiAnswers(null);
    const res = await POST(confirm("t"));
    expect(res.headers.get("location")).not.toContain("0.0.0.0");
  });

  it("refuses a token posted from another site (login CSRF)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await POST(confirm("attackers-token", "https://evil.example"));
    expect(res.headers.get("location")).toBe(`${SITE_URL}/login?error=missing`);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepts its own form on a host other than SITE_URL (dev server, e2e stack)", async () => {
    apiAnswers(
      new Response(null, { status: 204, headers: { "set-cookie": "wtg_session=abc; Path=/; HttpOnly" } }),
    );
    const req = confirm("t", "http://localhost:3000");
    req.headers.set("host", "localhost:3000");
    const res = await POST(req);
    expect(res.headers.get("set-cookie")).toContain("wtg_session=abc");
  });

  it("accepts a post whose browser withheld the origin", async () => {
    apiAnswers(
      new Response(null, { status: 204, headers: { "set-cookie": "wtg_session=abc; Path=/; HttpOnly" } }),
    );
    const res = await POST(confirm("t", null));
    expect(res.headers.get("location")).toBe(`${SITE_URL}/account`);
  });
});
