/**
 * Display-mode catalog for the map. Mirrors `web/design/display-mode/variables.js`
 * but typed, runtime-free, and importable from both RSC and Client Components.
 *
 * Ten modes in four groups (hero / climate / advisory / premium). Each mode
 * declares how the map colours polygons (`kind`) and how the legend renders
 * (`legend`). The paint expressions in `lib/map-style.ts` dispatch on `kind`.
 *
 * The imperial labels are written out rather than computed. Three labels per
 * mode is a small enough table to read and check, and the alternative —
 * parsing "< 0°" and "> 15" back into numbers at render time — would be
 * guesswork over strings that already carry their own comparison operators.
 * `display-modes.test.ts` pins every one of them to the real conversion, so a
 * hand-written label cannot drift from the ramp it describes.
 */

import {
  celsiusToFahrenheit,
  centimetresToInches,
  kmhToMph,
  millimetresToInches,
  type UnitSystem,
} from "./units";

export type DisplayModeId =
  | "preferences"
  | "temperature"
  | "rainfall"
  | "sunshine"
  | "wind"
  | "safety"
  | "snow"
  | "sst"
  | "heat"
  | "humidity";

export type DisplayModeKind =
  | "qualitative"       // 4-bin preferences score
  | "diverging"         // temperature
  | "diverging-ocean"   // SST — land dimmed
  | "sequential"        // rainfall / sunshine / wind / snow / heat / humidity
  | "ordinal-safety";   // 4-level advisory

export type DisplayModeTier = "free" | "premium";

export type LegendBin = { label: string; hex: string };

export type DisplayMode = {
  id: DisplayModeId;
  label: string;
  tier: DisplayModeTier;
  kind: DisplayModeKind;
  /** Feature property prefix — the pipeline writes `<prop>_01` … `<prop>_12` per month. */
  prop: string;
  unit: string;
  /**
   * The same unit for a traveller reading in imperial. Absent where there is
   * no imperial form — an hour of sunshine and a percentage of humidity are
   * the same number in both systems.
   */
  unitImperial?: string;
  /** Metric value → imperial value. Present exactly when `unitImperial` is. */
  toImperial?: (value: number) => number;
  /** Decimals for the imperial readout; the metric one keeps its own. */
  imperialDigits?: number;
  desc: string;
  infoTooltip?: string;
  legend:
    | { title: string; sub: string; bins: LegendBin[] }
    | {
        title: string;
        sub: string;
        ramp: string[];
        ticks: string[];
        stops: number[];
        /**
         * Imperial wording for the two label rows. `stops` is deliberately
         * absent: those are the thresholds the paint expression compares
         * against metric tile values, so they must never move. Only what is
         * written under the ramp changes — which is the whole bug this pair
         * of fields fixes, because a legend that converted its caption and
         * not its ticks would be the same lie the charts used to tell.
         */
        subImperial?: string;
        ticksImperial?: string[];
      };
};

