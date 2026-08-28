/**
 * Measurement units — pure conversions and formatters, no React, no DOM.
 *
 * The whole site stores and scores in metric: the pipeline publishes °C, mm and
 * km/h, `scoring.ts` compares against °C and mm/day, and the tiles bake metric
 * values into every polygon. Imperial exists only at the moment a number is
 * turned into text, which is why everything here takes a metric value and
 * returns a string rather than converting anything upstream.
 *
 * Why the preference is resolved in the browser rather than on the server:
 * country and month pages are statically generated (~2,800 documents), so one
 * HTML file serves every visitor and a per-request `cookies()` read in a layout
 * would opt the whole app out of static generation — `web/CLAUDE.md` forbids
 * exactly that. So the server always renders metric (which is also what a
 * crawler and a no-JS reader get, and what the OG images bake), and
 * `UnitProvider` swaps the text after hydration for a visitor who chose
 * imperial. Progressive enhancement, per the same file's SSR rule.
 */

export type UnitSystem = "metric" | "imperial";

export const DEFAULT_UNIT: UnitSystem = "metric";

/**
 * Readable (not HttpOnly) on purpose, and the one deliberate exception to
 * `web/CLAUDE.md`'s "HttpOnly cookie set via API" rule for preferences.
 *
 * The rule exists to keep preferences off `localStorage` and out of a single
 * device; the reason it cannot apply here is mechanical rather than a
 * preference: the value has to be read by client JS on a statically generated
 * page, and client JS cannot read an HttpOnly cookie. It carries no secret and
 * no personal data — it is one of two words — and for a signed-in user it is
 * mirrored into their account record so it still follows them between devices.
 */
export const UNIT_COOKIE = "wtg_unit";

/** A year: this is a stated preference, not a session detail. */
export const UNIT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isUnitSystem(value: unknown): value is UnitSystem {
  return value === "metric" || value === "imperial";
}

/** Narrow anything — a cookie, a query param, a stored blob — to a unit. */
export function parseUnitSystem(value: unknown): UnitSystem | null {
  return isUnitSystem(value) ? value : null;
}

// ─── Conversions ─────────────────────────────────────────────────────

export function celsiusToFahrenheit(c: number): number {
  return c * 1.8 + 32;
}

export function millimetresToInches(mm: number): number {
  return mm / 25.4;
}

export function kmhToMph(kmh: number): number {
  return kmh / 1.609344;
}

export function centimetresToInches(cm: number): number {
  return cm / 2.54;
}

// ─── Formatters ──────────────────────────────────────────────────────
//
// Each takes the metric value the data is published in. `digits` is the
// metric precision; the imperial rendering picks its own, because the same
// number of decimals means something different either side of a ×1.8 scale
// (0.1 °C is a tenth of a degree; 0.1 °F is finer than the data supports) and
// a rainfall figure that reads "3 mm" reads "0.1 in" at the same precision.

export type TemperatureOptions = {
  /** Decimal places for the metric rendering. Imperial uses one fewer, min 0. */
  digits?: number;
  /** Include the unit suffix. */
  unitSuffix?: boolean;
  /** Space between number and suffix — off for "28°C", on for "28 °C". */
  space?: boolean;
};

export function formatTemperature(
  celsius: number,
  unit: UnitSystem = DEFAULT_UNIT,
  { digits = 0, unitSuffix = true, space = false }: TemperatureOptions = {},
): string {
  const imperial = unit === "imperial";
  const value = imperial ? celsiusToFahrenheit(celsius) : celsius;
  const places = imperial ? Math.max(0, digits - 1) : digits;
  const gap = space ? " " : "";
  return `${value.toFixed(places)}${unitSuffix ? `${gap}${imperial ? "°F" : "°C"}` : ""}`;
}

/**
 * A temperature *difference*, which converts by the ratio alone — 5 °C warmer
 * is 9 °F warmer, not 41. Passing a delta through `formatTemperature` adds the
 * freezing-point offset and turns "+2.0 °C vs. the national mean" into
 * "+35.6 °F", which is the kind of wrong that reads as plausible.
 */
