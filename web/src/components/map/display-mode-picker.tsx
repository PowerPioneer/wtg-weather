"use client";

/**
 * The shared innards of the desktop modal and the mobile sheet — a scrollable
 * grid of the ten display modes in four groups. Premium tiles render locked
 * when the session is not entitled; clicking a locked tile opens an inline
 * upgrade popover (see `inline-upgrade-popover.tsx`) instead of the mode.
 */

import { useState } from "react";

import { cn } from "@/lib/cn";
import {
  DISPLAY_MODES,
  DISPLAY_MODE_GROUPS,
  type DisplayMode,
  type DisplayModeId,
} from "@/lib/display-modes";

import { InlineUpgradePopover, type PremiumFeature } from "./inline-upgrade-popover";

export type DisplayModePickerProps = {
  activeId: DisplayModeId;
  onChange: (id: DisplayModeId) => void;
  isPremium: boolean;
  layout?: "desktop" | "mobile";
  onUpgradeClick?: (feature: PremiumFeature) => void;
};

export function DisplayModePicker({
  activeId,
  onChange,
  isPremium,
  layout = "desktop",
  onUpgradeClick,
}: DisplayModePickerProps) {
  const [popoverFor, setPopoverFor] = useState<DisplayModeId | null>(null);
  const cols = layout === "mobile" ? 2 : 3;
  const heroGroup = DISPLAY_MODE_GROUPS[0];
  const climateGroup = DISPLAY_MODE_GROUPS[1];
  const safetyGroup = DISPLAY_MODE_GROUPS[2];
  const premiumGroup = DISPLAY_MODE_GROUPS[3];

  function renderTile(id: DisplayModeId) {
    const mode = DISPLAY_MODES[id];
    const locked = mode.tier === "premium" && !isPremium;
    const active = activeId === id;
    const popoverOpen = popoverFor === id;
    return (
      <div key={id} className="relative">
        <ModeTile
          mode={mode}
          active={active}
          locked={locked}
          popoverOpen={popoverOpen}
          layout={layout}
          onClick={() => {
            if (locked) {
              setPopoverFor(popoverOpen ? null : id);
              return;
            }
            setPopoverFor(null);
            onChange(id);
          }}
        />
        {popoverOpen && (
          <InlineUpgradePopover
            feature={upgradeFeatureForMode(id)}
            title={mode.label}
            description={mode.desc}
            ramp={"ramp" in mode.legend ? mode.legend.ramp : undefined}
            onDismiss={() => setPopoverFor(null)}
            onUpgrade={() => {
              onUpgradeClick?.(upgradeFeatureForMode(id));
              setPopoverFor(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="font-sans">
      {/* Hero */}
      <div>{renderTile(heroGroup.items[0])}</div>

      <SectionLabel>{climateGroup.label}</SectionLabel>
      <div className={cn("grid gap-2", cols === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {climateGroup.items.map(renderTile)}
      </div>

      <SectionLabel right="Not a climate variable">{safetyGroup.label}</SectionLabel>
      <div>{renderTile(safetyGroup.items[0])}</div>

      <SectionLabel right={isPremium ? "Unlocked" : "Upgrade to unlock"}>
        {premiumGroup.label}
      </SectionLabel>
      <div className={cn("grid gap-2", cols === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {premiumGroup.items.map(renderTile)}
      </div>

      {!isPremium && (
        <div className="mt-4 rounded border border-border bg-background px-3 py-2.5 text-[11.5px] leading-relaxed text-text-muted">
          Unlock all 10 variables, saved trips, percentile bands, and no ads for{" "}
          <strong className="text-text">€2.99/mo</strong>.
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children, right }: { children: React.ReactNode; right?: string }) {
  return (
    <div className="mb-2.5 mt-4 flex items-baseline justify-between">
      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
        {children}
      </span>
      {right && <span className="font-mono text-[11px] text-text-subtle">{right}</span>}
    </div>
  );
}

function ModeTile({
  mode,
  active,
  locked,
  popoverOpen,
  layout,
  onClick,
}: {
  mode: DisplayMode;
  active: boolean;
  locked: boolean;
  popoverOpen: boolean;
  layout: "desktop" | "mobile";
  onClick: () => void;
}) {
  const isHero = mode.id === "preferences";
  const paletteStrip = renderPaletteStrip(mode, active);

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      data-locked={locked ? "true" : "false"}
      data-mode={mode.id}
      className={cn(
        "relative flex w-full items-start gap-2.5 rounded-md border p-3.5 text-left font-sans transition-[background,border-color,box-shadow] duration-150 ease-out",
        "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)] focus-visible:ring-offset-2",
        isHero ? "flex-row items-center" : "flex-col justify-between",
        layout === "mobile" ? "min-h-[72px]" : isHero ? "min-h-[80px]" : "min-h-[88px]",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : popoverOpen
            ? "border-accent bg-surface text-text"
            : "border-border bg-surface text-text hover:border-border-strong hover:shadow-sm",
        locked && !active && "text-text-subtle",
      )}
    >
      {isHero ? (
        <>
          <span
            className={cn(
              "flex size-10 flex-shrink-0 items-center justify-center rounded-md",
              active ? "bg-white/15 text-accent-subtle" : "bg-surface-2 text-text",
            )}
            aria-hidden="true"
          >
            <Icon name={mode.id} size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold tracking-[-0.005em]">{mode.label}</span>
            <span
              className={cn(
                "mt-0.5 block text-xs leading-snug",
                active ? "text-primary-foreground/80" : "text-text-muted",
              )}
            >
              Your ideal weather score map
            </span>
          </span>
          <span className="flex flex-shrink-0 gap-1">
            {"bins" in mode.legend &&
              mode.legend.bins.map((b) => (
                <span
                  key={b.label}
                  className="size-4 rounded-sm border border-black/10"
                  style={{ backgroundColor: b.hex }}
                  aria-hidden="true"
                />
              ))}
          </span>
          {active && <ActiveBadge />}
        </>
      ) : (
        <>
          <span className="flex w-full items-center justify-between">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-sm",
                active ? "bg-white/15 text-white" : "bg-background text-text",
              )}
              aria-hidden="true"
            >
              <Icon name={mode.id} size={16} />
            </span>
            {locked ? (
              <span className="inline-flex items-center gap-1 rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-accent">
                <LockGlyph size={10} />
                PRO
              </span>
            ) : active ? (
              <ActiveBadge inline />
            ) : null}
          </span>
          <span className="block w-full text-[13px] font-medium leading-tight">{mode.label}</span>
          <span className={cn("block", active && "opacity-90")}>{paletteStrip}</span>
        </>
      )}
    </button>
  );
}

function LockGlyph({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function ActiveBadge({ inline = false }: { inline?: boolean }) {
  return (
    <span
      className={cn(
        "font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-accent-subtle",
        !inline && "absolute right-3 top-2.5",
      )}
    >
      Active
    </span>
  );
}

function renderPaletteStrip(mode: DisplayMode, active: boolean) {
  if ("bins" in mode.legend) {
    return (
      <span className="flex gap-0.5 overflow-hidden rounded-sm">
        {mode.legend.bins.map((b, i) => (
          <span
            key={i}
            className={cn("h-1 w-2", active && "opacity-90")}
            style={{ backgroundColor: b.hex }}
            aria-hidden="true"
          />
        ))}
      </span>
    );
  }
  if ("ramp" in mode.legend) {
    return (
      <span
        className="block h-1 w-9 rounded-sm"
        style={{ backgroundImage: `linear-gradient(90deg, ${mode.legend.ramp.join(", ")})` }}
        aria-hidden="true"
      />
    );
  }
  return null;
}

function upgradeFeatureForMode(id: DisplayModeId): PremiumFeature {
  switch (id) {
    case "snow":
      return "snow";
    case "sst":
      return "sst";
    case "heat":
      return "heat";
    case "humidity":
      return "humidity";
    default:
      return "admin2";
  }
}

// Inline icon using the Lucide-flavoured single-stroke SVGs from the design
// reference. Kept inline (rather than depending on `lucide-react` for every
// glyph) so the picker stays under its bundle slice.
function Icon({ name, size }: { name: DisplayModeId; size: number }) {
  const paths = ICON_PATHS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

const ICON_PATHS: Record<DisplayModeId, string[]> = {
  preferences: [
    "M12 2 L3 7 L3 17 L12 22 L21 17 L21 7 Z",
    "M12 12 L12 22",
    "M3 7 L12 12 L21 7",
  ],
  temperature: [
    "M14 4a2 2 0 0 0-4 0v10.5a4 4 0 1 0 4 0z",
    "M12 9v5.5",
  ],
  rainfall: [
    "M8 19v2M12 17v4M16 19v2",
    "M16 14a4 4 0 0 0 0-8 5 5 0 0 0-9.5-1A4.5 4.5 0 0 0 6.5 14Z",
  ],
  sunshine: [
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41",
  ],
  wind: [
    "M4 10h11a3 3 0 1 0-3-3",
    "M4 14h16a3 3 0 1 1-3 3",
    "M4 18h7",
  ],
  safety: [
    "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    "M9 12l2 2 4-4",
  ],
  snow: [
    "M12 2v20M2 12h20",
    "M5 5l14 14M19 5L5 19",
  ],
  sst: [
    "M2 12c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0",
    "M2 17c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0",
  ],
  heat: [
    "M8 14a4 4 0 0 0 8 0c0-2-1-3-2-4.5-1-1.5-1-3 0-4.5-2 1-4 3-4 5 0 2 2 2 2 4a2 2 0 0 1-4 0z",
  ],
  humidity: [
    "M12 2s6 7 6 12a6 6 0 1 1-12 0c0-5 6-12 6-12z",
    "M8 14a4 4 0 0 0 4 4",
  ],
};
