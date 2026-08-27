import { describe, expect, it } from "vitest";

import {
  UNIT_COOKIE,
  celsiusToFahrenheit,
  formatRainfallMonthly,
  formatRainfallPerDay,
  formatSnowDepth,
  formatTemperature,
  formatTemperatureDelta,
  formatTemperatureRange,
  formatWind,
  parseUnitSystem,
  temperatureUnitLabel,
} from "./units";

describe("unit parsing", () => {
  it("accepts only the two systems it knows", () => {
    expect(parseUnitSystem("metric")).toBe("metric");
    expect(parseUnitSystem("imperial")).toBe("imperial");
    expect(parseUnitSystem("Imperial")).toBeNull();
    expect(parseUnitSystem(undefined)).toBeNull();
    expect(parseUnitSystem(1)).toBeNull();
  });

  it("names the cookie the provider reads", () => {
    expect(UNIT_COOKIE).toBe("wtg_unit");
  });
});

describe("temperature", () => {
  it("converts and labels", () => {
    expect(formatTemperature(0)).toBe("0°C");
    expect(formatTemperature(0, "imperial")).toBe("32°F");
    expect(formatTemperature(28, "imperial")).toBe("82°F");
    expect(celsiusToFahrenheit(-40)).toBe(-40);
    expect(temperatureUnitLabel("imperial")).toBe("°F");
  });

  it("drops a decimal on the imperial side", () => {
    // 0.1 °F is finer than a 10-year monthly mean supports.
    expect(formatTemperature(22.35, "metric", { digits: 1 })).toBe("22.4°C");
    expect(formatTemperature(22.35, "imperial", { digits: 1 })).toBe("72°F");
  });

  it("renders a range with one suffix", () => {
    expect(formatTemperatureRange(18, 28)).toBe("18 – 28 °C");
    expect(formatTemperatureRange(18, 28, "imperial")).toBe("64 – 82 °F");
  });

  it("converts a difference by the ratio, without the offset", () => {
    // The trap: 5 °C warmer is 9 °F warmer, not 41 °F.
    expect(formatTemperatureDelta(5, "imperial")).toBe("9.0°F");
    expect(formatTemperatureDelta(0, "imperial")).toBe("0.0°F");
    expect(formatTemperatureDelta(2.5)).toBe("2.5°C");
  });
});

describe("rainfall, wind and snow", () => {
  it("gives daily rainfall enough precision to be readable in inches", () => {
    expect(formatRainfallPerDay(3)).toBe("3.0 mm/day");
    expect(formatRainfallPerDay(3, "imperial")).toBe("0.12 in/day");
  });

  it("rounds a monthly total in mm and keeps a decimal in inches", () => {
    expect(formatRainfallMonthly(47.4)).toBe("47 mm");
    expect(formatRainfallMonthly(47.4, "imperial")).toBe("1.9 in");
  });

  it("converts wind and snow", () => {
    expect(formatWind(30, "imperial", { digits: 0 })).toBe("19 mph");
    expect(formatSnowDepth(25, "imperial")).toBe("9.8 in");
  });
});
