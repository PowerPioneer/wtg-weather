import { describe, expect, it } from "vitest";

import {
  hasSeenTour,
  MAP_TOUR_STEPS,
  parseTourVersion,
  placeBubble,
  TOUR_VERSION,
} from "./map-tour";

const viewport = { width: 1280, height: 800 };
const bubble = { width: 320, height: 180 };

describe("MAP_TOUR_STEPS", () => {
  it("opens with the climate-not-forecast intro and ends on picking a place", () => {
    expect(MAP_TOUR_STEPS.map((s) => s.id)).toEqual([
      "intro",
      "month",
      "prefs",
      "legend",
      "display",
      "place",
    ]);
    expect(MAP_TOUR_STEPS[0].body).toMatch(/not a forecast/);
  });

  it("names the four verdicts the legend actually shows", () => {
    const legend = MAP_TOUR_STEPS.find((s) => s.id === "legend");
    for (const word of ["Perfect match", "Good option", "Acceptable", "Avoid"]) {
      expect(legend?.body).toContain(word);
    }
  });

  it("points the last step at the country and region page links", () => {
    const place = MAP_TOUR_STEPS.find((s) => s.id === "place");
    expect(place?.body).toMatch(/country or region page/);
    expect(place?.bodyTouch).toMatch(/^Tap /);
    // It asks for a click on the map, so it must not block the map.
    expect(place?.dim).toBe(false);
  });
});

describe("tour version", () => {
  it("treats anything unparseable as never seen", () => {
    for (const value of [null, undefined, "", "yes", "0", -1, 1.5, {}]) {
      expect(parseTourVersion(value)).toBe(0);
      expect(hasSeenTour(value)).toBe(false);
    }
  });

  it("reads a cookie string and a stored number alike", () => {
    expect(hasSeenTour(String(TOUR_VERSION))).toBe(true);
    expect(hasSeenTour(TOUR_VERSION)).toBe(true);
  });

  it("shows a newer tour to someone who saw an older one", () => {
    expect(hasSeenTour(TOUR_VERSION - 1)).toBe(false);
  });
});

describe("placeBubble", () => {
  it("centres a bubble with no target", () => {
    const p = placeBubble({ target: null, bubble, viewport, sides: [] });
    expect(p).toEqual({ top: 310, left: 480, side: null, arrow: 0 });
  });

  it("puts it on the first preferred side with room", () => {
    const month = { top: 72, left: 200, width: 110, height: 34 };
    const p = placeBubble({ target: month, bubble, viewport, sides: ["bottom"] });
    expect(p.side).toBe("bottom");
    expect(p.top).toBe(72 + 34 + 14);
    // The arrow points back at the middle of the target.
    expect(p.left + p.arrow).toBe(255);
  });

  it("flips when the preferred side has no room", () => {
    const legend = { top: 740, left: 16, width: 400, height: 44 };
    const p = placeBubble({ target: legend, bubble, viewport, sides: ["bottom"] });
    expect(p.side).not.toBe("bottom");
    expect(p.top + bubble.height).toBeLessThanOrEqual(viewport.height);
  });

  it("keeps a bubble on screen when it would hang off an edge", () => {
    const button = { top: 72, left: 4, width: 40, height: 32 };
    const p = placeBubble({ target: button, bubble, viewport, sides: ["bottom"] });
    expect(p.left).toBe(12);
    // Clamped arrow still lands inside the bubble's rounded corner inset.
    expect(p.arrow).toBeGreaterThanOrEqual(18);
  });

  it("beside a wide dialog, falls back to the roomiest side rather than off-screen", () => {
    const narrow = { width: 900, height: 700 };
    const dialog = { top: 100, left: 130, width: 640, height: 500 };
    const p = placeBubble({
      target: dialog,
      bubble,
      viewport: narrow,
      sides: ["right", "left", "bottom", "top"],
    });
    expect(p.left).toBeGreaterThanOrEqual(12);
    expect(p.left + bubble.width).toBeLessThanOrEqual(narrow.width - 12);
    expect(p.top).toBeGreaterThanOrEqual(12);
  });

  it("anchors an untargeted bubble to the bottom of the map frame on request", () => {
    const frame = { top: 64, left: 0, width: 390, height: 700 };
    const phone = { width: 390, height: 764 };
    const p = placeBubble({
      target: null,
      bubble: { width: 366, height: 160 },
      viewport: phone,
      sides: [],
      frame,
      fallback: "bottom",
    });
    expect(p.top + 160).toBeLessThanOrEqual(64 + 700);
    expect(p.top).toBeGreaterThan(400);
  });
});
