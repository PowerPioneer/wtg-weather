/**
 * Display-mode catalog for the map. Mirrors `web/design/display-mode/variables.js`
 * but typed, runtime-free, and importable from both RSC and Client Components.
 *
 * Ten modes in four groups (hero / climate / advisory / premium). Each mode
 * declares how the map colours polygons (`kind`) and how the legend renders
 * (`legend`). The paint expressions in `lib/map-style.ts` dispatch on `kind`.
 */

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
  desc: string;
  infoTooltip?: string;
  legend:
    | { title: string; sub: string; bins: LegendBin[] }
    | { title: string; sub: string; ramp: string[]; ticks: string[]; stops: number[] };
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
        { label: "Acceptable", hex: "#B8610E" },
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
    desc: "Mean daily temperature, 10-year ERA5 climatology.",
    infoTooltip: "Mean 2m temperature across the selected month over 2015–2024.",
    legend: {
      title: "Mean temperature",
      sub: "°C",
      ramp: ["#08457E", "#5A93C7", "#E6E0C8", "#C97011", "#7A2E2E"],
      stops: [5, 15, 22, 28],
      ticks: ["< 0°", "15°", "> 30°"],
    },
  },
  rainfall: {
    id: "rainfall",
    label: "Rainfall",
    tier: "free",
    kind: "sequential",
    prop: "r",
    unit: "mm/day",
    desc: "Average daily precipitation.",
    infoTooltip: "Mean daily total precipitation (ERA5).",
    legend: {
      title: "Rainfall",
      sub: "mm/day",
      ramp: ["#F0ECE0", "#B8D4E8", "#5A93C7", "#1C5A8E", "#0A2A4A"],
      stops: [1, 3, 6, 10],
      ticks: ["0", "5", "> 15"],
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
    desc: "Average wind speed at 10m.",
    infoTooltip: "ERA5 10m wind speed, monthly mean.",
    legend: {
      title: "Wind speed",
      sub: "km/h",
      ramp: ["#E8E4DC", "#B8C8BE", "#78A095", "#3D7A6E", "#1C4E44"],
      stops: [5, 15, 25, 35],
      ticks: ["0", "20", "> 40"],
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
    desc: "Travel advisory consensus across five governments (US, UK, CA, AU, DE).",
    legend: {
      title: "Advisory level",
      sub: "Highest of 5 sources",
      bins: [
        { label: "Normal", hex: "#4A5568" },
        { label: "Caution", hex: "#B8763E" },
        { label: "Reconsider", hex: "#B8610E" },
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
    desc: "Average snow cover depth — plan ski trips or avoid winter storms.",
    infoTooltip: "Monthly mean snow depth from ERA5-Land.",
    legend: {
      title: "Snow depth",
      sub: "cm",
      ramp: ["#F7F6F2", "#D6E3ED", "#8AB6D6", "#4682B4", "#1C4270"],
      stops: [1, 10, 40, 80],
      ticks: ["0", "25", "> 100"],
    },
  },
  sst: {
    id: "sst",
    label: "Sea surface temp",
    tier: "premium",
    kind: "diverging-ocean",
    prop: "sst",
    unit: "°C",
    desc: "Ocean temperature — ideal for divers, surfers, and beach planners.",
    infoTooltip: "ERA5 sea surface temperature, monthly mean. Land dimmed.",
    legend: {
      title: "Sea surface temp",
      sub: "°C · ocean only",
      ramp: ["#1C4270", "#5A93C7", "#E6E0C8", "#D97A4E", "#7A2E2E"],
      stops: [10, 18, 24, 28],
      ticks: ["< 5°", "20°", "> 30°"],
    },
  },
  heat: {
    id: "heat",
    label: "Heat index",
    tier: "premium",
    kind: "sequential",
    prop: "heat",
    unit: "°C",
    desc: "Feels-like temperature accounting for humidity.",
    infoTooltip: "Rothfusz heat index from ERA5 2m temp + humidity.",
    legend: {
      title: "Heat index",
      sub: "°C · apparent",
      ramp: ["#F5ECC4", "#F0C94E", "#E89028", "#C9521C", "#7A1E14"],
      stops: [28, 32, 36, 42],
      ticks: ["< 25°", "35°", "> 45°"],
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

/** Feature property name for a mode at a given month (1–12). Safety ignores month. */
export function modeProperty(mode: DisplayMode, month: number): string {
  if (mode.id === "safety") return mode.prop;
  const mm = String(month).padStart(2, "0");
  return `${mode.prop}_${mm}`;
}
