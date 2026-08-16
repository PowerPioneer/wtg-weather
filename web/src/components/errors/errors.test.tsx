import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CountryRef } from "@/lib/countries";
import { appRoutes, internalHrefsInSource, routeExists } from "@/lib/app-routes";

const getCountryIndex = vi.fn<() => Promise<readonly CountryRef[]>>();

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  getCountryIndex: () => getCountryIndex(),
}));

const { ErrorView } = await import("./error-view");
const { NotFoundView } = await import("./not-found-view");
const { suggestedCountries } = await import("./suggested-countries");
const NotFound = (await import("@/app/not-found")).default;

const APP = join(process.cwd(), "src", "app");

beforeEach(() => {
  getCountryIndex.mockReset();
  getCountryIndex.mockResolvedValue([
    { slug: "portugal", name: "Portugal", iso2: "PT", region: "Southern Europe" },
    { slug: "japan", name: "Japan", iso2: "JP", region: "East Asia" },
    { slug: "not-featured", name: "Not Featured", iso2: "NF", region: "Nowhere" },
  ]);
});

describe("suggestedCountries", () => {
  it("offers only countries the API has actually published", async () => {
    // The whole point of the page is that a link 404'd. Offering another link
    // that 404s would be a poor apology, so the editorial shortlist is
    // intersected with the published index rather than trusted.
    const suggestions = await suggestedCountries();
    expect(suggestions.map((s) => s.slug)).toEqual(["japan", "portugal"]);
    expect(suggestions.map((s) => s.name)).toEqual(["Japan", "Portugal"]);
  });

  it("caps the list", async () => {
    expect(await suggestedCountries(1)).toHaveLength(1);
  });

  it("degrades to nothing when the API is unreachable", async () => {
    getCountryIndex.mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }),
    );
    expect(await suggestedCountries()).toEqual([]);
  });

  it("degrades to nothing when the API answers badly, rather than throwing into the 404", async () => {
    // `routableCountries` rethrows a non-connection failure by design, which
    // is right for a build and wrong here: a 404 page that throws becomes a
    // 500, and the visitor loses the only navigation they had.
    getCountryIndex.mockRejectedValue(new Error("503 from the API"));
    expect(await suggestedCountries()).toEqual([]);
  });
});

describe("NotFoundView", () => {
  it("gives a way back in", async () => {
    render(<NotFoundView heading="Nope" message="Not here." />);

    expect(screen.getByRole("heading", { level: 1, name: "Nope" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the map" })).toHaveAttribute(
      "href",
      "/map",
    );
    expect(screen.getByRole("link", { name: "Browse countries" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("lists suggestions when it has them, and omits the section when it does not", () => {
    const { container: withNone } = render(
      <NotFoundView heading="h" message="m" suggestions={[]} />,
    );
    expect(withNone.textContent).not.toMatch(/Popular destinations/);

    render(
      <NotFoundView
        heading="h"
        message="m"
        suggestions={[{ slug: "peru", name: "Peru" }]}
      />,
    );
    expect(screen.getByRole("link", { name: "Peru" })).toHaveAttribute("href", "/peru");
  });

  it("points at month landing pages that exist", () => {
    render(<NotFoundView heading="h" message="m" />);
    const routes = appRoutes();
    for (const month of ["January", "April", "July", "October"]) {
      const link = screen.getByRole("link", { name: month });
      const href = link.getAttribute("href")!;
      expect(href).toBe(`/best-weather-in/${month.toLowerCase()}`);
      // A dynamic match is what is meant here — `/best-weather-in/[month]`.
      expect(routes.some((r) => r.pattern === "/best-weather-in/[month]")).toBe(true);
    }
  });
});

describe("not-found routes", () => {
  it("the site-wide 404 renders with suggestions from the index", async () => {
    render(await NotFound());
    expect(
      screen.getByRole("heading", { level: 1, name: /We don't have a page for that/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Portugal" })).toBeInTheDocument();
  });

  it("names the three lookups that can miss, because it also serves the country segment", async () => {
    // There is no `[country]/not-found.tsx`: on Next 16.2.4 a segment-scoped
    // one is never reached, with or without a layout to host it, so every
    // country / region / month `notFound()` lands on this page. Measured, then
    // the segment version was deleted rather than left looking useful.
    const { container } = render(await NotFound());
    const text = container.textContent ?? "";
    expect(text).toMatch(/country pages exist/);
    expect(text).toMatch(/regions for the admin-1 areas/);
    expect(text).toMatch(/twelve English month names/);
  });

  it("the 404 is a server component", () => {
    // It carries no `"use client"` of its own. Whether the *result* reaches a
    // scripting-disabled reader is a separate question, and a framework one —
    // see the measurement recorded in `not-found.tsx`.
    const source = readFileSync(join(APP, "not-found.tsx"), "utf8");
    expect(source).not.toMatch(/["']use client["']/);
  });

  it.each([
    ["not-found-view.tsx", internalHrefsInSource(readFileSync(join(process.cwd(), "src", "components", "errors", "not-found-view.tsx"), "utf8"))],
  ])("every fixed link in %s resolves", (_file, hrefs) => {
    for (const href of hrefs) {
      if (href.startsWith("/best-weather-in/")) continue; // dynamic, covered above
      expect(routeExists(href)).toBe(true);
    }
  });
});

describe("ErrorView", () => {
  const error = Object.assign(new Error("boom"), { digest: "abc123" });

  it("offers a retry that calls reset, and a way out that does not need one", async () => {
    const reset = vi.fn();
    render(<ErrorView error={error} reset={reset} />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();

    expect(screen.getByRole("link", { name: "Open the map" })).toHaveAttribute(
      "href",
      "/map",
    );
  });

  it("surfaces the digest, which is the only handle on a server-side error", () => {
    render(<ErrorView error={error} reset={() => {}} />);
    expect(screen.getByText(/Reference: abc123/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "get in touch" })).toHaveAttribute(
      "href",
      "/contact",
    );
  });

  it("says nothing about a reference when there is none", () => {
    const { container } = render(
      <ErrorView error={new Error("no digest")} reset={() => {}} />,
    );
    expect(container.textContent).not.toMatch(/Reference:/);
  });

  it("takes the heading and message its boundary gives it", () => {
    render(
      <ErrorView
        error={error}
        reset={() => {}}
        heading="We couldn't load this country"
        message="Custom message."
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "We couldn't load this country" }),
    ).toBeInTheDocument();
  });
});

describe("error boundaries", () => {
  it.each([
    ["global", "error.tsx"],
    ["country segment", join("[country]", "error.tsx")],
    ["root-layout", "global-error.tsx"],
  ])("the %s boundary is a client component that renders the site chrome", (_l, file) => {
    // Client is required by Next.js's `error.tsx` convention — the boundary
    // holds `reset` and catches on the client. It must still render the header
    // and footer itself, because a boundary replaces the page rather than the
    // layout above it.
    const source = readFileSync(join(APP, file), "utf8");
    expect(source).toMatch(/^"use client";/);
    expect(source).toMatch(/PageHeader/);
    expect(source).toMatch(/PageFooter/);
  });
});
