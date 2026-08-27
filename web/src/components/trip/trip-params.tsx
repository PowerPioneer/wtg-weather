import type { ReactNode } from "react";

import { TemperatureRange } from "@/components/units";
import {
  SAFETY_LIMIT_LABEL,
  clampSafetyMax,
  rainLevelForCeiling,
  type WeatherPreferences,
} from "@/lib/scoring";

type IconKind = "temp" | "rain" | "sun" | "safety";

function PrefIcon({ kind }: { kind: IconKind }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "temp":
      return (
        <svg {...common}>
          <path d="M14 14V5a2 2 0 1 0-4 0v9a4 4 0 1 0 4 0z" />
          <circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "rain":
      return (
        <svg {...common}>
          <path d="M7 16a5 5 0 1 1 9-4 4 4 0 0 1-1 8H8a3 3 0 0 1-1-4z" />
          <path d="M9 20l-1 2M13 20l-1 2M17 20l-1 2" />
        </svg>
      );
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
        </svg>
      );
    case "safety":
      return (
        <svg {...common}>
          <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" />
        </svg>
      );
  }
}

/**
 * What the trip was scored against.
 *
 * Three climate criteria, because three is what `SCORED_VARIABLES` scores and
 * therefore all a saved trip can carry, plus the traveller's advisory limit —
 * which scores nothing but vetoes anything above it, and so has to be visible
 * for the ranking below to make sense. The panel used to list five "free"
 * criteria (adding wind and a safety ceiling) and four "Premium" ones (snow,
 * sea-surface temperature, heat index, humidity), each marked "✓ matched" —
 * nine claims of which six named variables no scoring rule consults and none
 * of which was checked against anything. Widening scoring is a pipeline change
 * and a tile rebuild, not a label.
 */
export function TripParams({
  preferences,
  usesDefaults,
}: {
  preferences: WeatherPreferences;
  usesDefaults: boolean;
}) {
  const rainLevel = rainLevelForCeiling(preferences.rainMax);
  const rows: { key: IconKind; label: string; range: ReactNode }[] = [
    {
      key: "temp",
      label: "Temperature",
      range: (
        <TemperatureRange
          low={preferences.tempMin}
          high={preferences.tempMax}
        />
      ),
    },
    {
      key: "rain",
      label: "Rainfall",
      // The level is what the traveller chose; the ceiling is what was scored.
      range: `${rainLevel.label.toLowerCase()} or drier (${rainLevel.band})`,
    },
    { key: "sun", label: "Sunshine", range: `over ${preferences.sunMin} hr / day` },
    {
      key: "safety",
      label: "Safety",
      range: `advisories up to ${SAFETY_LIMIT_LABEL[
        clampSafetyMax(preferences.safetyMax)
      ].toLowerCase()}`,
    },
  ];

  return (
    <div className="rounded-md border border-border bg-surface px-5 py-4">
      <div className="mb-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
        Trip parameters
      </div>
      <div className="mb-2.5 font-mono text-[11px] text-text-subtle">
        {usesDefaults
          ? "Default preferences — the ranking below is the same one the map shows unchanged"
          : "Saved with this trip — the ranking below is scored against these"}
      </div>

      {rows.map((row) => (
        <div
          key={row.key}
          className="grid grid-cols-[24px_1fr] items-center gap-3.5 border-b border-dotted border-border py-3 last:border-b-0"
        >
          <div className="flex items-center text-text">
            <PrefIcon kind={row.key} />
          </div>
          <div>
            <div className="text-[13px] font-medium text-text">{row.label}</div>
            <div className="mt-0.5 font-mono text-[11px] text-text-subtle">
              {row.range}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
