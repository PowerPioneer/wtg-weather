/**
 * The route table, read off the filesystem.
 *
 * Test-time only — nothing in the running app imports this; Next.js does its
 * own routing. It exists so a test can ask "does this href correspond to a
 * page?" of the same source of truth Next uses, rather than of a hand-kept
 * list that would drift exactly as the footer did.
 *
 * `/privacy` and `/terms` were in the footer, and neither route existed. The
 * links rendered, the build passed, the sitemap didn't mention them, and every
 * visitor who clicked one got a 404 for a whole phase. A hand-written list of
 * expected routes would not have caught it, because the same person writing
 * the link writes the list.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";

const APP_DIR = join(process.cwd(), "src", "app");

/** `(legal)` and friends group files without appearing in the URL. */
function isRouteGroup(segment: string): boolean {
  return segment.startsWith("(") && segment.endsWith(")");
}

/** `@modal` slots and `_private` folders are not routes. */
function isNonRoute(segment: string): boolean {
  return segment.startsWith("@") || segment.startsWith("_");
}

export type AppRoute = {
  /** URL path with dynamic segments left as written, e.g. `/[country]/[slug]`. */
  pattern: string;
  /** `page` renders HTML; `route` is a handler (still a URL that resolves). */
  kind: "page" | "route";
};

/**
 * Every routable path under `src/app`, dynamic segments included.
 *
 * Catch-all (`[...x]`) and optional catch-all (`[[...x]]`) segments are
 * reported as written; {@link routeExists} matches them accordingly.
 */
export function appRoutes(dir: string = APP_DIR, prefix = ""): AppRoute[] {
  const out: AppRoute[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile()) {
      const base = entry.name.replace(/\.(tsx|ts|jsx|js)$/, "");
      if (base === "page" || base === "route") {
        out.push({ pattern: prefix === "" ? "/" : prefix, kind: base });
      }
      continue;
    }
    if (!entry.isDirectory() || isNonRoute(entry.name)) continue;
    const next = isRouteGroup(entry.name) ? prefix : `${prefix}/${entry.name}`;
    out.push(...appRoutes(join(dir, entry.name), next));
  }
  return out;
}

/** `/terms#data` is a link to `/terms`; `/pricing?billing=yearly` to `/pricing`. */
function pathOf(href: string): string {
  return href.split("#")[0]!.split("?")[0]!.replace(/\/$/, "") || "/";
}

/**
 * Every route pattern an href could be served by, most specific first.
 *
 * Usually one. `/peru` matches only `/[country]`; a hypothetical `/pricing`
 * *and* `/[country]` overlap would list both, static first, which is the order
 * Next resolves them in.
 */
export function matchingRoutes(
  href: string,
  routes: readonly AppRoute[] = appRoutes(),
): AppRoute[] {
  const path = pathOf(href);
  const parts = path === "/" ? [] : path.slice(1).split("/");
  return routes
    .filter((route) => matches(parts, route.pattern))
    .sort((a, b) => dynamicSegments(a.pattern) - dynamicSegments(b.pattern));
}

function dynamicSegments(pattern: string): number {
  return pattern.split("/").filter((s) => s.startsWith("[")).length;
}

/**
 * Whether an href resolves to a route *written down as that path* — no dynamic
 * segment standing in for it.
 *
 * The distinction is the whole point of this file. `/[country]` sits at the
 * root of the route tree and absorbs every single-segment path, so `/privacy`
 * "matched a route" for the entire time `/privacy` was a 404: it matched
 * `/[country]`, whose `getCountry("privacy")` returned null and called
 * `notFound()`. A check that accepted a dynamic match would have passed
 * against the bug it exists to catch.
 *
 * So a link to a fixed path must resolve to a fixed route. Use
 * {@link matchingRoutes} where a dynamic match is genuinely what is meant.
 */
export function routeExists(
  href: string,
  routes: readonly AppRoute[] = appRoutes(),
): boolean {
  return matchingRoutes(href, routes).some((r) => !r.pattern.includes("["));
}

function matches(parts: readonly string[], pattern: string): boolean {
  const segs = pattern === "/" ? [] : pattern.slice(1).split("/");
  let i = 0;
  for (const seg of segs) {
    // `[[...slug]]` swallows the rest, and matches zero segments too.
    if (seg.startsWith("[[...")) return true;
    if (seg.startsWith("[...")) return i < parts.length;
    if (i >= parts.length) return false;
    if (!seg.startsWith("[") && seg !== parts[i]) return false;
    i += 1;
  }
  return i === parts.length;
}

/**
 * Every `href="/…"` literal in a component's source.
 *
 * Deliberately textual. Rendering the component and reading its anchors would
 * only cover the branches a test happened to render, and the footer's links
 * are static strings — if one is in the file, it ships.
 */
export function internalHrefsInSource(source: string): string[] {
  const hrefs = new Set<string>();
  for (const match of source.matchAll(/href=["'](\/[^"']*)["']/g)) {
    hrefs.add(match[1]!);
  }
  return [...hrefs];
}
