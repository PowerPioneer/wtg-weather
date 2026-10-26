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

const { GET } = await import("./route");
const { SITE_URL } = await import("@/lib/env");

const INTERNAL = "http://0.0.0.0:3000/login/verify";

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

describe("/login/verify redirects", () => {
  it("lands a verified token on the public account page, with the session cookie", async () => {
    apiAnswers(
      new Response(null, { status: 200, headers: { "set-cookie": "wtg_session=abc; Path=/; HttpOnly" } }),
    );
    const res = await GET(new Request(`${INTERNAL}?token=t`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${SITE_URL}/account`);
    expect(res.headers.get("set-cookie")).toContain("wtg_session=abc");
  });

  it("sends an expired token back to the public login page", async () => {
    apiAnswers(new Response(null, { status: 400 }));
    const res = await GET(new Request(`${INTERNAL}?token=t`));
    expect(res.headers.get("location")).toBe(`${SITE_URL}/login?error=expired`);
  });

  it("sends a missing token back to the public login page", async () => {
    const res = await GET(new Request(INTERNAL));
    expect(res.headers.get("location")).toBe(`${SITE_URL}/login?error=missing`);
  });

  it("never names the bind address", async () => {
    apiAnswers(null);
    const res = await GET(new Request(`${INTERNAL}?token=t`));
    expect(res.headers.get("location")).not.toContain("0.0.0.0");
  });
});
