import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  appRoutes,
  internalHrefsInSource,
  matchingRoutes,
  routeExists,
} from "@/lib/app-routes";
import { PageFooter } from "./page-footer";

/**
 * The footer's links have to resolve.
 *
 * This is the regression that shipped: `/privacy` and `/terms` were linked
 * from every page on the site and neither route existed. Nothing failed — a
 * `<Link>` to a missing route is a perfectly valid `<a>`, and the 404 only
 * happens in the visitor's browser.
 *
 * The header gets the same check, because it is the same failure mode with a
 * more prominent link.
 */

function sourceOf(file: string): string {
  return readFileSync(join(process.cwd(), "src", "components", "layout", file), "utf8");
}

describe("app route table", () => {
  const routes = appRoutes();

  it("finds the routes it is going to be asked about", () => {
    // A bug in the filesystem walk would make every assertion below pass
    // vacuously, so pin a few routes that certainly exist.
    expect(routes.length).toBeGreaterThan(10);
    expect(routeExists("/", routes)).toBe(true);
    expect(routeExists("/pricing", routes)).toBe(true);
    expect(routeExists("/map", routes)).toBe(true);
  });

  it("resolves routes that live inside a route group", () => {
    // `/privacy` is `src/app/(legal)/privacy/page.tsx` — the group contributes
    // no URL segment, and a walk that forgot that would report a false 404.
    expect(routeExists("/privacy", routes)).toBe(true);
    expect(routeExists("/login", routes)).toBe(true);
  });

  it("does not accept a dynamic route standing in for a fixed path", () => {
    // The bug this file exists to catch. `/[country]` matches any single
    // segment, so `/privacy` "resolved" for the whole time it was a 404 — the
    // country page took the request and called `notFound()`. A fixed link
    // must find a fixed route.
    expect(routeExists("/nonexistent-top-level-page", routes)).toBe(false);
    expect(matchingRoutes("/nonexistent-top-level-page", routes)).toEqual([
      { pattern: "/[country]", kind: "page" },
    ]);
    expect(routeExists("/pricing/deeper", routes)).toBe(false);
  });

  it("still reports the dynamic match where one is what is meant", () => {
    expect(matchingRoutes("/peru/april", routes).map((r) => r.pattern)).toContain(
      "/[country]/[slug]",
    );
  });

  it("ignores fragments and query strings", () => {
    expect(routeExists("/terms#data", routes)).toBe(true);
    expect(routeExists("/pricing?billing=yearly", routes)).toBe(true);
  });
});

describe("page footer", () => {
  const source = sourceOf("page-footer.tsx");
  const hrefs = internalHrefsInSource(source);

  it("links the four legal pages", () => {
    expect(hrefs).toEqual(
      expect.arrayContaining(["/privacy", "/terms", "/refunds", "/contact"]),
    );
  });

  it.each(internalHrefsInSource(sourceOf("page-footer.tsx")))(
    "%s resolves to a route",
    (href) => {
      expect(routeExists(href)).toBe(true);
    },
  );

  it("credits the sources the pipeline actually uses, not ReliefWeb", () => {
    // Asserted on the rendered output rather than the source, because the
    // source now explains the old attribution in a comment.
    render(<PageFooter />);
    expect(screen.queryByText(/ReliefWeb/i)).toBeNull();
    expect(screen.getByText(/ECMWF ERA5/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ECMWF ERA5/ })).toHaveAttribute(
      "href",
      "/terms#data",
    );
  });
});

describe("page header", () => {
  it.each(internalHrefsInSource(sourceOf("page-header.tsx")))(
    "%s resolves to a route",
    (href) => {
      expect(routeExists(href)).toBe(true);
    },
  );
});