// Numeric stops are the thresholds that split the ramp into bins. The ramp
// array has one colour per bin, so `stops.length === ramp.length - 1`.
export const DISPLAY_MODES: Record<DisplayModeId, DisplayMode> = {
  preferences: {
    id: "preferences",
    label: "My Preferences",
    tier: "free",
    kind: "qualitative",
    prop: "pref",
    unit: "match",
    desc: "Your ideal weather score — Perfect, Good, Acceptable, or Avoid.",
    legend: {
      title: "Match quality",
      sub: "Based on your preferences",
      bins: [
        { label: "Perfect", hex: "#0B6E5F" },
        { label: "Good", hex: "#0072B2" },
        { label: "Acceptable", hex: "#B55F0E" },
        { label: "Avoid", hex: "#7A2E2E" },
      ],
    },
  },
  temperature: {
    id: "temperature",
    label: "Temperature",
    tier: "free",
    kind: "diverging",
    prop: "t",
    unit: "°C",
    unitImperial: "°F",
    toImperial: celsiusToFahrenheit,
    imperialDigits: 0,
    desc: "Mean daily temperature, 10-year ERA5 climatology.",
    infoTooltip: "Mean 2m temperature across the selected month over 2015–2024.",
    legend: {
      title: "Mean temperature",
      sub: "°C",
      ramp: ["#08457E", "#5A93C7", "#E6E0C8", "#C97011", "#7A2E2E"],
      stops: [5, 15, 22, 28],
      ticks: ["< 0°", "15°", "> 30°"],
      subImperial: "°F",
      ticksImperial: ["< 32°", "59°", "> 86°"],
    },
  },
  rainfall: {
    id: "rainfall",
    label: "Rainfall",
    tier: "free",
    kind: "sequential",
    prop: "r",
    unit: "mm/day",
    unitImperial: "in/day",
    toImperial: millimetresToInches,
    // Two decimals: a day's rain in inches is a small number, and 0.2 vs 0.6
    // across the whole ramp is the difference between drizzle and downpour.
    imperialDigits: 2,
    desc: "Average daily precipitation.",
    infoTooltip: "Mean daily total precipitation (ERA5).",
    legend: {
      title: "Rainfall",
      sub: "mm/day",
      ramp: ["#F0ECE0", "#B8D4E8", "#5A93C7", "#1C5A8E", "#0A2A4A"],
      stops: [1, 3, 6, 10],
      ticks: ["0", "5", "> 15"],
      subImperial: "in/day",
      ticksImperial: ["0", "0.2", "> 0.6"],
    },
  },
  sunshine: {
    id: "sunshine",
    label: "Sunshine",
    tier: "free",
    kind: "sequential",
    prop: "s",
    unit: "h/day",
    desc: "Hours of sunshine per day.",
    infoTooltip: "Estimated from ERA5 surface solar radiation, clear-sky equivalent.",
    legend: {
      title: "Daily sunshine",
      sub: "hours",
      ramp: ["#EDE6D2", "#E0C98A", "#C89844", "#B8763E", "#8A4A1E"],
      stops: [3, 5, 7, 9],
      ticks: ["0h", "6h", "12h"],
    },
  },
  wind: {
    id: "wind",
    label: "Wind speed",
    tier: "free",
    kind: "sequential",
    prop: "w",
    unit: "km/h",
    unitImperial: "mph",
    toImperial: kmhToMph,
    imperialDigits: 0,
    desc: "Average wind speed at 10m.",
    infoTooltip: "ERA5 10m wind speed, monthly mean.",
    legend: {
      title: "Wind speed",
      sub: "km/h",
      ramp: ["#E8E4DC", "#B8C8BE", "#78A095", "#3D7A6E", "#1C4E44"],
      stops: [5, 15, 25, 35],
      ticks: ["0", "20", "> 40"],
      subImperial: "mph",
      ticksImperial: ["0", "12", "> 25"],
    },
  },
  safety: {
    id: "safety",
    label: "Safety",
    tier: "free",
    kind: "ordinal-safety",
    // Safety is one scalar per polygon — not indexed by month. Map-style reads
    // the bare `safety` prop, not `safety_<mm>`.
    prop: "safety",
    unit: "advisory",
    desc: "Travel advisory consensus across six governments (US, UK, CA, AU, DE, NL).",
    legend: {
      title: "Advisory level",
      sub: "Highest of 6 sources",
      bins: [
        { label: "Normal", hex: "#4A5568" },
        { label: "Caution", hex: "#9B6434" },
        { label: "Reconsider", hex: "#B55F0E" },
        { label: "Do Not Travel", hex: "#7A2E2E" },
      ],
    },
  },
  snow: {
    id: "snow",
    label: "Snow depth",
    tier: "premium",
    kind: "sequential",
    prop: "snow",
    unit: "cm",
    unitImperial: "in",
    toImperial: centimetresToInches,
    imperialDigits: 1,
    desc: "Average snow cover depth — plan ski trips or avoid winter storms.",
    infoTooltip: "Monthly mean snow depth from ERA5-Land.",
    legend: {
      title: "Snow depth",
      sub: "cm",
      ramp: ["#F7F6F2", "#D6E3ED", "#8AB6D6", "#4682B4", "#1C4270"],
      stops: [1, 10, 40, 80],
      ticks: ["0", "25", "> 100"],
      subImperial: "in",
      ticksImperial: ["0", "10", "> 39"],
    },
  },
  sst: {
    id: "sst",
    label: "Sea surface temp",
    tier: "premium",
    kind: "diverging-ocean",
    prop: "sst",
    unit: "°C",
    unitImperial: "°F",
    toImperial: celsiusToFahrenheit,
    imperialDigits: 0,
    desc: "Ocean temperature — ideal for divers, surfers, and beach planners.",
    infoTooltip: "ERA5 sea surface temperature, monthly mean. Land dimmed.",
    legend: {
      title: "Sea surface temp",
      sub: "°C · ocean only",
      ramp: ["#1C4270", "#5A93C7", "#E6E0C8", "#D97A4E", "#7A2E2E"],
      stops: [10, 18, 24, 28],
      ticks: ["< 5°", "20°", "> 30°"],
      subImperial: "°F · ocean only",
      ticksImperial: ["< 41°", "68°", "> 86°"],
    },
  },
  heat: {
    id: "heat",
    label: "Heat index",
    tier: "premium",
    kind: "sequential",
    prop: "heat",
    unit: "°C",
    unitImperial: "°F",
    toImperial: celsiusToFahrenheit,
    imperialDigits: 0,
    desc: "Feels-like temperature accounting for humidity.",
    infoTooltip: "Rothfusz heat index from ERA5 2m temp + humidity.",
    legend: {
      title: "Heat index",
      sub: "°C · apparent",
      ramp: ["#F5ECC4", "#F0C94E", "#E89028", "#C9521C", "#7A1E14"],
      stops: [28, 32, 36, 42],
      ticks: ["< 25°", "35°", "> 45°"],
      subImperial: "°F · apparent",
      ticksImperial: ["< 77°", "95°", "> 113°"],
    },
  },
  humidity: {
    id: "humidity",
    label: "Humidity",
    tier: "premium",
    kind: "sequential",
    prop: "hum",
    unit: "%",
    desc: "Relative humidity — find crisp air or tropical feel.",
    infoTooltip: "Mean relative humidity at 2m (ERA5).",
    legend: {
      title: "Humidity",
      sub: "% relative",
      ramp: ["#F0ECE0", "#C8DCC0", "#6BA899", "#2E7A78", "#134447"],
      stops: [40, 55, 70, 85],
      ticks: ["< 30%", "60%", "> 90%"],
    },
  },
};

