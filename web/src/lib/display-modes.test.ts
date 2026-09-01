import { describe, expect, it } from "vitest";

import {
  DISPLAY_MODES,
  DISPLAY_MODE_ORDER,
  formatModeValue,
  modeDigits,
  modeLegendSub,
  modeLegendTicks,
  modeUnitLabel,
  modeValue,
  type DisplayMode,
} from "./display-modes";

const MODES = DISPLAY_MODE_ORDER.map((id) => DISPLAY_MODES[id]);

/** The number inside a tick label — "< 32°" → 32, "> 0.6" → 0.6, "0" → 0. */
function tickNumber(label: string): number | null {
  const m = label.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

describe("imperial labels", () => {
  it("declares a converter for exactly the modes that name an imperial unit", () => {
    // The pair has to move together: a unit with no converter would relabel a
    // number without changing it, which is the bug the charts used to have.
    for (const mode of MODES) {
      expect(
        mode.unitImperial != null,
        `${mode.id}: unitImperial and toImperial disagree`,
      ).toBe(mode.toImperial != null);
    }
  });

  it("converts every unit that has an imperial form, and no others", () => {
    const converting = MODES.filter((m) => m.toImperial).map((m) => m.id);
    // Hours of sunshine and % humidity are the same number in both systems;
    // the qualitative and advisory modes carry no measurement at all.
    expect(converting.sort()).toEqual(
      ["heat", "rainfall", "snow", "sst", "temperature", "wind"].sort(),
    );
  });

  /**
   * The load-bearing test. The imperial ticks are hand-written, so this pins
   * each one to the conversion of the metric tick it replaces — a legend whose
   * caption says °F over labels that are still Celsius is exactly the failure
   * this pair of fields exists to prevent, and it is invisible by eye.
   */
  it("writes each imperial tick as the conversion of its metric twin", () => {
    for (const mode of MODES) {
      const legend = mode.legend;
      if (!("ramp" in legend) || !legend.ticksImperial) continue;

      expect(legend.ticksImperial, `${mode.id}: tick count`).toHaveLength(
        legend.ticks.length,
      );

      legend.ticks.forEach((metricTick, i) => {
        const metric = tickNumber(metricTick);
        const imperial = tickNumber(legend.ticksImperial![i]);
        expect(metric, `${mode.id} tick ${i}: unparseable metric`).not.toBeNull();
        expect(imperial, `${mode.id} tick ${i}: unparseable imperial`).not.toBeNull();

        const expected = mode.toImperial!(metric!);
        // Within half a unit of the last decimal the label actually shows.
        const places = (legend.ticksImperial![i].split(".")[1] ?? "").length;
        expect(
          Math.abs(imperial! - expected),
          `${mode.id} tick ${i}: "${metricTick}" → "${legend.ticksImperial![i]}", expected ≈ ${expected.toFixed(2)}`,
        ).toBeLessThanOrEqual(0.5 * 10 ** -places + 1e-9);
      });
    }
  });

  it("keeps the comparison operators the metric ticks used", () => {
    // "< 0°" must not become "32°" — the ramp still runs off the bottom.
    for (const mode of MODES) {
      const legend = mode.legend;
      if (!("ramp" in legend) || !legend.ticksImperial) continue;
      legend.ticks.forEach((metricTick, i) => {
        const operator = metricTick.match(/^[<>]/)?.[0] ?? "";
        expect(
          legend.ticksImperial![i].startsWith(operator),
          `${mode.id} tick ${i}: lost the "${operator}"`,
        ).toBe(true);
      });
    }
  });

  it("never moves the colour stops", () => {
    // They are compared against metric tile values by the paint expression.
    // Nothing in this file may offer an imperial alternative for them.
    for (const mode of MODES) {
      expect(Object.keys(mode.legend)).not.toContain("stopsImperial");
    }
  });
});

describe("reading a mode in the traveller's units", () => {
  const temperature = DISPLAY_MODES.temperature;
  const sunshine = DISPLAY_MODES.sunshine;

  it("answers metric with the metric label and value", () => {
    expect(modeUnitLabel(temperature, "metric")).toBe("°C");
    expect(modeValue(temperature, 20, "metric")).toBe(20);
    expect(formatModeValue(temperature, 20, "metric")).toBe("20.0 °C");
  });

  it("answers imperial with the converted pair", () => {
    expect(modeUnitLabel(temperature, "imperial")).toBe("°F");
    expect(modeValue(temperature, 20, "imperial")).toBeCloseTo(68, 5);
    expect(formatModeValue(temperature, 20, "imperial")).toBe("68 °F");
  });

  it("falls back to metric for a mode with no imperial form", () => {
    // The caller never has to ask which modes convert.
    expect(modeUnitLabel(sunshine, "imperial")).toBe("h/day");
    expect(modeValue(sunshine, 8.4, "imperial")).toBe(8.4);
    expect(formatModeValue(sunshine, 8.4, "imperial")).toBe("8.4 h/day");
    expect(modeDigits(sunshine, "imperial")).toBe(1);
  });

  it("gives daily rainfall the precision inches need", () => {
    const rain = DISPLAY_MODES.rainfall;
    expect(formatModeValue(rain, 3, "metric")).toBe("3.0 mm/day");
    expect(formatModeValue(rain, 3, "imperial")).toBe("0.12 in/day");
  });

  it("switches the legend caption and ticks together", () => {
    expect(modeLegendSub(temperature, "metric")).toBe("°C");
    expect(modeLegendSub(temperature, "imperial")).toBe("°F");
    expect(modeLegendTicks(temperature, "metric")).toEqual(["< 5°", "20°", "> 35°"]);
    expect(modeLegendTicks(temperature, "imperial")).toEqual([
      "< 41°",
      "68°",
      "> 95°",
    ]);
  });

  it("leaves a binned legend alone", () => {
    // Safety and the preference score have no numeric ramp to relabel.
    const safety: DisplayMode = DISPLAY_MODES.safety;
    expect(modeLegendTicks(safety, "imperial")).toEqual([]);
    expect(modeLegendSub(safety, "imperial")).toBe(safety.legend.sub);
  });
});
