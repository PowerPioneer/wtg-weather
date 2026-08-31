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

  /**
   * `tv()` merges through tailwind-merge, which once grouped the size
   * variant's `text-body-sm` with the colour `text-primary-foreground` and
   * dropped the colour — a navy label on a navy fill, on the default variant,
   * invisible. Nothing about the rendered page announces that; pin the class
   * list so it cannot come back quietly.
   */
  describe("class list", () => {
    it("keeps both the size and the colour on the default variant", () => {
      render(<Button>Upgrade</Button>);
      const classes = screen.getByRole("button").className.split(/\s+/);

      expect(classes).toContain("bg-primary");
      expect(classes).toContain("text-primary-foreground");
      expect(classes).toContain("text-body-sm");
      expect(classes).toContain("h-10");
    });

    it.each([
      ["primary", "text-primary-foreground"],
      ["secondary", "text-text"],
      ["ghost", "text-text"],
      ["destructive", "text-destructive-foreground"],
      ["link", "text-text-link"],
    ] as const)("keeps %s's colour at every size", (variant, colour) => {
      for (const size of ["sm", "md", "lg"] as const) {
        const { container, unmount } = render(
          <Button variant={variant} size={size}>
            Go
          </Button>,
        );
        expect(container.firstElementChild?.className.split(/\s+/)).toContain(
          colour,
        );
        unmount();
      }
    });

    it("still lets a className win over the variant it collides with", () => {
      render(<Button className="bg-surface">Go</Button>);
      const classes = screen.getByRole("button").className.split(/\s+/);

      // `cn()` is plain clsx — no merge — so both survive and CSS order
      // decides. The point is only that passing one is not silently dropped.
      expect(classes).toContain("bg-surface");
    });
  });
});
