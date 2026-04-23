import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Button } from "./button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Save trip</Button>);
    expect(screen.getByRole("button", { name: "Save trip" })).toBeInTheDocument();
  });

  it("renders as anchor when as='a'", () => {
    render(
      <Button as="a" href="/pricing">
        See pricing
      </Button>,
    );
    const link = screen.getByRole("link", { name: "See pricing" });
    expect(link).toHaveAttribute("href", "/pricing");
  });

  it("sets aria-busy when loading", () => {
    render(<Button loading>Working</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });
});
