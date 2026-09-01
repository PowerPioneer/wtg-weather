import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UnitProvider } from "@/components/units";
import { DEFAULT_PREFERENCES, type WeatherPreferences } from "@/lib/scoring";

import { PreferencesPanel } from "./preferences-panel";

afterEach(() => {
  cleanup();
});

function renderPanel(overrides: Partial<React.ComponentProps<typeof PreferencesPanel>> = {}) {
  const onChange = vi.fn();
  const onReset = vi.fn();
  const onUpgradeClick = vi.fn();
  render(
    // The °C/°F switch reports to the site-wide provider rather than holding
    // its own state, so the panel needs one to be switchable at all.
    <UnitProvider>
      <PreferencesPanel
        value={DEFAULT_PREFERENCES}
        onChange={onChange}
        onReset={onReset}
        isPremium={false}
        onUpgradeClick={onUpgradeClick}
        {...overrides}
      />
    </UnitProvider>,
  );
  return { onChange, onReset, onUpgradeClick };
}

const setSlider = (name: string | RegExp, value: number) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value: String(value) } });

describe("PreferencesPanel", () => {
  it("shows the current preferences as readable values", () => {
    renderPanel();
    expect(screen.getByText("22°C – 30°C")).toBeInTheDocument();
    expect(screen.getByText("12°C – 22°C")).toBeInTheDocument();
    expect(screen.getByText("6.0 h")).toBeInTheDocument();
    // Rain and safety read as words, with the numeric band in brackets — the
    // whole point of the level controls.
    expect(screen.getByText("(1–3 mm/day)")).toBeInTheDocument();
    expect(screen.getAllByText("Light rain").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reconsider travel").length).toBeGreaterThan(0);
  });

  it("maps a rainfall level onto the ceiling the scoring rule consumes", () => {
    const { onChange } = renderPanel();

    setSlider("Rainfall", 1);
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_PREFERENCES, rainMax: 1 });

    setSlider("Rainfall", 4);
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_PREFERENCES, rainMax: 10 });
  });

  it("selects the pipeline's own ceiling for the default band", () => {
    // Picking "Light rain" must land back on 2.7 rather than on the band's
    // 3.0: the map paints the baked `pref_<mm>` while the preferences are the
    // baked defaults, so a different ceiling here would recolour the map for
    // a traveller who changed nothing. See RAIN_LEVELS in `scoring.ts`.
    const { onChange } = renderPanel({
      value: { ...DEFAULT_PREFERENCES, rainMax: 10 },
    });
    setSlider("Rainfall", 2);
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_PREFERENCES,
      rainMax: DEFAULT_PREFERENCES.rainMax,
    });
  });

  it("reports a safety limit as an advisory level", () => {
    const { onChange } = renderPanel();
    setSlider("Accept advisories up to", 1);
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_PREFERENCES,
      safetyMax: 1,
    });
  });

  it("reports each control's change with the rest of the preferences intact", () => {
    const { onChange } = renderPanel();

    setSlider("Daytime high — Warmest acceptable", 28);
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_PREFERENCES, dayMax: 28 });

    setSlider("Overnight low — Coldest acceptable", 8);
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_PREFERENCES, nightMin: 8 });

    setSlider("Sunshine", 9);
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_PREFERENCES, sunMin: 9 });
  });

  it("keeps the temperature thumbs from crossing", () => {
    // Dragging the upper thumb below the lower one has to pin, not invert:
    // an inverted band scores nothing at all.
    const { onChange } = renderPanel();

    setSlider("Daytime high — Warmest acceptable", 4);
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_PREFERENCES, dayMax: 22 });

    onChange.mockClear();
    setSlider("Daytime high — Coolest acceptable", 40);
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_PREFERENCES, dayMin: 30 });
  });

  it("offers Reset only once something has actually changed", async () => {
    const custom: WeatherPreferences = { ...DEFAULT_PREFERENCES, sunMin: 9 };
    const { onReset } = renderPanel({ value: custom });

    const reset = screen.getByTestId("reset-preferences");
    expect(reset).toBeEnabled();
    await userEvent.click(reset);
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("disables Reset while the preferences are the baked defaults", () => {
    renderPanel();
    expect(screen.getByTestId("reset-preferences")).toBeDisabled();
  });

  it("counts a changed safety limit as a change worth resetting", () => {
    // `isDefaultPreferences` is blind to the safety limit on purpose — it
    // answers a question about the baked climate score. The affordance has to
    // ask the whole-set question instead, or a traveller who moved only this
    // slider is told there is nothing to reset.
    renderPanel({ value: { ...DEFAULT_PREFERENCES, safetyMax: 1 } });
    expect(screen.getByTestId("reset-preferences")).toBeEnabled();
  });

  it("switches the temperature readout to °F", async () => {
    renderPanel();
    await userEvent.click(screen.getByTestId("unit-imperial"));
    expect(screen.getByText("72°F – 86°F")).toBeInTheDocument();
  });

  it("gates the premium variables and routes a click to the upgrade flow", async () => {
    const { onUpgradeClick } = renderPanel({ isPremium: false });
    await userEvent.click(screen.getByRole("button", { name: /Snow depth/ }));
    expect(onUpgradeClick).toHaveBeenCalledWith("snow");
  });

  it("drops the upsell for a paying user", () => {
    renderPanel({ isPremium: true });
    expect(screen.queryByRole("button", { name: /Snow depth/ })).not.toBeInTheDocument();
  });

  it("gives every slider an accessible name and value", () => {
    // Native range inputs, so the browser supplies the role and the value
    // semantics; the labels are what makes two thumbs on one track legible.
    renderPanel();
    const sliders = screen.getAllByRole("slider");
    // Two thumbs each for the daytime high and the overnight low, plus
    // rainfall, sunshine and safety.
    expect(sliders).toHaveLength(7);
    for (const slider of sliders) {
      expect(slider).toHaveAccessibleName();
      expect(slider).toHaveAttribute("aria-valuetext");
    }
  });
});
