import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { findCountryData } from "@/lib/mock-data";

import { MonthAccordion } from "./month-accordion";

const PERU = findCountryData("peru")!;

describe("MonthAccordion", () => {
  it("links every month straight to its page", () => {
    render(<MonthAccordion country={PERU} />);
    const april = screen.getByRole("link", { name: /April/ });
    expect(april).toHaveAttribute("href", "/peru/april");
    expect(screen.getAllByRole("link")).toHaveLength(12);
  });

  it("no longer opens onto a dropdown repeating the row", () => {
    const { container } = render(<MonthAccordion country={PERU} />);
    expect(container.querySelector("details")).toBeNull();
    expect(screen.queryByText(/Open the .* page/)).toBeNull();
  });
});
