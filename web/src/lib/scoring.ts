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
 * What a traveller is looking for. Four controls over three concerns, matching
 * the variables the pipeline scores (`SCORED_VARIABLES` in `build_geojson.py`)
 * and therefore the set the baked score can be reproduced from.
 *
 * Rain and sun are one-sided in the UI — nobody asks for a *minimum* rainfall —
 * but the underlying rule is a range either way, so the fixed side is pinned by
 * `RAIN_MIN` / `SUN_MAX` below.
 */
export type WeatherPreferences = {
  /**
   * Comfortable **daytime high** band, °C — the mean daily maximum.
   *
   * This used to be one range compared against the 24-hour mean, while the
   * slider that set it was labelled "daytime mean". A traveller picked 18–28
   * thinking about days and was matched against places whose days ran 24–34.
   */
  dayMin: number;
  dayMax: number;
  /**
   * Comfortable **overnight low** band, °C — the mean daily minimum.
   *
   * Nobody asks for a night-time ceiling in the abstract, but "it never cooled
   * down" and "it was freezing after dark" are both common complaints, and a
   * tropical night holding 27 °C used to average with a 30 °C day into a
   * 28.5 °C "perfect match".
   */
  nightMin: number;
  nightMax: number;
  /** Most rain the traveller will tolerate, mm/day. */
  rainMax: number;
  /** Least sunshine the traveller wants, hours/day. */
  sunMin: number;
  /**
   * Worst travel advisory the traveller is willing to consider, 1–4.
   *
   * Unlike the three above, this is not a climate variable and is **not** part
   * of the baked `pref_<mm>` score — the pipeline could not bake it, because
   * the answer differs per traveller and the advisory moves weekly while the
   * climatology moves yearly. It is applied as a gate on top of the climate
   * score (see {@link scoreBucket}): a place whose advisory is worse than this
   * reads "Avoid" whatever its weather does. The advisory level itself is a
   * month-less `safety` property on every polygon, so the gate costs nothing
   * beyond a comparison.
   */
  safetyMax: AdvisoryLimit;
};

/** Advisory levels, as the pipeline's six-government consensus reports them. */
export type AdvisoryLimit = 1 | 2 | 3 | 4;

/**
 * Level 3 rather than v1's level 2.
 *
 * At level 2 the map's first impression is every Level-3 *and* Level-4 country
 * painted "Avoid" before the visitor has expressed any preference at all —
 * which is a strong editorial claim to make on their behalf. Level 3 forces
 * only "Do not travel" to the bottom by default and leaves tightening to the
 * traveller.
 */
export const DEFAULT_SAFETY_MAX: AdvisoryLimit = 3;

/**
 * Mirrors `DEFAULT_PREFERENCES` in `pipeline/processing/scoring.py` for the
 * three climate variables. `safetyMax` has no counterpart there by design.
 */
export const DEFAULT_PREFERENCES: WeatherPreferences = {
  dayMin: 22,
  dayMax: 30,
  nightMin: 12,
  nightMax: 22,
  rainMax: 2.7,
  sunMin: 6,
  safetyMax: DEFAULT_SAFETY_MAX,
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
  day: { min: -10, max: 45, step: 1 },
  night: { min: -20, max: 35, step: 1 },
  rain: { min: 0, max: 12, step: 0.1 },
  sun: { min: 0, max: SUN_MAX, step: 0.5 },
  safety: { min: 1, max: 4, step: 1 },
} as const;

/* ────────────────────────────────────────────────────────────────────────────
 * Rainfall, as a level rather than a number
 *
 * "3 mm/day" is a figure almost nobody can picture, and asking a traveller to
 * pick a millimetre ceiling asks them to translate a preference they hold
 * ("I don't mind a bit of drizzle") into a unit they have no feel for. The
 * five bands below are the vocabulary the v1 site used, and the slider now
 * moves between them; the millimetre ceiling they map to is what actually
 * reaches the scoring rule, unchanged.
 *
 * `max` is the ceiling a level selects. Four of the five are the band's own
 * upper edge. "Light rain" is the exception: it selects **2.7**, the
 * pipeline's `DEFAULT_PREFERENCES.rainMax`, not the band's 3.
 *
 * That is deliberate and worth the asymmetry. The map paints the pipeline's
 * baked `pref_<mm>` whenever the preferences are the baked defaults, and
 * computes the score itself otherwise (`buildFillColorExpression`). If picking
 * the default band produced 3.0, then dragging the slider away and back would
 * land on a *different* ceiling from the one the map started with, and every
 * polygon whose rainfall sits between 2.7 and 3.0 would change colour — the
 * exact "map jumps when you drag a slider back to where it began" failure the
 * scoring module is built to avoid. The displayed band is honest either way:
 * the buffer around the ceiling is ±1.3 mm/day, an order of magnitude wider
 * than the 0.3 in question.
 * ──────────────────────────────────────────────────────────────────────────── */

