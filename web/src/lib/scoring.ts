/**
 * Climate-match scoring — pure functions, shared between SSR pages, map paint
 * expressions, and UI primitives. No side effects, no DOM, no React.
 *
 * The 0–100 score is bucketed into four bins (Atlas palette, CVD-safe):
 *   ≥85 perfect · 70–84 good · 50–69 acceptable · <50 avoid
 *
 * The four bins are semantic — "avoid" is the same class of thing as a Level-4
 * advisory. Colour alone never carries the meaning; every surface that renders
 * a score must also render the human label or a glyph.
 */

export type ScoreBin = "perfect" | "good" | "acceptable" | "avoid";

/* ────────────────────────────────────────────────────────────────────────────
 * Preferences → score
 *
 * The pipeline bakes a `pref_<mm>` score into every polygon from its own
 * DEFAULT_PREFERENCES (`pipeline/src/wtg_pipeline/processing/scoring.py`), and
 * that is what the map painted before this existed — a user could not change
 * it, because nothing client-side could compute a score.
 *
 * The rule below is the Python `polygon_score` rule, deliberately reproduced
 * bucket-for-bucket rather than improved on. Three things depend on it
 * agreeing exactly:
 *
 *   1. the paint expression (`lib/map-style.ts`) falls back to the baked
 *      `pref_<mm>` while preferences are default — a different rule would make
 *      the map jump the moment a user dragged a slider back to where it began;
 *   2. the climate panel and hover card show a number that has to match the
 *      colour under the cursor;
 *   3. the SSR country pages score server-side from the same module.
 *
 * `scoring.test.ts` parses the Python source and fails if either side drifts.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * What a traveller is looking for. Three controls, because those are the three
 * variables the pipeline scores (`SCORED_VARIABLES` in `build_geojson.py`) and
 * therefore the three the baked score can be reproduced from.
 *
 * Rain and sun are one-sided in the UI — nobody asks for a *minimum* rainfall —
 * but the underlying rule is a range either way, so the fixed side is pinned by
 * `RAIN_MIN` / `SUN_MAX` below.
 */
export type WeatherPreferences = {
  /** Comfortable temperature band, °C. */
  tempMin: number;
  tempMax: number;
  /** Most rain the traveller will tolerate, mm/day. */
  rainMax: number;
  /** Least sunshine the traveller wants, hours/day. */
  sunMin: number;
};

/** Mirrors `DEFAULT_PREFERENCES` in `pipeline/processing/scoring.py`. */
export const DEFAULT_PREFERENCES: WeatherPreferences = {
  tempMin: 18,
  tempMax: 28,
  rainMax: 2.7,
  sunMin: 6,
};

/**
 * Tolerance either side of a range before a value counts as a hard miss, and
 * the bound the UI does not expose. All from the Python table — a value here
 * that disagrees with it silently changes what "Perfect" means.
 */
const TEMP_BUFFER = 3;
const RAIN_BUFFER = 1.3;
const SUN_BUFFER = 1.5;
const RAIN_MIN = 0;
const SUN_MAX = 13;

/** Slider bounds. `sun.max` is `SUN_MAX`: a minimum above the range's top would score nothing. */
export const PREFERENCE_LIMITS = {
  temp: { min: -10, max: 45, step: 1 },
  rain: { min: 0, max: 12, step: 0.1 },
  sun: { min: 0, max: SUN_MAX, step: 0.5 },
} as const;

/** Short per-month property aliases the tiles carry, per scored variable. */
export type ScoredAlias = "t" | "r" | "s";

export type PreferenceRange = {
  alias: ScoredAlias;
  /** Raw ERA5 code, for cross-referencing the pipeline. */
  variable: "t2m" | "tp" | "sun_hours";
  lo: number;
  hi: number;
  buffer: number;
};

/**
 * The three ranges a set of preferences expands to. Single source for both the
 * TypeScript scorer and the MapLibre paint expression, so the two cannot
 * disagree about what the user asked for.
 */
