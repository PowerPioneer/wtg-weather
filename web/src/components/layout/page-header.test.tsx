import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PageHeader } from "./page-header";

afterEach(() => {
  cleanup();
});

/**
 * The header's mobile layout is CSS, which jsdom does not compute — the real
 * check for "does the brand still overflow a 56px bar" is the browser. What is
 * worth pinning here is the structure that makes the mobile layout possible at
 * all, because it is easy to delete by accident: a disclosure that needs no
 * client JS, and every destination reachable from inside it.
 */
describe("PageHeader", () => {
  it("keeps the full product name rather than truncating it", () => {
    render(<PageHeader />);
    expect(
      screen.getAllByText("Where to Go for Great Weather").length,
    ).toBeGreaterThan(0);
  });

  it("offers a menu that works with no client JS", () => {
    const { container } = render(<PageHeader />);
    const disclosure = container.querySelector("details");
    expect(disclosure).toBeTruthy();
    expect(disclosure!.querySelector("summary")).toBeTruthy();
    // Closed by default — a `<details open>` would drop an open panel over
    // the page on every load.
    expect(disclosure!.open).toBe(false);
  });

  it("puts every destination in the menu, not only in the desktop nav", () => {
    const { container } = render(<PageHeader />);
    const menu = within(container.querySelector("details")!);
    for (const label of ["Map", "Countries", "Pricing", "Sign in"]) {
      expect(menu.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("marks the current page in both navs", () => {
    render(<PageHeader activePath="/pricing" />);
    for (const link of screen.getAllByRole("link", { name: "Pricing" })) {
      expect(link.className).toContain("font-medium");
    }
  });
});