export function formatTemperatureDelta(
  celsiusDelta: number,
  unit: UnitSystem = DEFAULT_UNIT,
  { digits = 1, space = false }: { digits?: number; space?: boolean } = {},
): string {
  const imperial = unit === "imperial";
  const value = imperial ? celsiusDelta * 1.8 : celsiusDelta;
  const gap = space ? " " : "";
  return `${value.toFixed(digits)}${gap}${imperial ? "°F" : "°C"}`;
}

/** Just the suffix — for chart axes and legends that label a whole series. */
export function temperatureUnitLabel(unit: UnitSystem = DEFAULT_UNIT): string {
  return unit === "imperial" ? "°F" : "°C";
}

/**
 * Daily rainfall. Inches per day are small numbers — 3 mm/day is 0.12 in/day —
 * so imperial keeps two decimals where metric keeps one.
 */
export function formatRainfallPerDay(
  mmPerDay: number,
  unit: UnitSystem = DEFAULT_UNIT,
  { digits = 1, unitSuffix = true }: { digits?: number; unitSuffix?: boolean } = {},
): string {
  if (unit === "imperial") {
    const value = millimetresToInches(mmPerDay);
    return `${value.toFixed(2)}${unitSuffix ? " in/day" : ""}`;
  }
  return `${mmPerDay.toFixed(digits)}${unitSuffix ? " mm/day" : ""}`;
}

/** Monthly rainfall total — the figure the country pages print. */
export function formatRainfallMonthly(
  mm: number,
  unit: UnitSystem = DEFAULT_UNIT,
  { unitSuffix = true }: { unitSuffix?: boolean } = {},
): string {
  if (unit === "imperial") {
    return `${millimetresToInches(mm).toFixed(1)}${unitSuffix ? " in" : ""}`;
  }
  return `${Math.round(mm)}${unitSuffix ? " mm" : ""}`;
}

export function rainfallUnitLabel(
  unit: UnitSystem = DEFAULT_UNIT,
  per: "day" | "month" = "day",
): string {
  const base = unit === "imperial" ? "in" : "mm";
  return per === "day" ? `${base}/day` : base;
}

export function formatWind(
  kmh: number,
  unit: UnitSystem = DEFAULT_UNIT,
  { digits = 1, unitSuffix = true }: { digits?: number; unitSuffix?: boolean } = {},
): string {
  const imperial = unit === "imperial";
  const value = imperial ? kmhToMph(kmh) : kmh;
  return `${value.toFixed(digits)}${unitSuffix ? (imperial ? " mph" : " km/h") : ""}`;
}

export function formatSnowDepth(
  cm: number,
  unit: UnitSystem = DEFAULT_UNIT,
  { unitSuffix = true }: { unitSuffix?: boolean } = {},
): string {
  if (unit === "imperial") {
    return `${centimetresToInches(cm).toFixed(1)}${unitSuffix ? " in" : ""}`;
  }
  return `${Math.round(cm)}${unitSuffix ? " cm" : ""}`;
}

/** "18 – 28 °C" / "64 – 82 °F". One suffix, not two. */
export function formatTemperatureRange(
  lowC: number,
  highC: number,
  unit: UnitSystem = DEFAULT_UNIT,
  { digits = 0, separator = " – " }: { digits?: number; separator?: string } = {},
): string {
  const low = formatTemperature(lowC, unit, { digits, unitSuffix: false });
  const high = formatTemperature(highC, unit, { digits, unitSuffix: false });
  return `${low}${separator}${high} ${temperatureUnitLabel(unit)}`;
}

/**
 * Sunshine hours are unit-agnostic — there is no imperial hour. Here so that a
 * caller formatting a row of stats does not have to special-case the one
 * variable that never converts.
 */
