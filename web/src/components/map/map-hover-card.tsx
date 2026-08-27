"use client";

/**
 * Cursor-following hover card for the map.
 *
 * `MatchTooltip` is presentational and deliberately leaves positioning to its
 * caller — this is that caller. It reads the hovered feature's own tile
 * properties (no fetch) and pins the card next to the pointer, flipping it
 * before it can run off the right or bottom edge of the map.
 */

import { useEffect, useRef, useState } from "react";

import { MatchTooltip, type MatchTooltipStat } from "@/components/match";
import { ADVISORY_LABEL } from "@/components/safety";
import { DISPLAY_MODES, type DisplayModeId } from "@/lib/display-modes";
import {
  readAdvisoryLevel,
  readModeValue,
  readNumber,
  readPreferenceScore,
  monthKey,
  type FeatureIdentity,
  type FeatureProperties,
} from "@/lib/feature-climate";
import { MONTH_SHORT, MONTH_SLUGS } from "@/lib/months";
import {
  DEFAULT_PREFERENCES,
  failsSafetyLimit,
  isDefaultPreferenceSet,
  rainLevelForValue,
  type WeatherPreferences,
} from "@/lib/scoring";
import {
  formatRainfallPerDay,
  formatSunHours,
  formatTemperature,
  type UnitSystem,
} from "@/lib/units";
import { useUnit } from "@/components/units";

export type MapHoverCardProps = {
  identity: FeatureIdentity;
  properties: FeatureProperties;
  /** Pointer position in map-container pixels. */
  point: { x: number; y: number };
  mode: DisplayModeId;
  /** 1-indexed month. */
  month: number;
  /** Preferences the map is painting with; omitted means the baked defaults. */
  preferences?: WeatherPreferences;
  /** Country name for the "Region, Country" second line, when known. */
  countryName?: string;
};

const OFFSET = 14;
const ESTIMATED_WIDTH = 264;
const ESTIMATED_HEIGHT = 148;

export function MapHoverCard({
  identity,
  properties,
  point,
  mode,
  month,
  preferences,
  countryName,
}: MapHoverCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [bounds, setBounds] = useState<{ width: number; height: number } | null>(
    null,
  );

  // The card flips against the map container, not the viewport: the map is a
  // fixed-height pane inside the page, and a card that only respected the
  // viewport would still spill over the legend and the mode controls.
  useEffect(() => {
    const parent = containerRef.current?.parentElement;
    if (!parent) return;
    const measure = () =>
      setBounds({ width: parent.clientWidth, height: parent.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const flipX =
    bounds != null && point.x + OFFSET + ESTIMATED_WIDTH > bounds.width;
  const flipY =
    bounds != null && point.y + OFFSET + ESTIMATED_HEIGHT > bounds.height;

  const { unit } = useUnit();
  const monthSlug = MONTH_SLUGS[month - 1];
  const score = readPreferenceScore(properties, month, preferences);
  const prefLabel =
    preferences != null && !isDefaultPreferenceSet(preferences)
      ? "your preferences"
      : "default preferences";
  const place =
    identity.level === "country" || !countryName || identity.name === countryName
      ? identity.name || countryName || "Unnamed area"
      : `${identity.name}, ${countryName}`;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute z-20"
      style={{
        left: point.x + (flipX ? -OFFSET : OFFSET),
        top: point.y + (flipY ? -OFFSET : OFFSET),
        transform: `translate(${flipX ? "-100%" : "0"}, ${flipY ? "-100%" : "0"})`,
      }}
    >
      <MatchTooltip
        place={place}
        context={`${MONTH_SHORT[monthSlug]} · ${prefLabel}`}
        score={score ?? 0}
        stats={buildStats(properties, mode, month, unit)}
        footer={buildFooter(properties, score, preferences)}
      />
    </div>
  );
}

/**
 * The advisory the Safety mode paints, when the polygon carries one. Without
 * it, hovering in Safety mode reported temperature, rain and sun and never the
 * level that actually chose the colour. A polygon no government lists carries
 * no property at all — the map paints that grey and the card stays quiet.
 */
function buildFooter(
  properties: FeatureProperties,
  score: number | null,
  preferences: WeatherPreferences | undefined,
): string | undefined {
  const advisory = readAdvisoryLevel(properties);
  if (advisory != null) {
    const line = `Advisory level ${advisory} · ${ADVISORY_LABEL[advisory]}`;
    // When the advisory is what made this "Avoid", the card has to say so —
    // otherwise a place with ideal weather shows the bottom verdict with three
    // perfectly good readouts above it and no visible reason.
    return failsSafetyLimit(advisory, preferences ?? DEFAULT_PREFERENCES)
      ? `${line} · above your limit`
      : line;
  }
  return score == null ? "No match for this area" : undefined;
}

/**
 * Up to four readouts: the variable the map is currently painting first (so
 * the card explains the colour under the cursor), then the free-tier trio.
 */
function buildStats(
  properties: FeatureProperties,
  mode: DisplayModeId,
  month: number,
  unit: UnitSystem,
): MatchTooltipStat[] {
  const stats: MatchTooltipStat[] = [];
  const seen = new Set<string>();

  const push = (label: string, value: string | null) => {
    if (value == null || seen.has(label)) return;
    seen.add(label);
    stats.push({ label, value });
  };

  const active = DISPLAY_MODES[mode];
  if (active.kind !== "qualitative" && active.id !== "safety") {
    const value = readModeValue(properties, mode, month);
    // The active layer's own readout keeps the layer's declared unit: it is
    // explaining the colour under the cursor, and the legend beside it is
    // labelled in that unit. The three free variables below convert.
    push(
      active.label,
      value == null ? null : `${value.toFixed(1)} ${active.unit}`,
    );
  }

  const temp = readNumber(properties, monthKey("t", month));
  push("Temp", temp == null ? null : formatTemperature(temp, unit, { digits: 1, space: true }));

  const rain = readNumber(properties, monthKey("r", month));
  push(
    "Rain",
    rain == null
      ? null
      : `${formatRainfallPerDay(rain, unit)} · ${rainLevelForValue(rain).label}`,
  );

  const sun = readNumber(properties, monthKey("s", month));
  push("Sun", sun == null ? null : formatSunHours(sun));

  return stats.slice(0, 4);
}
