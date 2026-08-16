import type { MetadataRoute } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `robots.txt` must keep v2 out of the index until cutover.
 *
 * The flip is a WS-G step and a deliberate one. What is pinned here is the
 * *direction of the default*: indexing opens only for the exact string
 * `"prod"`, so every other state — staging, an unset variable, an empty one,
 * Next's own `"production"` from `NODE_ENV` — disallows. A duplicate of the
 * whole site indexed on the v2 subdomain before the apex moves is not
 * something you undo by editing a file.
 */

async function robotsWith(appEnv: string): Promise<MetadataRoute.Robots> {
  vi.resetModules();
  vi.doMock("@/lib/env", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/env")>()),
    APP_ENV: appEnv,
    SITE_URL: "https://v2.wheretogoforgreatweather.com",
  }));
  const robots = (await import("./robots")).default;
  return robots();
}

function rules(result: MetadataRoute.Robots) {
  return Array.isArray(result.rules) ? result.rules : [result.rules];
}

afterEach(() => {
  vi.doUnmock("@/lib/env");
  vi.resetModules();
});

describe("robots.txt before cutover", () => {
  it.each([
    ["staging", "staging"],
    ["unset", ""],
    ["development", "development"],
    // The fallback in `lib/env.ts` is `NODE_ENV`, which Next sets to
    // "production" — not "prod". A build with NEXT_PUBLIC_APP_ENV missing must
    // still be blocked, and this is the case that would silently open it.
    ["NODE_ENV's production", "production"],
  ])("disallows everything when APP_ENV is %s", async (_label, appEnv) => {
    const result = await robotsWith(appEnv);
    const [rule] = rules(result);
    expect(rule).toMatchObject({ userAgent: "*", disallow: "/" });
    expect(rule).not.toHaveProperty("allow");
  });
});

describe("robots.txt at cutover", () => {
  it("opens crawling only for the exact string prod", async () => {
    const [rule] = rules(await robotsWith("prod"));
    expect(rule?.allow).toBe("/");
    expect(rule?.disallow).toEqual([
      "/api/",
      "/debug/",
      "/account/",
      "/onboarding/",
      "/login/",
    ]);
  });

  it("always points at the sitemap", async () => {
    for (const env of ["staging", "prod"]) {
      const result = await robotsWith(env);
      expect(result.sitemap).toBe(
        "https://v2.wheretogoforgreatweather.com/sitemap.xml",
      );
    }
  });
});
