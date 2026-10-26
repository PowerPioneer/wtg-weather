/**
 * The map's first-visit guide: what it says, what each bubble points at, and
 * where a bubble goes.
 *
 * A first-time visitor landed on a map of colours with three unlabelled-looking
 * pills above it and nothing saying what any of it meant — or, more
 * importantly, that the colours are a decade of climate rather than a forecast
 * for their dates. The tour says that first and then walks the controls in the
 * order someone planning a trip uses them: when, what they like, how to read
 * the result, other layers, then a place.
 *
 * Seen-ness is remembered in two places, the same split `wtg_unit` uses: a
 * readable cookie for this browser (`TOUR_COOKIE`), and the signed-in user's
 * onboarding blob (`STORED_TOUR_KEY`) so a second device does not ask again.
 * Both hold `TOUR_VERSION`, so a materially rewritten tour can be shown once
 * more by bumping it. `localStorage` is out: the privacy page promises it is
 * not used.
 */

export const TOUR_COOKIE = "wtg_tour";
export const TOUR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
/** Key inside the onboarding `data` blob, beside `mapPreferences`. */
export const STORED_TOUR_KEY = "mapTour";
export const TOUR_VERSION = 1;

export type TourStepId =
  | "intro"
  | "month"
  | "prefs"
  | "legend"
  | "display"
  | "place";

export type Side = "top" | "bottom" | "left" | "right";

export type TourStep = {
  id: TourStepId;
  eyebrow: string;
  title: string;
  body: string;
  /** Wording for touch screens, where nobody "clicks". */
  bodyTouch?: string;
  /**
   * `data-tour` values to point at, first present one wins. The open panel is
   * listed before the button that opens it, so a step that opens its panel
   * points at the panel and falls back to the button where it does not (on a
   * phone, where the panel is a sheet that would leave no room for a bubble).
   */
  targets: readonly string[];
  /** Sides to try, in order of preference. */
  sides: readonly Side[];
  /**
   * Dim the page and block it, leaving only the target usable. Off for the
   * last step, which asks for a click on the map itself.
   */
  dim: boolean;
};

export const MAP_TOUR_STEPS: readonly TourStep[] = [
  {
    id: "intro",
    eyebrow: "Welcome",
    title: "Let’s find you better weather",
    body: "This map is built from ten years of real weather, so it shows what your trip is most likely to bring, not a forecast for the exact week you travel. We can’t promise blue skies, but we can help you pick the place and month where they’re most likely.",
    targets: [],
    sides: [],
    dim: true,
  },
  {
    id: "month",
    eyebrow: "Quick tour",
    title: "When are you travelling?",
    body: "Step through the months and watch the good weather move around the world.",
    targets: ["month"],
    sides: ["bottom", "right"],
    dim: true,
  },
  {
    id: "prefs",
    eyebrow: "Quick tour",
    title: "Tell us what you love",
    body: "Warm or mild, dry or happy with a shower: set your ideal weather and every place is scored for you. You can also say how cautious to be about travel advisories.",
    targets: ["prefs-panel", "prefs"],
    sides: ["right", "bottom"],
    dim: true,
  },
  {
    id: "legend",
    eyebrow: "Quick tour",
    title: "Every colour is a verdict",
    body: "Each place gets one of four: Perfect match, Good option, Acceptable or Avoid. The key down here tells you which colour is which.",
    targets: ["legend"],
    sides: ["top", "right"],
    dim: true,
  },
  {
    id: "display",
    eyebrow: "Quick tour",
    title: "One thing at a time",
    body: "Curious about just temperature, rain or sunshine? Switch the layer here. “My Preferences” is the all-in-one view.",
    targets: ["display-panel", "display"],
    sides: ["right", "left", "bottom", "top"],
    dim: true,
  },
  {
    id: "place",
    eyebrow: "Quick tour",
    title: "Now pick a place",
    body: "Click any country or region to see its weather month by month, and how well it suits you. For the full picture, open its country or region page at the bottom of that panel.",
    bodyTouch:
      "Tap any country or region to see its weather month by month, and how well it suits you. For the full picture, open its country or region page at the bottom of that panel.",
    targets: ["panel-footer"],
    sides: ["left", "top"],
    dim: false,
  },
];