export function formatSunHours(hours: number, { digits = 1 } = {}): string {
  return `${hours.toFixed(digits)} h/day`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Measurements inside generated prose
 *
 * The pipeline publishes some fields as finished English sentences rather than
 * as numbers — a country's `summary`, its twelve `monthNotes`, each
 * `bestMonths[].note`:
 *
 *   "Peru's national averages run from 18 °C in July to 20 °C in November,
 *    with rainfall between 69 mm in July and 294 mm in March…"
 *   "Around 19 °C with 243 mm of rain and 8.7 hours of sun a day."
 *   "19 °C · 76 mm · 9.6 h sun"
 *
 * Nothing downstream can convert those the way a readout converts, because by
 * the time the web sees them the numbers are prose. Left alone they are the
 * loudest text on the page: a country page in Fahrenheit had 52 of them, so
 * the summary paragraph said 18 °C directly above a stat card saying 64 °F.
 *
 * This rewrites the measurements in place. It is a workaround and should be
 * read as one — the durable fix is for `wtg publish api-data` to emit the
 * numbers and let the web write the sentence, which is a pipeline change and a
 * republish. Two things keep the workaround honest in the meantime:
 *
 *   - it only ever runs for a reader who asked for imperial, so the metric
 *     site renders the pipeline's bytes exactly as published; and
 *   - it matches a number *immediately* followed by a known unit, so text it
 *     does not recognise is returned untouched rather than half-converted.
 * ──────────────────────────────────────────────────────────────────────────── */

/** `18`, `7.9`, `-3` — and the en-dash ranges the pipeline writes. */
const NUMBER = String.raw`-?\d+(?:\.\d+)?`;

/**
 * Inches at a precision that stays informative on both sides of the range the
 * pipeline prints: a monthly total (69 mm → 2.7 in) and a daily mean
 * (2.7 mm → 0.11 in) would otherwise round to the same uselessness.
 *
 * Returns the number only; the caller supplies the unit, because prose and
 * readouts want different ones — see `PROSE_INCHES`.
 */
function inchesText(mm: number): string {
  const inches = millimetresToInches(mm);
  return inches < 0.5 ? inches.toFixed(2) : inches.toFixed(1);
}

/**
 * Sentences say "inches", not "in".
 *
 * The abbreviation collides with the preposition, and the pipeline's sentences
 * are full of both: "rainfall between 2.7 in in July and 11.6 in in March"
 * is technically correct and unreadable. Readouts keep the abbreviation — a
 * stat card is a label, not a sentence.
 */
const PROSE_INCHES = "inches";

export function convertMeasurementsInText(
  text: string,
  unit: UnitSystem = DEFAULT_UNIT,
): string {
  if (unit !== "imperial" || !text) return text;

  return (
    text
      // "18–28 °C" — both ends, one suffix. Before the single-value rule, or
      // that rule would eat the first number and orphan the second.
      .replace(
        new RegExp(String.raw`(${NUMBER})\s*[–-]\s*(${NUMBER})\s*°C`, "g"),
        (_m, lo: string, hi: string) =>
          `${Math.round(celsiusToFahrenheit(Number(lo)))}–${Math.round(
            celsiusToFahrenheit(Number(hi)),
          )} °F`,
      )
      .replace(
        new RegExp(String.raw`(${NUMBER})\s*°C`, "g"),
        (_m, value: string) =>
          `${Math.round(celsiusToFahrenheit(Number(value)))} °F`,
      )
      // "69 mm in July", "2.7 mm of rain a day" — the denominator, where there
      // is one, is the sentence's own and survives untouched.
      .replace(
        new RegExp(String.raw`(${NUMBER})\s*[–-]\s*(${NUMBER})\s*mm\b`, "g"),
        (_m, lo: string, hi: string) =>
          `${inchesText(Number(lo))}–${inchesText(Number(hi))} ${PROSE_INCHES}`,
      )
      .replace(
        new RegExp(String.raw`(${NUMBER})\s*mm\b`, "g"),
        (_m, value: string) => `${inchesText(Number(value))} ${PROSE_INCHES}`,
      )
      // "under 30 km/h" — the only speed the generated prose carries.
      .replace(
        new RegExp(String.raw`(${NUMBER})\s*km/h`, "g"),
        (_m, value: string) => `${Math.round(kmhToMph(Number(value)))} mph`,
      )
  );
}
