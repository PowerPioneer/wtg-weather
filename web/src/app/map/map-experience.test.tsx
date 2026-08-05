import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { monthKey } from "@/lib/feature-climate";

/**
 * The bug this covers: `handleFeatureSelect` looked the clicked feature's
 * `iso_a2` up in a nine-entry registry and `return`ed on a miss, so clicking
 * anywhere outside those nine countries — Georgia included — did nothing
 * whatsoever, with no error and no telemetry.
 */

const trackEvent = vi.fn();
vi.mock("@/lib/analytics", async () => {
  const actual = await vi.importActual<typeof import("@/lib/analytics")>(
    "@/lib/analytics",
  );
  return { ...actual, trackEvent };
});

vi.mock("@/hooks/use-tile-urls", () => ({
  useTileUrls: () => ({
    freeUrl: "https://cdn.test/free.pmtiles?sig=aaa",
    premiumUrl: null,
    error: null,
    premiumDenied: false,
  }),
}));

vi.mock("@/hooks/use-map-state", () => ({
  useMapState: () => ({
    mode: "preferences",
    month: 4,
    unit: "metric",
    setMode: vi.fn(),
    setMonth: vi.fn(),
    setUnit: vi.fn(),
  }),
}));

// Stand-in for MapLibre: two buttons that hand the page the same feature
// objects the real canvas would hand it on a click.
vi.mock("@/components/map/map-canvas", () => ({
  MapCanvas: ({
    onFeatureSelect,
    onFeatureHover,
    selectedFeatureId,
  }: {
    onFeatureSelect?: (feature: unknown) => void;
    onFeatureHover?: (hover: unknown) => void;
    selectedFeatureId?: string | null;
  }) => (
    <div data-testid="canvas" data-selected-id={selectedFeatureId ?? ""}>
      <button type="button" onClick={() => onFeatureSelect?.({ properties: GEORGIA })}>
        click georgia
      </button>
      <button type="button" onClick={() => onFeatureSelect?.({ properties: UNKNOWN })}>
        click unknown
      </button>
      <button
        type="button"
        onClick={() =>
          onFeatureHover?.({ feature: { properties: GEORGIA }, point: { x: 40, y: 60 } })
        }
      >
        hover georgia
      </button>
      <button type="button" onClick={() => onFeatureHover?.(null)}>
        hover out
      </button>
    </div>
  ),
}));

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
  ...monthly("pref", 78),
};

// A polygon the pipeline paints but leaves unroutable — no ISO-2 code.
const UNKNOWN = {
  id: "SOL",
  iso_a2: "",
  admin1_code: "",
  name: "Somaliland",
  level: "country",
  ...monthly("t", 20),
};

const { MapExperience } = await import("./map-experience");

beforeEach(() => {
  trackEvent.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("MapExperience feature selection", () => {
  it("opens the climate panel for a country the old registry did not know", async () => {
    render(<MapExperience isPremium={false} publishedCountrySlugs={["georgia"]} />);
    await userEvent.click(await screen.findByRole("button", { name: "click georgia" }));

    const panel = await screen.findByTestId("climate-panel");
    expect(panel).toHaveAttribute("data-feature-id", "GEO");
    expect(screen.getByRole("heading", { name: "Georgia" })).toBeInTheDocument();
    expect(screen.getByTestId("view-country-page")).toHaveAttribute("href", "/georgia");
  });

  it("outlines the selected polygon on the map", async () => {
    render(<MapExperience isPremium={false} publishedCountrySlugs={["georgia"]} />);
    await userEvent.click(await screen.findByRole("button", { name: "click georgia" }));
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-selected-id", "GEO");
  });

  it("tracks the selection, including a registry miss", async () => {
    render(<MapExperience isPremium={false} publishedCountrySlugs={["georgia"]} />);
    await userEvent.click(await screen.findByRole("button", { name: "click georgia" }));
    expect(trackEvent).toHaveBeenCalledWith("map_feature_select", {
      iso_a2: "GE",
      level: "country",
      registry_miss: false,
    });

    trackEvent.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "click unknown" }));
    expect(trackEvent).toHaveBeenCalledWith("map_feature_select", {
      iso_a2: "none",
      level: "country",
      registry_miss: true,
    });
  });

  it("still shows a panel for a polygon with no country page", async () => {
    render(<MapExperience isPremium={false} publishedCountrySlugs={["georgia"]} />);
    await userEvent.click(await screen.findByRole("button", { name: "click unknown" }));

    expect(await screen.findByTestId("climate-panel")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Somaliland" })).toBeInTheDocument();
    expect(screen.queryByTestId("view-country-page")).not.toBeInTheDocument();
  });

  it("shows a hover card while the pointer is over a polygon", async () => {
    render(<MapExperience isPremium={false} publishedCountrySlugs={["georgia"]} />);
    await userEvent.click(await screen.findByRole("button", { name: "hover georgia" }));

    const card = await screen.findByRole("tooltip", { hidden: true });
    expect(card).toHaveTextContent("Georgia");
    expect(card).toHaveTextContent("Apr · default preferences");

    await userEvent.click(screen.getByRole("button", { name: "hover out" }));
    expect(screen.queryByRole("tooltip", { hidden: true })).not.toBeInTheDocument();
  });

  it("does not offer a country page that has not been published", async () => {
    // The registry names all 237 countries; the SSR pages exist only for the
    // slugs the data path can answer for, so the CTA has to be gated on the
    // published set or it links straight into a 404.
    render(<MapExperience isPremium={false} publishedCountrySlugs={[]} />);
    await userEvent.click(await screen.findByRole("button", { name: "click georgia" }));

    expect(await screen.findByTestId("climate-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("view-country-page")).not.toBeInTheDocument();
    expect(screen.getByText(/Georgia country page is not published yet/i)).toBeInTheDocument();
  });

  it("closes the panel on Escape", async () => {
    render(<MapExperience isPremium={false} publishedCountrySlugs={["georgia"]} />);
    await userEvent.click(await screen.findByRole("button", { name: "click georgia" }));
    expect(await screen.findByTestId("climate-panel")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByTestId("climate-panel")).not.toBeInTheDocument();
  });
});
