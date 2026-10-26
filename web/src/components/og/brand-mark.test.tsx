// @vitest-environment node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Satori fetches emoji artwork from cdn.jsdelivr.net, which the web container
 * cannot resolve, and that failure is not caught: one emoji anywhere in an OG
 * image turns the whole response into a 502. Every OG route is scanned rather
 * than trusting each to remember — the `☀` that caused it sat in four of them.
 */

const APP = join(process.cwd(), "src", "app");

function ogRoutes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return ogRoutes(path);
    return /^(opengraph|twitter)-image\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("OG images", () => {
  it("are found by the scan", () => {
    expect(ogRoutes(APP).length).toBeGreaterThanOrEqual(4);
  });

  it("contain no emoji", () => {
    const offenders = ogRoutes(APP)
      .filter((f) => /\p{Extended_Pictographic}/u.test(readFileSync(f, "utf8")))
      .map((f) => relative(APP, f));
    expect(offenders).toEqual([]);
  });
});
