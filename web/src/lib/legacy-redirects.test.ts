import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { routeExists } from "@/lib/app-routes";
import { LEGACY_REDIRECTS } from "./legacy-redirects";

describe("LEGACY_REDIRECTS", () => {
  it("sends every v1 URL v2 lacks to a page that exists", () => {
    for (const { destination } of LEGACY_REDIRECTS) {
      expect(routeExists(destination.split("#")[0] ?? "")).toBe(true);
    }
  });

  it("points the cookies redirect at a section the privacy page has", () => {
    const privacy = readFileSync(
      join(process.cwd(), "src", "app", "(legal)", "privacy", "page.tsx"),
      "utf8",
    );
    expect(privacy).toContain('id="cookies"');
  });

  it("does not redirect a path v2 already serves", () => {
    for (const { source } of LEGACY_REDIRECTS) {
      expect(routeExists(source)).toBe(false);
    }
  });

  it("is wired into next.config", () => {
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(config).toMatch(/LEGACY_REDIRECTS/);
  });
});
