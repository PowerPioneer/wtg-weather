import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { findCountryByIso2 } from "@/lib/countries";
import { monthKey, readFeatureIdentity } from "@/lib/feature-climate";
import { DEFAULT_PREFERENCES } from "@/lib/scoring";

import { ClimatePanel } from "./climate-panel";

/**
 * Georgia is the reported symptom: it is present in the tiles, but the old
 * nine-entry registry did not know its code, so clicking it did nothing at
 * all. The panel is what a click produces now.
 */
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
  ...monthly("pref", 78), // April → 82, a "Good option"
};

const GEORGIA_IDENTITY = readFeatureIdentity(GEORGIA)!;

function renderPanel(overrides: Partial<Parameters<typeof ClimatePanel>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <ClimatePanel
      identity={GEORGIA_IDENTITY}
      properties={GEORGIA}
      month={4}
      country={findCountryByIso2("GE")}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onClose };
}

afterEach(() => {
  cleanup();
});

describe("ClimatePanel", () => {
  it("names the clicked feature and scores the selected month", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "Georgia" })).toBeInTheDocument();
    expect(screen.getByText(/April match/)).toBeInTheDocument();
    expect(screen.getByText("Good option")).toBeInTheDocument();
  });

  it("offers the country page instead of navigating on click", () => {
    renderPanel();
    const cta = screen.getByTestId("view-country-page");
    expect(cta).toHaveAttribute("href", "/georgia");
    expect(screen.getByRole("link", { name: "Georgia in April" })).toHaveAttribute(
      "href",
      "/georgia/april",
    );
  });

  it("charts only the variables the feature actually carries", () => {
    renderPanel();
    // Temperature, rainfall and sunshine are in the fixture; wind and the four
    // premium variables are not, and a chart with gaps would misread as data.
    expect(screen.getByText("Temperature")).toBeInTheDocument();
    expect(screen.getByText("Rainfall")).toBeInTheDocument();
    expect(screen.getByText("Sunshine")).toBeInTheDocument();
    expect(screen.queryByText("Wind")).not.toBeInTheDocument();
    expect(screen.queryByText("Snow depth")).not.toBeInTheDocument();
  });

  it("shows the advisory level the Safety mode paints", () => {
    // WS-4 bakes a month-less `safety` property into both tiers. Without this
    // the panel charted climate and never mentioned the advisory, so Safety
    // mode painted a colour nothing on screen explained.
    const flagged = { ...GEORGIA, safety: 2 };
    renderPanel({ identity: readFeatureIdentity(flagged)!, properties: flagged });
    expect(screen.getByTestId("panel-advisory")).toBeInTheDocument();
    expect(screen.getByText("Exercise increased caution")).toBeInTheDocument();
  });

  it("says nothing about safety for a country no government lists", () => {
    // Absent means "unlisted", which the map paints grey — rendering it as
    // level 1 would invent an all-clear the data never gave.
    renderPanel();
    expect(screen.queryByTestId("panel-advisory")).not.toBeInTheDocument();
  });

  it("names the parent country on a region feature", () => {
    const region = {
      ...GEORGIA,
      id: "GEO-1",
      name: "Kakheti",
      level: "admin1",
      admin1_code: "GE-KA",
    };
    renderPanel({
      identity: readFeatureIdentity(region)!,
      properties: region,
    });
    expect(screen.getByRole("heading", { name: "Kakheti" })).toBeInTheDocument();
    expect(screen.getByText("Region in Georgia")).toBeInTheDocument();
    // The region's own page leads, the country page stays as the way up.
    expect(screen.getByTestId("view-region-page")).toHaveAttribute(
      "href",
      "/region/georgia/GEO-1?name=Kakheti",
    );
    expect(screen.getByTestId("view-country-page")).toHaveAttribute("href", "/georgia");
  });

  it("sends a district to its country, having no page of its own", () => {
    // geoBoundaries admin-2 rows carry no parent admin-1 code, so a district
    // cannot address the region page even though it sits inside one.
    const district = {
      ...GEORGIA,
      id: "GEO-ADM2-7",
      name: "Telavi",
      level: "admin2",
    };
    renderPanel({
      identity: readFeatureIdentity(district)!,
      properties: district,
    });
    expect(screen.getByText("District in Georgia")).toBeInTheDocument();
    expect(screen.queryByTestId("view-region-page")).not.toBeInTheDocument();
    expect(screen.getByTestId("view-country-page")).toHaveAttribute("href", "/georgia");
  });

  it("says so rather than linking when the country page is not published", () => {
    renderPanel({ hasCountryPage: false });
    expect(screen.queryByTestId("view-country-page")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Georgia country page is not published yet/i),
    ).toBeInTheDocument();
  });

  it("explains itself for a polygon with no country code", () => {
    // Somaliland, Northern Cyprus and the Siachen Glacier are painted but the
    // pipeline blanks their `-99` ISO-2, so there is no page to link to.
    const somaliland = { ...GEORGIA, id: "SOL", iso_a2: "", name: "Somaliland" };
    renderPanel({
      identity: readFeatureIdentity(somaliland)!,
      properties: somaliland,
      country: undefined,
    });
    expect(screen.queryByTestId("view-country-page")).not.toBeInTheDocument();
    expect(
      screen.getByText(/no internationally assigned country code/i),
    ).toBeInTheDocument();
  });

  it("stays useful when the feature carries no climate at all", () => {
    const bare = { id: "GEO", iso_a2: "GE", name: "Georgia", level: "country" };
    renderPanel({ identity: readFeatureIdentity(bare)!, properties: bare });
    expect(screen.getByText("No match for this area")).toBeInTheDocument();
    expect(screen.getByText(/carries no climate values/i)).toBeInTheDocument();
  });

  it("closes", async () => {
    const { onClose } = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Close climate detail" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("states the verdict once, as a word", () => {
    renderPanel();
    // The badge is the only place the verdict appears — it used to be printed
    // beside a numeral, and removing the numeral left the same words twice.
    const verdicts = screen.getAllByText("Good option");
    expect(verdicts).toHaveLength(1);
    expect(screen.getByTestId("climate-panel").textContent).not.toMatch(
      /\d{1,3}\s*(?:\/\s*100)?\s*(?:out of 100)?(?=[^°]*match)/i,
    );
  });

  it("says when the advisory, not the weather, is what made it Avoid", () => {
    const props = {
      id: "SOM",
      iso_a2: "SO",
      name: "Somalia",
      level: "country",
      // Ideal weather and the pipeline's own baked score agreeing it is a
      // perfect match — then a level-4 advisory. The veto has to reach the
      // baked path too, or the panel contradicts the colour on the map.
      ...monthly("t", 24),
      ...monthly("r", 0.4),
      ...monthly("s", 9),
      ...monthly("pref", 90),
      safety: 4,
    };
    renderPanel({
      identity: readFeatureIdentity(props)!,
      properties: props,
      preferences: { ...DEFAULT_PREFERENCES, safetyMax: 3 },
    });
    expect(screen.getByText(/above your limit/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Match: Avoid" })).toBeInTheDocument();
  });

  it("offers a drag handle that also closes on a plain tap", async () => {
    const { onClose } = renderPanel();
    await userEvent.click(screen.getByTestId("climate-panel-handle"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
