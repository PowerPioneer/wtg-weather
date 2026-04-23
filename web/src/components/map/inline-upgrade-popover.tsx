"use client";

/**
 * Tiny "what am I missing?" popover shown when a free user taps a premium
 * display-mode tile. Deliberately lightweight: a stylised ramp preview, the
 * variable's label + description, and two CTAs — "Try premium" and "Dismiss".
 *
 * Positioned absolutely under its anchoring tile (the picker wraps us in a
 * `relative` div and passes `onDismiss` / `onUpgrade` handlers).
 */

import { cn } from "@/lib/cn";

export type PremiumFeature = "admin2" | "snow" | "sst" | "heat" | "humidity";

export type InlineUpgradePopoverProps = {
  feature: PremiumFeature;
  title: string;
  description: string;
  /** Colour ramp for the preview thumbnail. Optional — falls back to a neutral grey. */
  ramp?: readonly string[];
  onDismiss: () => void;
  onUpgrade: () => void;
  /** Positioning hint. Defaults to `center` (left:50%, translate-x). */
  anchor?: "left" | "center" | "right";
};

export function InlineUpgradePopover({
  feature,
  title,
  description,
  ramp,
  onDismiss,
  onUpgrade,
  anchor = "center",
}: InlineUpgradePopoverProps) {
  const gradientId = `wtg-upgrade-grad-${feature}`;
  const effectiveRamp = ramp && ramp.length > 1 ? ramp : ["#D9D5C8", "#9AA2AB"];
  return (
    <div
      role="dialog"
      aria-label={`Unlock ${title}`}
      data-feature={feature}
      className={cn(
        "absolute top-[calc(100%+8px)] z-30 w-[300px]",
        "rounded-lg border border-border bg-surface p-3.5 font-sans text-text shadow-lg",
        "animate-in fade-in-0 slide-in-from-top-1",
        anchor === "center" && "left-1/2 -translate-x-1/2",
        anchor === "right" && "right-0",
        anchor === "left" && "left-0",
      )}
    >
      {/* Preview thumbnail */}
      <div className="relative mb-2.5 h-[72px] overflow-hidden rounded border border-black/5 bg-surface-2">
        <svg viewBox="0 0 300 72" className="h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              {effectiveRamp.map((c, i) => (
                <stop
                  key={i}
                  offset={`${(i / (effectiveRamp.length - 1)) * 100}%`}
                  stopColor={c}
                />
              ))}
            </linearGradient>
          </defs>
          <path
            d="M20,20 L120,18 L140,40 L100,55 L40,52 Z"
            fill={`url(#${gradientId})`}
            opacity="0.95"
          />
          <path
            d="M150,15 L270,20 L265,50 L180,55 L160,40 Z"
            fill={`url(#${gradientId})`}
            opacity="0.95"
          />
          <path
            d="M175,55 L235,55 L225,66 L185,65 Z"
            fill={`url(#${gradientId})`}
            opacity="0.95"
          />
        </svg>
        <span className="absolute left-1.5 top-1.5 inline-flex items-center rounded-sm bg-surface/90 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-text">
          Preview · {title}
        </span>
      </div>

      <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
        <SparkleGlyph />
        Premium
      </div>
      <p className="font-display text-[16px] font-medium leading-[1.25] text-text">{title}</p>
      <p className="mt-1 text-[12.5px] leading-[1.45] text-text-muted">{description}</p>

      <div className="mt-3 flex gap-1.5">
        <button
          type="button"
          onClick={onUpgrade}
          className="flex-1 rounded-sm bg-text px-2.5 py-2 text-[12.5px] font-medium text-surface outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)] focus-visible:ring-offset-2"
        >
          Try Premium · €2.99/mo
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-sm px-2.5 py-2 text-[12.5px] font-medium text-text-muted outline-none transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)] focus-visible:ring-offset-2"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function SparkleGlyph() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
    </svg>
  );
}
