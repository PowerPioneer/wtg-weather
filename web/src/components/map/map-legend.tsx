"use client";

/**
 * Map legend. Swaps layout by mode kind:
 *   - qualitative (preferences)       → 4 coloured pills
 *   - ordinal-safety                  → 4 hatched swatches (pattern differentiates
 *                                       advisory from match colours at a glance)
 *   - sequential / diverging / ocean  → continuous gradient ramp + tick labels
 *
 * Renders with `prefers-reduced-motion` in mind: the cross-fade on mode change
 * is CSS-only and degrades to a hard swap.
 */

import { useUnit } from "@/components/units";
import type { DisplayMode, DisplayModeId } from "@/lib/display-modes";
import {
  DISPLAY_MODES,
  modeLegendSub,
  modeLegendTicks,
} from "@/lib/display-modes";
import { MONTH_SHORT, MONTH_SLUGS } from "@/lib/months";
import type { UnitSystem } from "@/lib/units";

export type MapLegendProps = {
  mode: DisplayModeId;
  month: number;
};

export function MapLegend({ mode, month }: MapLegendProps) {
  const m = DISPLAY_MODES[mode];
  const { unit } = useUnit();
  const monthLabel = MONTH_SHORT[MONTH_SLUGS[month - 1]];
  return (
    <div
      key={m.id}
      role="group"
      aria-label={`Map legend — ${m.label}`}
      className="animate-[wtg-fade-in_200ms_ease-out] rounded-[10px] border border-border bg-surface px-2.5 py-2 shadow-sm sm:px-3.5 sm:py-2.5"
    >
      {m.kind === "qualitative" && <QualitativeLegend m={m} />}
      {m.kind === "ordinal-safety" && <SafetyLegend m={m} />}
      {(m.kind === "sequential" || m.kind === "diverging" || m.kind === "diverging-ocean") && (
        <ContinuousLegend m={m} monthLabel={monthLabel} unit={unit} />
      )}
    </div>
  );
}

function QualitativeLegend({ m }: { m: DisplayMode }) {
  if (!("bins" in m.legend)) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 font-sans sm:gap-2">
      {/*
        The title is the first thing to go on a phone: four labelled colour
        pills explain themselves, and keeping the caption pushed "Avoid" onto
        a second line off the bottom of the map. The group's `aria-label`
        already names the legend, so nothing is lost to assistive tech.
      */}
      <span className="hidden border-r border-border pr-2 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted sm:inline">
        {m.legend.title}
      </span>
      {m.legend.bins.map((b) => (
        <span
          key={b.label}
          className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium text-white sm:px-2.5 sm:py-1 sm:text-xs"
          style={{ backgroundColor: b.hex }}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

function SafetyLegend({ m }: { m: DisplayMode }) {
  if (!("bins" in m.legend)) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 font-sans sm:gap-2">
      <span className="hidden max-w-[110px] border-r border-border pr-2 sm:block">
        <span className="block font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
          {m.legend.title}
        </span>
        <span className="block pt-0.5 text-[9px] text-text-subtle">{m.legend.sub}</span>
      </span>
      {m.legend.bins.map((b) => (
        <span
          key={b.label}
          className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium text-white sm:px-2.5 sm:py-1 sm:text-xs"
          style={{
            backgroundColor: b.hex,
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 6px)",
          }}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

function ContinuousLegend({
  m,
  monthLabel,
  unit,
}: {
  m: DisplayMode;
  monthLabel: string;
  unit: UnitSystem;
}) {
  if (!("ramp" in m.legend)) return null;
  const gradient = `linear-gradient(90deg, ${m.legend.ramp.join(", ")})`;
  // Caption and ticks move together or not at all: the colour stops beneath
  // them are metric thresholds against metric tile values and never move.
  const sub = modeLegendSub(m, unit);
  const ticks = modeLegendTicks(m, unit);
  return (
    <div className="w-full min-w-0 font-sans sm:min-w-[320px]">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
          {m.legend.title}
        </span>
        <span className="font-mono text-[11px] text-text-subtle">
          {monthLabel} · {sub}
        </span>
      </div>
      <div
        role="img"
        aria-label={`${m.legend.title} ramp from ${ticks[0]} to ${
          ticks[ticks.length - 1]
        }`}
        className="h-3.5 rounded border border-black/5"
        style={{ backgroundImage: gradient }}
      />
      <div className="mt-1 flex justify-between font-mono text-[10.5px] text-text">
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      {m.kind === "diverging-ocean" && (
        <p className="mt-1.5 font-mono text-[10px] italic text-text-subtle">
          Land areas dimmed in this view
        </p>
      )}
    </div>
  );
}