export type RainLevel = {
  /** 1-based, and the value the slider's `<input type="range">` carries. */
  level: 1 | 2 | 3 | 4 | 5;
  /** The word a traveller picks. */
  label: string;
  /** The band, in the units the data is published in. */
  band: string;
  /** mm/day ceiling this level selects. */
  max: number;
  /** Upper edge of the band, for classifying a measured value. `null` = open. */
  bandMax: number | null;
};

export const RAIN_LEVELS: readonly RainLevel[] = [
  { level: 1, label: "Dry", band: "0–1 mm/day", max: 1, bandMax: 1 },
  { level: 2, label: "Light rain", band: "1–3 mm/day", max: 2.7, bandMax: 3 },
  { level: 3, label: "Moderate rain", band: "3–5 mm/day", max: 5, bandMax: 5 },
  { level: 4, label: "Rainy", band: "5–10 mm/day", max: 10, bandMax: 10 },
  {
    level: 5,
    label: "Very wet",
    band: "10+ mm/day",
    max: PREFERENCE_LIMITS.rain.max,
    bandMax: null,
  },
];

/** Longer form, for the level the traveller has actually selected. */
export const RAIN_LEVEL_BLURB: Record<RainLevel["level"], string> = {
  1: "Desert-like — rain is the exception",
  2: "The odd shower, mostly dry days",
  3: "Rain often enough to plan around",
  4: "Wet — expect rain most days",
  5: "Monsoon-scale rainfall",
};

/**
 * Which band a measured rainfall figure falls in. Used to caption a readout
 * ("3.4 mm/day · Moderate rain"), never to score anything.
 */
export function rainLevelForValue(mmPerDay: number): RainLevel {
  for (const level of RAIN_LEVELS) {
    if (level.bandMax == null || mmPerDay <= level.bandMax) return level;
  }
  return RAIN_LEVELS[RAIN_LEVELS.length - 1];
}

/**
 * Which level a stored `rainMax` ceiling corresponds to — the inverse of
 * `RAIN_LEVELS[n].max`, tolerant of a ceiling that came from a hand-edited URL
 * and matches no level exactly (it lands in whichever band contains it).
 */
export function rainLevelForCeiling(rainMax: number): RainLevel {
  const exact = RAIN_LEVELS.find((l) => l.max === rainMax);
  return exact ?? rainLevelForValue(rainMax);
}

/** The mm/day ceiling a level selects. Out-of-range input clamps to the ends. */
export function rainCeilingForLevel(level: number): number {
  const index = Math.min(RAIN_LEVELS.length, Math.max(1, Math.round(level))) - 1;
  return RAIN_LEVELS[index].max;
}

/** Advisory wording, matching `ADVISORY_LABEL` in `components/safety`. */
export const SAFETY_LIMIT_LABEL: Record<AdvisoryLimit, string> = {
  1: "Normal precautions",
  2: "Caution",
  3: "Reconsider travel",
  4: "Do not travel",
};

/** What choosing that limit means, spelled out under the control. */
export const SAFETY_LIMIT_BLURB: Record<AdvisoryLimit, string> = {
  1: "Only places every government rates as normal.",
  2: "Places rated caution or better.",
  3: "Everything except “do not travel”.",
  4: "No safety filter — every advisory level is shown.",
};

/** Short per-month property aliases the tiles carry, per scored variable. */
/** `t` is the mean daily maximum; `tmin` the mean daily minimum. */
export type ScoredAlias = "t" | "tmin" | "r" | "s";

/**
 * What a range speaks for. Ranges sharing a concern are collapsed to their
 * worst verdict before {@link scoreBucket} counts anything — see there for
 * why that matters more than it looks.
 */
export type PreferenceConcern = "temperature" | "rain" | "sun";

export type PreferenceRange = {
  alias: ScoredAlias;
  /** Raw ERA5 code, for cross-referencing the pipeline. */
  variable: "t2m_max" | "t2m_min" | "tp" | "sun_hours";
  concern: PreferenceConcern;
  lo: number;
  hi: number;
  buffer: number;
};

