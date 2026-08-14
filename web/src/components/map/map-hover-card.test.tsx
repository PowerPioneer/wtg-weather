import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { monthKey, readFeatureIdentity } from "@/lib/feature-climate";
import { DEFAULT_PREFERENCES } from "@/lib/scoring";

import { MapHoverCard } from "./map-hover-card";

function monthly(prefix: string, base: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (let m = 1; m <= 12; m++) out[monthKey(prefix, m)] = base + m;
  return out;
}

const GEORGIA = {
  id: "GEO",
  iso_a2: "GE",
  admin1_code: "",
  name: "Georgia",
  level: "country",
  ...monthly("t", 5),
  ...monthly("r", 1),
  ...monthly("s", 3),
  ...monthly("pref", 70),
};

function renderCard(properties: Record<string, unknown> = GEORGIA, mode = "preferences") {
  render(
    <MapHoverCard
      identity={readFeatureIdentity(properties)!}
      properties={properties}
      point={{ x: 20, y: 20 }}
      mode={mode as "preferences"}
      month={4}
      preferences={DEFAULT_PREFERENCES}
      countryName="Georgia"
    />,
  );
  return screen.getByRole("tooltip", { hidden: true });
}

afterEach(() => {
  cleanup();
});

describe("MapHoverCard", () => {
  it("reads out the place, the month and the climate under the cursor", () => {
    const card = renderCard();
    expect(card).toHaveTextContent("Georgia");
    expect(card).toHaveTextContent("Apr · default preferences");
    expect(card).toHaveTextContent("Temp");
  });

  it("names the advisory level when the polygon carries one", () => {
    // Safety is the one mode whose colour the card could not explain: it is a
    // month-less scalar, so the per-month stat rows skip it entirely.
    const card = renderCard({ ...GEORGIA, safety: 3 }, "safety");
    expect(card).toHaveTextContent("Advisory level 3 · Reconsider travel");
  });

  it("carries the advisory in any mode, not only Safety", () => {
    const card = renderCard({ ...GEORGIA, safety: 1 });
    expect(card).toHaveTextContent("Advisory level 1");
  });

  it("stays quiet for a country no government lists", () => {
    const card = renderCard();
    expect(card).not.toHaveTextContent(/advisory/i);
  });

  it("ignores a level outside the legend rather than painting it confidently", () => {
    const card = renderCard({ ...GEORGIA, safety: 7 });
    expect(card).not.toHaveTextContent(/advisory/i);
  });
});
