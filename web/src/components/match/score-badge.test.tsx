import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { ScoreBadge } from "./score-badge";

describe("ScoreBadge", () => {
  it.each([
    ["perfect", 92],
    ["good", 78],
    ["acceptable", 61],
    ["avoid", 30],
  ] as const)("snapshot for %s bin", (bin, score) => {
    const { container } = render(<ScoreBadge score={score} size="md" />);
    expect(container.firstChild).toMatchSnapshot(bin);
  });

  it("renders the verdict as a word, never as a number", () => {
    const { container, getByText } = render(<ScoreBadge score={92} size="md" />);
    expect(getByText("Perfect match")).toBeInTheDocument();
    // The score itself is still what the component is given; it must not reach
    // the DOM in any form.
    expect(container.textContent).not.toMatch(/\d/);
  });

  it("gives the full wording to assistive tech even when the short one is shown", () => {
    const { getByRole } = render(
      <ScoreBadge score={92} size="md" label="short" />,
    );
    expect(getByRole("img")).toHaveAttribute("aria-label", "Match: Perfect match");
    expect(getByRole("img")).toHaveTextContent("Perfect");
  });

  it("bins on the raw value rather than a rounded one", () => {
    // 84.6 is in the "good" bin — a rounded 85 would have been "perfect".
    const { getByRole } = render(<ScoreBadge score={84.6} size="md" />);
    expect(getByRole("img")).toHaveAttribute("aria-label", "Match: Good option");
  });

  it("clamps out-of-range scores", () => {
    const { getByRole } = render(<ScoreBadge score={-5} size="sm" />);
    expect(getByRole("img")).toHaveAttribute("aria-label", "Match: Avoid");
  });

  it("shortens on the small size", () => {
    const { getByRole } = render(<ScoreBadge score={61} size="sm" />);
    expect(getByRole("img")).toHaveTextContent("Fair");
  });

  it("spells the verdict out on the large size", () => {
    const { getByRole } = render(<ScoreBadge score={61} size="lg" />);
    expect(getByRole("img")).toHaveTextContent("Acceptable");
  });
});
