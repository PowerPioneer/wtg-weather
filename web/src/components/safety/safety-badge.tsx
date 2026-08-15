import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type AdvisoryLevel = 1 | 2 | 3 | 4;

export type SafetyBadgeProps = {
  level: AdvisoryLevel;
  /** Optional source tag ("US", "UK", "CA", "AU", "DE", or "COMBINED"). */
  source?: string;
  size?: "sm" | "md" | "lg";
  /** Whether to render the word label ("Exercise normal precautions"). */
  showLabel?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, "children">;

export const ADVISORY_LABEL: Record<AdvisoryLevel, string> = {
  1: "Exercise normal precautions",
  2: "Exercise increased caution",
  3: "Reconsider travel",
  4: "Do not travel",
};

const LEVEL_BG = {
  1: "bg-advisory-normal",
  2: "bg-advisory-caution",
  3: "bg-advisory-reconsider",
  4: "bg-advisory-dnt",
} as const;

/**
 * The "Level N" line is deliberately NOT advisory-coloured. Levels 2 and 3
 * could not hold AA as text on `background` (3.41 and 4.21) without dragging
 * the whole advisory ramp darker than the fills need. Nothing is lost: the
 * numeral block beside it already carries the colour, and the wording below
 * carries the meaning — which is the rule this component documents below.
 */
const LEVEL_TEXT_CLASS = "text-text";

const SIZE_BLOCK = {
  sm: "h-7 w-7 text-[13px]",
  md: "h-9 w-9 text-[16px]",
  lg: "h-12 w-12 text-[22px]",
} as const;

/**
 * Combined or per-government advisory badge. Level number is the dominant
 * glyph; text label accompanies it so colour is never the sole carrier.
 *
 * The striped overlay mirrors the map-legend treatment — it differentiates
 * "safety" from "climate match" at a glance even before colour registers.
 */
export function SafetyBadge({
  level,
  source,
  size = "md",
  showLabel = true,
  className,
  ...rest
}: SafetyBadgeProps) {
  const label = ADVISORY_LABEL[level];
  const accessibleName = `${source ? `${source} advisory: ` : "Advisory: "}level ${level} — ${label}`;

  return (
    <div
      role="img"
      aria-label={accessibleName}
      className={cn("inline-flex items-center gap-3", className)}
      {...rest}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-sm font-display font-medium text-text-inverse",
          LEVEL_BG[level],
          SIZE_BLOCK[size],
        )}
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 6px)",
        }}
        aria-hidden="true"
      >
        {level}
      </div>
      {showLabel ? (
        <div className="flex flex-col">
          {source ? (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-subtle">
              {source}
            </span>
          ) : null}
          <span
            className={cn(
              "font-sans text-[13px] font-semibold leading-tight",
              LEVEL_TEXT_CLASS,
            )}
          >
            Level {level}
          </span>
          <span className="font-sans text-[12px] leading-snug text-text-muted">
            {label}
          </span>
        </div>
      ) : null}
    </div>
  );
}