/** Narrow a cookie or stored value to a tour version; anything else is "never seen". */
export function parseTourVersion(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : 0;
}

export function hasSeenTour(value: unknown): boolean {
  return parseTourVersion(value) >= TOUR_VERSION;
}

// ─── Placement ───────────────────────────────────────────────────────

export type Box = { top: number; left: number; width: number; height: number };

export type Placement = {
  top: number;
  left: number;
  /** Which side of the target the bubble sits on; `null` when it has no target. */
  side: Side | null;
  /** Arrow position along the bubble's edge facing the target, in px. */
  arrow: number;
};

const GAP = 14;
const MARGIN = 12;
const ARROW_INSET = 18;

const ALL_SIDES: readonly Side[] = ["bottom", "top", "right", "left"];

/**
 * Where a `bubble`-sized box goes next to `target` without leaving `viewport`.
 *
 * Tries `sides` in order and takes the first with room; failing that, the side
 * with the most room, clamped onto the screen (it may then overlap its target,
 * which beats being off-screen). With no target the bubble sits in `fallback`
 * — centred for the intro, or at the top or bottom edge of `frame`.
 */
export function placeBubble({
  target,
  bubble,
  viewport,
  sides,
  frame = { top: 0, left: 0, ...viewport },
  fallback = "center",
}: {
  target: Box | null;
  bubble: { width: number; height: number };
  viewport: { width: number; height: number };
  sides: readonly Side[];
  frame?: Box;
  fallback?: "center" | "top" | "bottom";
}): Placement {
  const clampX = (x: number) =>
    clamp(x, MARGIN, viewport.width - bubble.width - MARGIN);
  const clampY = (y: number) =>
    clamp(y, MARGIN, viewport.height - bubble.height - MARGIN);

  if (!target) {
    const left = clampX(frame.left + (frame.width - bubble.width) / 2);
    const top =
      fallback === "top"
        ? clampY(frame.top + MARGIN * 6)
        : fallback === "bottom"
          ? clampY(frame.top + frame.height - bubble.height - MARGIN * 2)
          : clampY(frame.top + (frame.height - bubble.height) / 2);
    return { top, left, side: null, arrow: 0 };
  }

  const room: Record<Side, number> = {
    top: target.top - MARGIN,
    bottom: viewport.height - (target.top + target.height) - MARGIN,
    left: target.left - MARGIN,
    right: viewport.width - (target.left + target.width) - MARGIN,
  };
  const need = (side: Side) =>
    (side === "top" || side === "bottom" ? bubble.height : bubble.width) + GAP;

  const order = [...sides, ...ALL_SIDES.filter((s) => !sides.includes(s))];
  const side =
    order.find((s) => room[s] >= need(s)) ??
    order.reduce((best, s) => (room[s] - need(s) > room[best] - need(best) ? s : best));

  const centreX = target.left + target.width / 2;
  const centreY = target.top + target.height / 2;

  let top: number;
  let left: number;
  if (side === "top" || side === "bottom") {
    left = clampX(centreX - bubble.width / 2);
    top = clampY(
      side === "bottom"
        ? target.top + target.height + GAP
        : target.top - bubble.height - GAP,
    );
    return { top, left, side, arrow: clampArrow(centreX - left, bubble.width) };
  }
  top = clampY(centreY - bubble.height / 2);
  left = clampX(
    side === "right"
      ? target.left + target.width + GAP
      : target.left - bubble.width - GAP,
  );
  return { top, left, side, arrow: clampArrow(centreY - top, bubble.height) };
}

function clampArrow(at: number, length: number): number {
  return clamp(at, ARROW_INSET, length - ARROW_INSET);
}

function clamp(value: number, min: number, max: number): number {
  // A bubble wider than the screen pins to the left margin rather than going negative.
  return Math.max(min, Math.min(value, Math.max(min, max)));
}