export function preferenceRanges(
  prefs: WeatherPreferences = DEFAULT_PREFERENCES,
): readonly PreferenceRange[] {
  return [
    { alias: "t", variable: "t2m", lo: prefs.tempMin, hi: prefs.tempMax, buffer: TEMP_BUFFER },
    { alias: "r", variable: "tp", lo: RAIN_MIN, hi: prefs.rainMax, buffer: RAIN_BUFFER },
    { alias: "s", variable: "sun_hours", lo: prefs.sunMin, hi: SUN_MAX, buffer: SUN_BUFFER },
  ];
}

/**
 * 0–100 score per 0..3 bucket. Mirrors `SCORE_TO_PREF` in
 * `pipeline/src/wtg_pipeline/tiles/build_geojson.py`: the centroids that place
 * each Python bucket squarely inside the corresponding bin above.
 */
export const BUCKET_SCORES: readonly [number, number, number, number] = [25, 60, 75, 90];

/** p50 values in display units, per scored alias. `null` where the tile has none. */
export type ScoredValues = Partial<Record<ScoredAlias, number | null>>;

/**
 * The 0..3 bucket, or `null` when the feature carries none of the three
 * variables — which is a grey polygon, not a zero. (Python returns 0 there
 * because it has no null to return; the tiles then simply omit `pref_<mm>`,
 * so grey is what actually ships.)
 */
export function scoreBucket(
  values: ScoredValues,
  prefs: WeatherPreferences = DEFAULT_PREFERENCES,
): 0 | 1 | 2 | 3 | null {
  let evaluated = 0;
  let inBuffer = 0;
  let outOfBuffer = 0;

  for (const range of preferenceRanges(prefs)) {
    const value = values[range.alias];
    if (value == null || !Number.isFinite(value)) continue;
    evaluated++;
    if (value >= range.lo && value <= range.hi) continue; // in range
    if (value >= range.lo - range.buffer && value <= range.hi + range.buffer) {
      inBuffer++;
    } else {
      outOfBuffer++;
    }
  }

  if (evaluated === 0) return null;
  if (outOfBuffer >= 2) return 0;
  if (outOfBuffer === 1) return 1;
  if (inBuffer >= 1) return 2;
  return 3;
}

/** 0–100 match score for one polygon-month, or `null` when it carries no data. */
export function preferenceScore(
  values: ScoredValues,
  prefs: WeatherPreferences = DEFAULT_PREFERENCES,
): number | null {
  const bucket = scoreBucket(values, prefs);
  return bucket == null ? null : BUCKET_SCORES[bucket];
}

function clampTo(value: number, limits: { min: number; max: number }): number {
  if (!Number.isFinite(value)) return limits.min;
  return Math.min(limits.max, Math.max(limits.min, value));
}

/** One decimal is the finest step any control offers; keeps shared URLs short. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Bring anything — a hand-edited query string, a stale value from the user's
 * saved preferences — into range. An inverted temperature band is swapped
 * rather than rejected: it is unambiguous what was meant.
 */
export function clampPreferences(
  input: Partial<WeatherPreferences> | null | undefined,
): WeatherPreferences {
  const raw = { ...DEFAULT_PREFERENCES, ...(input ?? {}) };
  let tempMin = clampTo(raw.tempMin, PREFERENCE_LIMITS.temp);
  let tempMax = clampTo(raw.tempMax, PREFERENCE_LIMITS.temp);
  if (tempMin > tempMax) [tempMin, tempMax] = [tempMax, tempMin];
  return {
    tempMin: round1(tempMin),
    tempMax: round1(tempMax),
    rainMax: round1(clampTo(raw.rainMax, PREFERENCE_LIMITS.rain)),
    sunMin: round1(clampTo(raw.sunMin, PREFERENCE_LIMITS.sun)),
  };
}

