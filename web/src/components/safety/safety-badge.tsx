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
  /**
   * Draw the block in neutral `--color-border-strong` instead of its level
   * colour. For advisory data the payload says is out of date: the level is
   * still reported — it is the best anyone has — but it stops being asserted
   * in the palette that means "we checked". `HANDOFF.md` § Risks.
   */
  muted?: boolean;
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

const LEVEL_TEXT = {
  1: "text-text",
  2: "text-advisory-caution",
  3: "text-advisory-reconsider",
  4: "text-advisory-dnt",
} as const;

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
  muted = false,
  className,
  ...rest
}: SafetyBadgeProps) {
  const label = ADVISORY_LABEL[level];
  // Colour is never the sole carrier of anything here, so the muted state says
  // so in the accessible name too — a screen reader gets the same caveat a
  // sighted reader gets from the grey block.
  const accessibleName =
    `${source ? `${source} advisory: ` : "Advisory: "}level ${level} — ${label}` +
    (muted ? " (data may be out of date)" : "");

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
          muted ? "bg-border-strong" : LEVEL_BG[level],
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
              muted ? "text-text-muted" : LEVEL_TEXT[level],
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