export const DISPLAY_MODE_ORDER: readonly DisplayModeId[] = [
  "preferences",
  "temperature",
  "rainfall",
  "sunshine",
  "wind",
  "safety",
  "snow",
  "sst",
  "heat",
  "humidity",
];

export type DisplayModeGroup = {
  id: "hero" | "climate" | "advisory" | "premium";
  label: string | null;
  items: readonly DisplayModeId[];
};

export const DISPLAY_MODE_GROUPS: readonly DisplayModeGroup[] = [
  { id: "hero", label: null, items: ["preferences"] },
  { id: "climate", label: "Climate variables", items: ["temperature", "rainfall", "sunshine", "wind"] },
  { id: "advisory", label: "Advisory", items: ["safety"] },
  { id: "premium", label: "Premium variables", items: ["snow", "sst", "heat", "humidity"] },
];

export function isDisplayModeId(value: unknown): value is DisplayModeId {
  return typeof value === "string" && value in DISPLAY_MODES;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Reading a mode in the traveller's units
 *
 * Every caller goes through these rather than reaching into `mode.unit` or
 * `legend.ticks`, because reaching in is how the legend came to caption itself
 * "°F" over a ramp still labelled in Celsius. A mode with no imperial form
 * answers with its metric one, so a caller never has to ask which modes
 * convert.
 * ──────────────────────────────────────────────────────────────────────────── */

/** The unit suffix to print for this mode. */
export function modeUnitLabel(mode: DisplayMode, unit: UnitSystem): string {
  return unit === "imperial" ? (mode.unitImperial ?? mode.unit) : mode.unit;
}

/** A tile's metric value, in the units it will be shown in. */
export function modeValue(
  mode: DisplayMode,
  value: number,
  unit: UnitSystem,
): number {
  return unit === "imperial" && mode.toImperial ? mode.toImperial(value) : value;
}

/** Decimals to render that value with. */
export function modeDigits(mode: DisplayMode, unit: UnitSystem): number {
  if (unit !== "imperial" || mode.toImperial == null) return 1;
  return mode.imperialDigits ?? 1;
}

/** Ready-to-print readout, e.g. "24.1 °C" or "75 °F". */
export function formatModeValue(
  mode: DisplayMode,
  value: number,
  unit: UnitSystem,
): string {
  return `${modeValue(mode, value, unit).toFixed(modeDigits(mode, unit))} ${modeUnitLabel(mode, unit)}`;
}

/** The legend's caption under its title. */
export function modeLegendSub(mode: DisplayMode, unit: UnitSystem): string {
  const legend = mode.legend;
  if (unit === "imperial" && "ramp" in legend && legend.subImperial) {
    return legend.subImperial;
  }
  return legend.sub;
}

/**
 * The labels under a ramp. Metric unless this mode declares imperial ones —
 * and the two arrays describe the *same* colour stops, which never move.
 */
export function modeLegendTicks(
  mode: DisplayMode,
  unit: UnitSystem,
): readonly string[] {
  const legend = mode.legend;
  if (!("ramp" in legend)) return [];
  if (unit === "imperial" && legend.ticksImperial) return legend.ticksImperial;
  return legend.ticks;
}

/** Feature property name for a mode at a given month (1–12). Safety ignores month. */
export function modeProperty(mode: DisplayMode, month: number): string {
  if (mode.id === "safety") return mode.prop;
  const mm = String(month).padStart(2, "0");
  return `${mode.prop}_${mm}`;
}
