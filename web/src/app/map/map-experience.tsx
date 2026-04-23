"use client";

/**
 * Client-side map shell. This is the single module that pulls in MapLibre —
 * everything heavy (the MapCanvas component and the `maplibre-gl`/`pmtiles`
 * packages) is loaded through `next/dynamic` so the ~250KB map bundle stays
 * out of every other route's JS payload.
 *
 * Responsibilities:
 *   - orchestrate URL state (mode, month) via `useMapState`
 *   - fetch signed tile URLs via `useTileUrls`
 *   - show the display-mode picker (modal on desktop, sheet on mobile)
 *   - host the premium-zoom upgrade popover (403 / max-zoom triggers)
 *   - render the legend and top-level controls
 */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { MapLegend } from "@/components/map/map-legend";
import { DisplayModeModal } from "@/components/map/display-mode-modal";
import { DisplayModeSheet } from "@/components/map/display-mode-sheet";
import {
  InlineUpgradePopover,
  type PremiumFeature,
} from "@/components/map/inline-upgrade-popover";
import { useTileUrls } from "@/hooks/use-tile-urls";
import { useMapState } from "@/hooks/use-map-state";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import { DISPLAY_MODES, type DisplayModeId } from "@/lib/display-modes";
import { MONTH_SHORT, MONTH_SLUGS } from "@/lib/months";

const MapCanvas = dynamic(
  () => import("@/components/map/map-canvas").then((m) => m.MapCanvas),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="flex h-full w-full items-center justify-center bg-surface-sunken"
      >
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
          Loading map
        </span>
      </div>
    ),
  },
);

export type MapExperienceProps = {
  isPremium: boolean;
};

export function MapExperience({ isPremium }: MapExperienceProps) {
  const { mode, month, setMode, setMonth } = useMapState();
  const tiles = useTileUrls({ premium: isPremium });

  const [isMobile, setIsMobile] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<PremiumFeature | null>(null);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  // Tile 403 (entitlement changed mid-session) → surface upgrade popover.
  // This is an external-event → UI sync, which is exactly what effects are
  // for; the derived-state alternatives all require tracking a previously
  // seen denial transition and don't gain anything.
  useEffect(() => {
    if (tiles.premiumDenied) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUpgradeFeature("admin2");
    }
  }, [tiles.premiumDenied]);

  const handlePremiumZoomBlocked = useCallback(() => {
    if (!isPremium) setUpgradeFeature("admin2");
  }, [isPremium]);

  const handleModeChange = useCallback(
    (next: DisplayModeId) => {
      if (next === mode) return;
      setMode(next);
      trackEvent(ANALYTICS_EVENTS.mapLayerChange, {
        mode: next,
        tier: DISPLAY_MODES[next].tier,
      });
    },
    [mode, setMode],
  );

  const handleUpgradeFromMap = useCallback((feature: PremiumFeature) => {
    setUpgradeFeature(feature);
    trackEvent(ANALYTICS_EVENTS.upgradeClick, { source: "map_layer", feature });
  }, []);

  const handleUpgradeCta = useCallback(() => {
    trackEvent(ANALYTICS_EVENTS.upgradeClick, {
      source: "map_popover",
      feature: upgradeFeature ?? "unknown",
    });
    setUpgradeFeature(null);
    window.location.href = "/pricing";
  }, [upgradeFeature]);

  const activeMode = DISPLAY_MODES[mode];
  const monthLabel = MONTH_SHORT[MONTH_SLUGS[month - 1]];

  return (
    <div className="relative h-[calc(100vh-var(--size-header,56px))] w-full bg-surface-sunken">
      {tiles.error ? (
        <MapError message={tiles.error} />
      ) : (
        <MapCanvas
          freeTilesUrl={tiles.freeUrl}
          premiumTilesUrl={tiles.premiumUrl}
          mode={mode}
          month={month}
          onPremiumZoomBlocked={handlePremiumZoomBlocked}
        />
      )}

      {/* Top-left: mode + month pills */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="pointer-events-auto shadow-sm"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          data-testid="open-display-mode"
        >
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
            Display
          </span>
          <span className="ml-2 text-[13px] font-medium">{activeMode.label}</span>
        </Button>
        <div className="pointer-events-auto flex items-center gap-1 rounded-md border border-border bg-surface px-1 py-1 shadow-sm">
          <MonthNudge
            direction="prev"
            onClick={() => setMonth(((month + 10) % 12) + 1)}
          />
          <span className="min-w-[48px] text-center font-mono text-[12px] font-medium text-text">
            {monthLabel}
          </span>
          <MonthNudge
            direction="next"
            onClick={() => setMonth((month % 12) + 1)}
          />
        </div>
      </div>

      {/* Bottom-left: legend */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 max-w-[calc(100%-2rem)]">
        <div className="pointer-events-auto">
          <MapLegend mode={mode} month={month} />
        </div>
      </div>

      {/* Upgrade popover — pinned bottom-right when triggered */}
      {upgradeFeature && (
        <div className="pointer-events-auto absolute bottom-4 right-4 z-20 w-[300px]">
          <div className="relative">
            <InlineUpgradePopover
              feature={upgradeFeature}
              title={upgradeTitle(upgradeFeature)}
              description={upgradeDescription(upgradeFeature)}
              ramp={upgradeRamp(upgradeFeature)}
              anchor="left"
              onDismiss={() => setUpgradeFeature(null)}
              onUpgrade={handleUpgradeCta}
            />
          </div>
        </div>
      )}

      {isMobile ? (
        <DisplayModeSheet
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          activeId={mode}
          onChange={handleModeChange}
          isPremium={isPremium}
          onUpgradeClick={handleUpgradeFromMap}
        />
      ) : (
        <DisplayModeModal
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          activeId={mode}
          onChange={handleModeChange}
          isPremium={isPremium}
          onUpgradeClick={handleUpgradeFromMap}
        />
      )}
    </div>
  );
}

function MonthNudge({
  direction,
  onClick,
}: {
  direction: "prev" | "next";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Previous month" : "Next month"}
      className="inline-flex size-6 items-center justify-center rounded-sm text-text-muted outline-none transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)]"
    >
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {direction === "prev" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 6l6 6-6 6" />}
      </svg>
    </button>
  );
}

function MapError({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-surface-sunken p-6">
      <div className="max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-destructive">
          Map unavailable
        </div>
        <p className="mt-2 font-display text-[18px] font-medium text-text">
          Something went wrong loading the tiles.
        </p>
        <p className="mt-1 text-[13px] text-text-muted">{message}</p>
      </div>
    </div>
  );
}

function upgradeTitle(feature: PremiumFeature): string {
  switch (feature) {
    case "admin2":
      return "District-level detail";
    case "snow":
      return DISPLAY_MODES.snow.label;
    case "sst":
      return DISPLAY_MODES.sst.label;
    case "heat":
      return DISPLAY_MODES.heat.label;
    case "humidity":
      return DISPLAY_MODES.humidity.label;
  }
}

function upgradeDescription(feature: PremiumFeature): string {
  if (feature === "admin2") {
    return "Zoom past the country level into admin-2 districts — precise climate and safety inside every country.";
  }
  return DISPLAY_MODES[feature].desc;
}

function upgradeRamp(feature: PremiumFeature): readonly string[] | undefined {
  if (feature === "admin2") return undefined;
  const legend = DISPLAY_MODES[feature].legend;
  return "ramp" in legend ? legend.ramp : undefined;
}
