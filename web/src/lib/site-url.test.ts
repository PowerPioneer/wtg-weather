// @vitest-environment node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { SITE_URL } from "./env";
import { siteUrl } from "./site-url";

/**
 * Route handlers must not build an absolute URL against `request.url` (or
 * `nextUrl.origin`): behind Caddy that is the container's bind address, and a
 * redirect to it is `https://0.0.0.0:3000/…`. It shipped twice — `/upgrade`,
 * then `/login/confirm`, `/signout` and `/invite/accept` — so every handler is
 * scanned rather than trusting each to remember.
 */

const APP = join(process.cwd(), "src", "app");

function routeHandlers(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeHandlers(path);
    return /^route\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("siteUrl", () => {
  it("resolves against the public site, not the request", () => {
    expect(siteUrl("/account").href).toBe(new URL("/account", SITE_URL).href);
  });

  it("is what every route handler uses to build absolute URLs", () => {
    const offenders = routeHandlers(APP)
      .filter((f) => /new URL\([^)]*,\s*(request|req)\.url\)|nextUrl\.origin/.test(readFileSync(f, "utf8")))
      .map((f) => relative(APP, f));
    expect(offenders).toEqual([]);
  });
});