/**
 * The four ranges a set of preferences expands to, across three concerns.
 * Single source for both the TypeScript scorer and the MapLibre paint
 * expression, so the two cannot disagree about what the user asked for.
 */
export function preferenceRanges(
  prefs: WeatherPreferences = DEFAULT_PREFERENCES,
): readonly PreferenceRange[] {
  return [
    { alias: "t", variable: "t2m_max", concern: "temperature", lo: prefs.dayMin, hi: prefs.dayMax, buffer: TEMP_BUFFER },
    { alias: "tmin", variable: "t2m_min", concern: "temperature", lo: prefs.nightMin, hi: prefs.nightMax, buffer: TEMP_BUFFER },
    { alias: "r", variable: "tp", concern: "rain", lo: RAIN_MIN, hi: prefs.rainMax, buffer: RAIN_BUFFER },
    { alias: "s", variable: "sun_hours", concern: "sun", lo: prefs.sunMin, hi: SUN_MAX, buffer: SUN_BUFFER },
  ];
}

/**
 * 0–100 score per 0..3 bucket. Mirrors `SCORE_TO_PREF` in
 * `pipeline/src/wtg_pipeline/tiles/build_geojson.py`: the centroids that place
 * each Python bucket squarely inside the corresponding bin above.
 */
export const BUCKET_SCORES: readonly [number, number, number, number] = [25, 60, 75, 90];

/** p50 values in display units, per scored alias. `null` where the tile has none. */
export type ScoredValues = Partial<Record<ScoredAlias, number | null>> & {
  /**
   * The polygon's month-less advisory level, where it carries one. Absent or
   * `null` means no government lists this place — which is not the same as
   * level 1 and must never fail the gate below.
   */
  safety?: number | null;
};

/**
 * Whether a place's advisory puts it beyond what the traveller accepts.
 *
 * `null`/absent is "no government lists it", which passes: the tiles omit the
 * property entirely for those polygons and the map already paints them grey in
 * Safety mode. Treating unknown as unsafe would blank most of the map.
 */
export function failsSafetyLimit(
  safety: number | null | undefined,
  prefs: WeatherPreferences = DEFAULT_PREFERENCES,
): boolean {
  if (safety == null || !Number.isFinite(safety)) return false;
  return safety > prefs.safetyMax;
}

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
  // The safety gate runs first, but only decides the answer for polygons that
  // have climate data at all: a place with no series stays `null` (grey, "we
  // have nothing to say") rather than becoming a confident "Avoid" on the
  // strength of an advisory. Weather is what this score is about; safety is a
  // veto over it, not a substitute for it.
  const vetoed = failsSafetyLimit(values.safety, prefs);

  // 0 = in range, 1 = in buffer, 2 = a hard miss. The worst verdict wins
  // within a concern, so a place whose nights are fine and whose days are
  // impossible is judged on the days.
  //
  // Temperature is two ranges and one concern. Counting the four ranges
  // independently would make one miss out of four milder than one out of
  // three and quietly loosen every threshold below — more of the map would
  // turn green for no reason the data supports. Mirrors `polygon_score` in
  // `pipeline/src/wtg_pipeline/processing/scoring.py`.
  const worstByConcern = new Map<PreferenceConcern, 0 | 1 | 2>();

  for (const range of preferenceRanges(prefs)) {
    const value = values[range.alias];
    if (value == null || !Number.isFinite(value)) continue;
    let verdict: 0 | 1 | 2 = 2;
    if (value >= range.lo && value <= range.hi) {
      verdict = 0;
    } else if (value >= range.lo - range.buffer && value <= range.hi + range.buffer) {
      verdict = 1;
    }
    const previous = worstByConcern.get(range.concern) ?? 0;
    worstByConcern.set(range.concern, Math.max(previous, verdict) as 0 | 1 | 2);
  }

  if (worstByConcern.size === 0) return null;

  let inBuffer = 0;
  let outOfBuffer = 0;
  for (const verdict of worstByConcern.values()) {
    if (verdict === 1) inBuffer++;
    else if (verdict === 2) outOfBuffer++;
  }

  if (vetoed) return 0;
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
  input:
    // `safetyMax` widens to `number` here rather than `AdvisoryLimit`: the
    // callers are a query string, a JSON blob and a saved trip, none of which
    // can promise the narrow type. Narrowing it is this function's job.
    | (Partial<Omit<WeatherPreferences, "safetyMax">> & { safetyMax?: number })
    | null
    | undefined,
): WeatherPreferences {
  const raw = { ...DEFAULT_PREFERENCES, ...(input ?? {}) };
  let dayMin = clampTo(raw.dayMin, PREFERENCE_LIMITS.day);
  let dayMax = clampTo(raw.dayMax, PREFERENCE_LIMITS.day);
  if (dayMin > dayMax) [dayMin, dayMax] = [dayMax, dayMin];
  let nightMin = clampTo(raw.nightMin, PREFERENCE_LIMITS.night);
  let nightMax = clampTo(raw.nightMax, PREFERENCE_LIMITS.night);
  if (nightMin > nightMax) [nightMin, nightMax] = [nightMax, nightMin];
  return {
    dayMin: round1(dayMin),
    dayMax: round1(dayMax),
    nightMin: round1(nightMin),
    nightMax: round1(nightMax),
    rainMax: round1(clampTo(raw.rainMax, PREFERENCE_LIMITS.rain)),
    sunMin: round1(clampTo(raw.sunMin, PREFERENCE_LIMITS.sun)),
    safetyMax: clampSafetyMax(raw.safetyMax),
  };
}

