import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

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
    <PreferencesPanel
      value={DEFAULT_PREFERENCES}
      onChange={onChange}
      onReset={onReset}
      isPremium={false}
      onUpgradeClick={onUpgradeClick}
      {...overrides}
    />,
  );
  return { onChange, onReset, onUpgradeClick };
}

const setSlider = (name: string | RegExp, value: number) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value: String(value) } });

describe("PreferencesPanel", () => {
  it("shows the current preferences as readable values", () => {
    renderPanel();
    expect(screen.getByText("18°C – 28°C")).toBeInTheDocument();
    expect(screen.getByText("2.7 mm")).toBeInTheDocument();
    expect(screen.getByText("6.0 h")).toBeInTheDocument();
  });

  it("reports each control's change with the rest of the preferences intact", () => {
    const { onChange } = renderPanel();

    setSlider("Temperature — Warmest acceptable", 24);
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_PREFERENCES, tempMax: 24 });

    setSlider("Rainfall", 1.2);
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_PREFERENCES, rainMax: 1.2 });

    setSlider("Sunshine", 9);
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_PREFERENCES, sunMin: 9 });
  });

  it("keeps the temperature thumbs from crossing", () => {
    // Dragging the upper thumb below the lower one has to pin, not invert:
    // an inverted band scores nothing at all.
    const { onChange } = renderPanel();

    setSlider("Temperature — Warmest acceptable", 4);
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_PREFERENCES, tempMax: 18 });

    onChange.mockClear();
    setSlider("Temperature — Coolest acceptable", 40);
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_PREFERENCES, tempMin: 28 });
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
    expect(sliders).toHaveLength(4);
    for (const slider of sliders) {
      expect(slider).toHaveAccessibleName();
      expect(slider).toHaveAttribute("aria-valuetext");
    }
  });
});
