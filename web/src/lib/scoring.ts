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