/** 1–4, whole. Anything else is the default rather than a rounded guess. */
export function clampSafetyMax(value: unknown): AdvisoryLimit {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_SAFETY_MAX;
  const rounded = Math.round(value);
  if (rounded < PREFERENCE_LIMITS.safety.min) return PREFERENCE_LIMITS.safety.min;
  if (rounded > PREFERENCE_LIMITS.safety.max) return PREFERENCE_LIMITS.safety.max;
  return rounded as AdvisoryLimit;
}

/**
 * Read preferences out of an untyped blob — a trip's `preferences` column, an
 * alert's, the onboarding `data` record. Returns `null` when none of the four
 * keys is present, so a caller can tell "saved with defaults" from "saved
 * before this shape existed" and fall back deliberately.
 *
 * Whatever is present is clamped: these values have round-tripped through a
 * `dict[str, Any]` that validates none of them.
 */
export function parseWeatherPreferences(
  raw: unknown,
): WeatherPreferences | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const numeric = (key: keyof WeatherPreferences): number | undefined => {
    const value = record[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  };
  const parsed = {
    dayMin: numeric("dayMin"),
    dayMax: numeric("dayMax"),
    nightMin: numeric("nightMin"),
    nightMax: numeric("nightMax"),
    rainMax: numeric("rainMax"),
    sunMin: numeric("sunMin"),
    // A record written before the safety limit existed simply has none, and
    // gets the default — the same treatment every other missing key gets.
    safetyMax: numeric("safetyMax"),
  };
  if (Object.values(parsed).every((v) => v === undefined)) return null;
  return clampPreferences(parsed);
}

/**
 * Whether the *climate* preferences are the ones the pipeline baked into
 * `pref_<mm>`. The paint expression reads the baked property when this holds,
 * which keeps the default map identical to what shipped before preferences
 * existed.
 *
 * Deliberately blind to `safetyMax`: no advisory level is baked into
 * `pref_<mm>`, so changing the safety limit does not invalidate the baked
 * climate score — it only changes which polygons are vetoed afterwards. Asking
 * this question about safety would throw the whole map onto the client-side
 * scorer for a setting the baked value never depended on. For "has the user
 * changed anything at all", which is what UI affordances want, use
 * {@link isDefaultPreferenceSet}.
 */
export function isDefaultPreferences(prefs: WeatherPreferences): boolean {
  const p = clampPreferences(prefs);
  return (
    p.dayMin === DEFAULT_PREFERENCES.dayMin &&
    p.dayMax === DEFAULT_PREFERENCES.dayMax &&
    p.nightMin === DEFAULT_PREFERENCES.nightMin &&
    p.nightMax === DEFAULT_PREFERENCES.nightMax &&
    p.rainMax === DEFAULT_PREFERENCES.rainMax &&
    p.sunMin === DEFAULT_PREFERENCES.sunMin
  );
}

/**
 * Whether *every* preference is untouched, safety included. This is the
 * question the "Default / Custom" pill, the Reset button and the stored-
 * preferences hydration gate are actually asking.
 */
export function isDefaultPreferenceSet(prefs: WeatherPreferences): boolean {
  return (
    isDefaultPreferences(prefs) &&
    clampSafetyMax(prefs.safetyMax) === DEFAULT_PREFERENCES.safetyMax
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
  acceptable: "#B55F0E",
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
