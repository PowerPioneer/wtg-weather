import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { findCountryByIso2 } from "@/lib/countries";
import { monthKey, readFeatureIdentity } from "@/lib/feature-climate";

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
    expect(screen.getByText("April match")).toBeInTheDocument();
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
    // Until the region data path lands, the CTA is the parent country page.
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
    expect(screen.getByText("No score for this area")).toBeInTheDocument();
    expect(screen.getByText(/carries no climate values/i)).toBeInTheDocument();
  });

  it("closes", async () => {
    const { onClose } = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Close climate detail" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
