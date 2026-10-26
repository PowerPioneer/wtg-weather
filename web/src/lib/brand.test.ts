// @vitest-environment node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { brandedTitle, POSTAL_ADDRESS, SITE_NAME } from "./brand";
import { countryMetadata } from "./seo";
import type { CountryData } from "./types";

/**
 * "Atlas" was the design direction's code name; it shipped as the brand in
 * titles, Open Graph cards, structured data and email, and the email footer
 * carried a placeholder San Francisco address from the design files. These
 * pin both out of anything a visitor, a crawler or a mailbox receives.
 */

const SRC = join(process.cwd(), "src");
const API_TEMPLATES = join(process.cwd(), "..", "api", "src", "wtg_api", "templates", "emails");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|html|txt)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("brand", () => {
  it("never ships the design code name as the product name", () => {
    const offenders = [...files(SRC), ...files(API_TEMPLATES)].filter(
      (f) => !f.endsWith(join("lib", "brand.ts")) && readFileSync(f, "utf8").includes("Atlas Weather"),
    );
    expect(offenders).toEqual([]);
  });

  it("never ships the placeholder postal address", () => {
    const offenders = [...files(SRC), ...files(API_TEMPLATES)].filter((f) =>
      readFileSync(f, "utf8").includes("Market Street"),
    );
    expect(offenders).toEqual([]);
  });

  it("puts the operator's real address in the email the API sends", () => {
    for (const name of ["alert-matched.html", "alert-stopped.html", "alert-matched.txt"]) {
      expect(readFileSync(join(API_TEMPLATES, name), "utf8")).toContain(POSTAL_ADDRESS);
    }
  });

  it("gives SEO pages one brand suffix, not two", () => {
    // The layout's template appends the name to a plain title; a page title
    // that already carries it must be absolute or the name appears twice.
    const meta = countryMetadata({ name: "Peru", slug: "peru" } as CountryData);
    expect(meta.title).toEqual({ absolute: brandedTitle("Peru — weather, regions, safety") });
    expect(meta.openGraph?.siteName).toBe(SITE_NAME);
  });

  it("leaves no page title carrying the suffix the layout template adds", () => {
    const offenders = files(join(SRC, "app")).filter((f) =>
      /title:\s*["`][^"`]*· (Where to Go for Great Weather|Atlas Weather)["`]/.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
