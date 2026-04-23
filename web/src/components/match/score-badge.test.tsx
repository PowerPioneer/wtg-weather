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

  it("announces the bin in the accessible name even when label is 'number'", () => {
    const { getByRole } = render(
      <ScoreBadge score={92} size="md" label="number" />,
    );
    expect(getByRole("img")).toHaveAttribute(
      "aria-label",
      "92 out of 100 — Perfect",
    );
  });

  it("rounds non-integer scores for display but keeps binning on raw value", () => {
    // 84.6 is in the "good" bin (<85) but displays as 85.
    const { getByRole } = render(<ScoreBadge score={84.6} size="md" />);
    expect(getByRole("img")).toHaveAttribute(
      "aria-label",
      "85 out of 100 — Good",
    );
  });

  it("clamps out-of-range scores", () => {
    const { getByRole } = render(<ScoreBadge score={-5} size="sm" />);
    expect(getByRole("img")).toHaveAttribute(
      "aria-label",
      "0 out of 100 — Avoid",
    );
  });
});
