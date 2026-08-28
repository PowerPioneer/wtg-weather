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
  convertMeasurementsInText,
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

/**
 * The pipeline publishes some fields as finished sentences, so their numbers
 * cannot be converted the way a readout is. These are the exact strings
 * `/srv/wtg-data/countries/peru.json` carries in production.
 */
describe("measurements inside generated prose", () => {
  const SUMMARY =
    "Peru's national averages run from 18 °C in July to 20 °C in November, " +
    "with rainfall between 69 mm in July and 294 mm in March and 7.9–9.6 hours " +
    "of sun a day. Against the default preferences (18–28 °C, under 2.7 mm " +
    "of rain a day, at least 6 hours of sun), the strongest months are August, " +
    "June and July. Its 26 regions span 7–26 °C in annual mean.";

  it("leaves metric readers the pipeline's own bytes", () => {
    expect(convertMeasurementsInText(SUMMARY, "metric")).toBe(SUMMARY);
    expect(convertMeasurementsInText(SUMMARY)).toBe(SUMMARY);
  });

  it("converts every temperature, single and ranged", () => {
    const out = convertMeasurementsInText(SUMMARY, "imperial");
    expect(out).not.toContain("°C");
    expect(out).toContain("64 °F in July");
    expect(out).toContain("68 °F in November");
    // The range keeps one suffix and converts both ends.
    expect(out).toContain("64–82 °F");
    expect(out).toContain("45–79 °F");
  });

  it("converts rainfall at a precision that survives both denominators", () => {
    const out = convertMeasurementsInText(SUMMARY, "imperial");
    // A monthly total and a daily mean appear in the same sentence.
    expect(out).toContain("2.7 in in July");
    expect(out).toContain("11.6 in in March");
    expect(out).toContain("0.11 in of rain a day");
    expect(out).not.toMatch(/mm/);
  });

  it("leaves hours, months and everything else alone", () => {
    const out = convertMeasurementsInText(SUMMARY, "imperial");
    expect(out).toContain("7.9–9.6 hours of sun a day");
    expect(out).toContain("at least 6 hours of sun");
    expect(out).toContain("Its 26 regions");
    expect(out).toContain("the strongest months are August, June and July");
  });

  it("handles the short note forms", () => {
    expect(
      convertMeasurementsInText(
        "Around 19 °C with 243 mm of rain and 8.7 hours of sun a day.",
        "imperial",
      ),
    ).toBe("Around 66 °F with 9.6 in of rain and 8.7 hours of sun a day.");
    expect(
      convertMeasurementsInText("19 °C · 76 mm · 9.6 h sun", "imperial"),
    ).toBe("66 °F · 3.0 in · 9.6 h sun");
  });

  it("converts a wind ceiling where one appears", () => {
    expect(convertMeasurementsInText("under 30 km/h", "imperial")).toBe(
      "under 19 mph",
    );
  });

  it("returns text it does not recognise untouched", () => {
    // No number attached to a unit it knows: nothing to do, and nothing broken.
    const prose = "A dry season that runs from May to September.";
    expect(convertMeasurementsInText(prose, "imperial")).toBe(prose);
    expect(convertMeasurementsInText("", "imperial")).toBe("");
  });
});