/**
 * Whether these are the preferences the pipeline baked into `pref_<mm>`.
 * The paint expression reads the baked property when this holds, which keeps
 * the default map identical to what shipped before preferences existed.
 */
export function isDefaultPreferences(prefs: WeatherPreferences): boolean {
  const p = clampPreferences(prefs);
  return (
    p.tempMin === DEFAULT_PREFERENCES.tempMin &&
    p.tempMax === DEFAULT_PREFERENCES.tempMax &&
    p.rainMax === DEFAULT_PREFERENCES.rainMax &&
    p.sunMin === DEFAULT_PREFERENCES.sunMin
  );
}

export const SCORE_BINS = [
  { bin: "perfect" as const, min: 85, max: 100 },
  { bin: "good" as const, min: 70, max: 84 },
  { bin: "acceptable" as const, min: 50, max: 69 },
  { bin: "avoid" as const, min: 0, max: 49 },
];

/** Clamp any number into the 0–100 score domain. NaN → 0, ±∞ → 0/100. */
export function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/** Map a 0–100 score to one of the four bins. */
export function scoreBin(score: number): ScoreBin {
  const s = clampScore(score);
  if (s >= 85) return "perfect";
  if (s >= 70) return "good";
  if (s >= 50) return "acceptable";
  return "avoid";
}

/** Human-readable bin label — the text that must accompany colour on every surface. */
export function scoreLabel(score: number): string {
  switch (scoreBin(score)) {
    case "perfect":
      return "Perfect match";
    case "good":
      return "Good option";
    case "acceptable":
      return "Acceptable";
    case "avoid":
      return "Avoid";
  }
}

/** Short label, for compact badges and map hover cards. */
export function scoreShortLabel(score: number): string {
  switch (scoreBin(score)) {
    case "perfect":
      return "Perfect";
    case "good":
      return "Good";
    case "acceptable":
      return "Fair";
    case "avoid":
      return "Avoid";
  }
}

/**
 * Tailwind class fragments for the four bins. The caller composes these with
 * the role prefix it needs (e.g. `bg-`, `text-`).
 *
 * Kept as lookup rather than a function returning a class string so that
 * Tailwind's content scanner sees every concrete class at build time.
 */
export const SCORE_BG_CLASS: Record<ScoreBin, string> = {
  perfect: "bg-score-perfect",
  good: "bg-score-good",
  acceptable: "bg-score-acceptable",
  avoid: "bg-score-avoid",
};

export const SCORE_BG_SUBTLE_CLASS: Record<ScoreBin, string> = {
  perfect: "bg-score-perfect-subtle",
  good: "bg-score-good-subtle",
  acceptable: "bg-score-acceptable-subtle",
  avoid: "bg-score-avoid-subtle",
};

export const SCORE_TEXT_CLASS: Record<ScoreBin, string> = {
  perfect: "text-score-perfect",
  good: "text-score-good",
  acceptable: "text-score-acceptable",
  avoid: "text-score-avoid",
};

export const SCORE_BORDER_CLASS: Record<ScoreBin, string> = {
  perfect: "border-score-perfect",
  good: "border-score-good",
  acceptable: "border-score-acceptable",
  avoid: "border-score-avoid",
};

/** Raw hex values — needed inside SVGs where Tailwind utility classes don't reach. */
export const SCORE_HEX: Record<ScoreBin, string> = {
  perfect: "#0B6E5F",
  good: "#0072B2",
  acceptable: "#B8610E",
  avoid: "#7A2E2E",
};

export const SCORE_HEX_SUBTLE: Record<ScoreBin, string> = {
  perfect: "#DDEBE7",
  good: "#D7E4EF",
  acceptable: "#EFDFC9",
  avoid: "#EFD8D8",
};

/** Convenience: go straight from score to hex. */
export function scoreHex(score: number): string {
  return SCORE_HEX[scoreBin(score)];
}
