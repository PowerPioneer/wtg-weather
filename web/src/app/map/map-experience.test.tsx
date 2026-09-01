import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { monthKey } from "@/lib/feature-climate";
import { DEFAULT_PREFERENCES } from "@/lib/scoring";

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

// A real, stateful stand-in for the nuqs-backed hook — the preference tests
// need the map's state to actually move when a slider does.
vi.mock("@/hooks/use-map-state", async () => {
  const { useState } = await import("react");
  const { DEFAULT_PREFERENCES: defaults, clampPreferences } = await import(
    "@/lib/scoring"
  );
  return {
    useMapState: () => {
      const [mode, setMode] = useState("preferences");
      const [month, setMonth] = useState(4);
      const [preferences, setPrefs] = useState(defaults);
      return {
        mode,
        month,
        unit: "metric",
        preferences,
        setMode,
        setMonth,
        setUnit: vi.fn(),
        setPreferences: (next: unknown) =>
          setPrefs(clampPreferences(next as Partial<typeof defaults>)),
        resetPreferences: () => setPrefs(defaults),
      };
    },
  };
});

// The preference store is an API round trip; anonymous is the default here, so
// nothing is read and nothing is written.
const fetchOnboarding = vi.fn(async () => null);
const patchOnboarding = vi.fn(async () => ({
  kind: null,
  step: 0,
  completed: false,
  data: {},
}));
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>(
    "@/lib/api-client",
  );
  return { ...actual, fetchOnboarding, patchOnboarding };
});

// Stand-in for MapLibre: two buttons that hand the page the same feature
// objects the real canvas would hand it on a click.
vi.mock("@/components/map/map-canvas", () => ({
  MapCanvas: ({
    onFeatureSelect,
    onFeatureHover,
    selectedFeatureId,
    preferences,
    freeTilesUrl,
  }: {
    onFeatureSelect?: (feature: unknown) => void;
    onFeatureHover?: (hover: unknown) => void;
    selectedFeatureId?: string | null;
    preferences?: unknown;
    freeTilesUrl?: string | null;
  }) => (
    <div
      data-testid="canvas"
      data-selected-id={selectedFeatureId ?? ""}
      data-prefs={JSON.stringify(preferences ?? null)}
      data-free-url={freeTilesUrl ?? ""}
    >
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
  fetchOnboarding.mockClear();
  patchOnboarding.mockClear();
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

/**
 * "My Preferences" was a display mode with no preferences behind it: the map
 * painted `pref_<mm>`, a score the pipeline baked in from its own defaults, and
 * no control anywhere could change it.
 */
describe("MapExperience preferences", () => {
  const openPanel = async () => {
    render(<MapExperience isPremium={false} publishedCountrySlugs={["georgia"]} />);
    await userEvent.click(await screen.findByTestId("open-preferences"));
    return screen.getByTestId("preferences-panel");
  };

  const setSlider = (name: string, value: number) =>
    fireEvent.change(screen.getByLabelText(name), { target: { value: String(value) } });

  /** Narrow the daytime band to 5–15°C, lower thumb first so it can move. */
  const chooseCoolWeather = () => {
    setSlider("Daytime high — Coolest acceptable", 5);
    setSlider("Daytime high — Warmest acceptable", 15);
  };

  it("starts at the defaults the pipeline baked into the tiles", async () => {
    await openPanel();
    expect(screen.getByTestId("canvas")).toHaveAttribute(
      "data-prefs",
      JSON.stringify(DEFAULT_PREFERENCES),
    );
    expect(screen.getByTestId("open-preferences")).toHaveTextContent("Default");
  });

  it("hands changed preferences to the map without changing the tile URL", async () => {
    await openPanel();
    const before = screen.getByTestId("canvas").getAttribute("data-free-url");

    chooseCoolWeather();

    const canvas = screen.getByTestId("canvas");
    expect(JSON.parse(canvas.getAttribute("data-prefs") ?? "{}")).toMatchObject({
      dayMin: 5,
      dayMax: 15,
    });
    // Preference changes must never re-sign or refetch tiles — the score is
    // computed from properties already in the loaded features.
    expect(canvas.getAttribute("data-free-url")).toBe(before);
    expect(screen.getByTestId("open-preferences")).toHaveTextContent("Custom");
  });

  it("rescoring reaches the climate panel, not just the map colours", async () => {
    // Georgia in April: 9°C, 5 mm/day, 7 h sun. The baked default score is 82
    // ("Good option"); against a 5–15°C preference the rain is the only hard
    // miss, which is 60 ("Acceptable").
    await openPanel();
    await userEvent.click(screen.getByRole("button", { name: "click georgia" }));
    const panel = within(await screen.findByTestId("climate-panel"));
    expect(panel.getByText("Good option")).toBeInTheDocument();
    expect(panel.getByText(/default preferences/)).toBeInTheDocument();

    chooseCoolWeather();

    expect(panel.getByText("Acceptable")).toBeInTheDocument();
    expect(panel.getByText(/your preferences/)).toBeInTheDocument();
  });

  it("switches back to the preferences layer so a slider visibly does something", async () => {
    await openPanel();
    await userEvent.click(screen.getByTestId("open-display-mode"));
    await userEvent.click(await screen.findByRole("button", { name: /Temperature/ }));
    expect(screen.getByTestId("open-display-mode")).toHaveTextContent("Temperature");

    chooseCoolWeather();

    expect(screen.getByTestId("open-display-mode")).toHaveTextContent("My Preferences");
  });

  it("restores the baked defaults on reset", async () => {
    await openPanel();
    chooseCoolWeather();
    expect(screen.getByTestId("reset-preferences")).toBeEnabled();

    await userEvent.click(screen.getByTestId("reset-preferences"));

    expect(screen.getByTestId("canvas")).toHaveAttribute(
      "data-prefs",
      JSON.stringify(DEFAULT_PREFERENCES),
    );
  });

  it("does not write preferences for a signed-out visitor", async () => {
    // `fetchOnboarding` answers null on a 401; writing after that would be a
    // request per slider drag that can only ever fail.
    await openPanel();
    chooseCoolWeather();
    await vi.waitFor(() => expect(fetchOnboarding).toHaveBeenCalled());
    expect(patchOnboarding).not.toHaveBeenCalled();
  });
});
