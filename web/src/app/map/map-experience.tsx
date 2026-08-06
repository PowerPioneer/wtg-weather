"use client";

/**
 * Client-side map shell. This is the single module that pulls in MapLibre —
 * everything heavy (the MapCanvas component and the `maplibre-gl`/`pmtiles`
 * packages) is loaded through `next/dynamic` so the ~250KB map bundle stays
 * out of every other route's JS payload.
 *
 * Responsibilities:
 *   - orchestrate URL state (mode, month, preferences) via `useMapState`
 *   - fetch signed tile URLs via `useTileUrls`
 *   - show the display-mode picker (modal on desktop, sheet on mobile)
 *   - show the preferences panel (popout card on desktop, sheet on mobile)
 *   - host the premium-zoom upgrade popover (403 / max-zoom triggers)
 *   - own hover / selection: the hover card and the climate panel
 *   - render the legend and top-level controls
 */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import type maplibregl from "maplibre-gl";

import { Button } from "@/components/ui/button";
import { ClimatePanel } from "@/components/map/climate-panel";
import { MapHoverCard } from "@/components/map/map-hover-card";
import { MapLegend } from "@/components/map/map-legend";
import { DisplayModeModal } from "@/components/map/display-mode-modal";
import { DisplayModeSheet } from "@/components/map/display-mode-sheet";
import { PreferencesPanel } from "@/components/map/preferences-panel";
import { PreferencesSheet } from "@/components/map/preferences-sheet";
import {
  InlineUpgradePopover,
  type PremiumFeature,
} from "@/components/map/inline-upgrade-popover";
import type { MapFeatureHover } from "@/components/map/map-canvas";
import { useTileUrls } from "@/hooks/use-tile-urls";
import { useMapState } from "@/hooks/use-map-state";
import { useStoredPreferences } from "@/hooks/use-stored-preferences";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import { findCountryByIso2 } from "@/lib/countries";
import { DISPLAY_MODES, type DisplayModeId } from "@/lib/display-modes";
import {
  featureProperties,
  readFeatureIdentity,
  type FeatureIdentity,
  type FeatureProperties,
} from "@/lib/feature-climate";
import { MONTH_SHORT, MONTH_SLUGS } from "@/lib/months";
import { isDefaultPreferences } from "@/lib/scoring";

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
  /**
   * Slugs whose SSR country page is actually built. The registry names every
   * country on the map; only these have a page behind them until the real data
   * path lands, and the panel must not offer a button to a 404.
   */
  publishedCountrySlugs?: readonly string[];
};

/** A feature the user is pointing at or has clicked, decoded from its tile properties. */
type FeatureSelection = {
  identity: FeatureIdentity;
  properties: FeatureProperties;
};

type HoverSelection = FeatureSelection & { point: { x: number; y: number } };

export function MapExperience({
  isPremium,
  publishedCountrySlugs = [],
}: MapExperienceProps) {
  const {
    mode,
    month,
    preferences,
    setMode,
    setMonth,
    setPreferences,
    resetPreferences,
  } = useMapState();
  const tiles = useTileUrls({ premium: isPremium });

  // Signed-in users carry their preferences between devices; the URL still
  // wins, so a shared link shows the sender's map rather than the reader's.
  useStoredPreferences({ preferences, onHydrate: setPreferences });

  const [isMobile, setIsMobile] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<PremiumFeature | null>(null);
  const [selected, setSelected] = useState<FeatureSelection | null>(null);
  const [hovered, setHovered] = useState<HoverSelection | null>(null);

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

  // A click opens the climate panel rather than navigating: navigation was
  // both too abrupt and, for every ISO code missing from the old nine-entry
  // registry, a silent no-op — the map read as dead. The panel always opens,
  // even for a polygon with no country page, and says so.
  const handleFeatureSelect = useCallback(
    (feature: maplibregl.MapGeoJSONFeature) => {
      const properties = featureProperties(feature);
      const identity = readFeatureIdentity(properties);
      if (!identity) return;

      const country = findCountryByIso2(identity.iso2);
      trackEvent(ANALYTICS_EVENTS.mapFeatureSelect, {
        iso_a2: identity.iso2 || "none",
        level: identity.level,
        // A miss means either a codeless polygon (expected: Somaliland,
        // Northern Cyprus, the Siachen Glacier) or a registry that has drifted
        // from the tiles' Natural Earth vintage. Worth seeing in analytics
        // either way — the previous handler dropped it on the floor.
        registry_miss: country == null,
      });

      setSelected({ identity, properties });
      setHovered(null);
    },
    [],
  );

  const handleFeatureHover = useCallback((hover: MapFeatureHover | null) => {
    if (!hover) {
      setHovered(null);
      return;
    }
    const properties = featureProperties(hover.feature);
    const identity = readFeatureIdentity(properties);
    if (!identity) {
      setHovered(null);
      return;
    }
    setHovered({ identity, properties, point: hover.point });
  }, []);

  const closePanel = useCallback(() => setSelected(null), []);

  const published = useMemo(
    () => new Set(publishedCountrySlugs),
    [publishedCountrySlugs],
  );
  const selectedCountry = selected
    ? findCountryByIso2(selected.identity.iso2)
    : undefined;

  // Escape closes the panel — it is a dialog over the map, and the map keeps
  // keyboard focus for panning, so the key has to be handled at the document.
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selected]);

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

  // Tuning preferences while another variable is painted would look like the
  // sliders do nothing — only the `preferences` mode reads them. Switching is
  // the honest response to "recolour the map as I change this".
  const handlePreferencesChange = useCallback(
    (next: Parameters<typeof setPreferences>[0]) => {
      setPreferences(next);
      if (mode !== "preferences") setMode("preferences");
    },
    [mode, setMode, setPreferences],
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
  const prefsAreDefault = isDefaultPreferences(preferences);

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
          preferences={preferences}
          selectedFeatureId={selected?.identity.id ?? null}
          onPremiumZoomBlocked={handlePremiumZoomBlocked}
          onFeatureSelect={handleFeatureSelect}
          onFeatureHover={handleFeatureHover}
        />
      )}

      {/* Hover card — suppressed on touch, where there is no hover state and
          the card would only ever appear under the finger that just tapped. */}
      {hovered && !isMobile ? (
        <MapHoverCard
          identity={hovered.identity}
          properties={hovered.properties}
          point={hovered.point}
          mode={mode}
          month={month}
          preferences={preferences}
          countryName={findCountryByIso2(hovered.identity.iso2)?.name}
        />
      ) : null}

      {selected ? (
        <ClimatePanel
          identity={selected.identity}
          properties={selected.properties}
          month={month}
          preferences={preferences}
          country={selectedCountry}
          hasCountryPage={
            selectedCountry != null && published.has(selectedCountry.slug)
          }
          onClose={closePanel}
        />
      ) : null}

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
        <Button
          variant="secondary"
          size="sm"
          className="pointer-events-auto shadow-sm"
          onClick={() => setPrefsOpen((open) => !open)}
          aria-haspopup="dialog"
          aria-expanded={prefsOpen}
          data-testid="open-preferences"
        >
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
            Prefs
          </span>
          <span className="ml-2 text-[13px] font-medium">
            {prefsAreDefault ? "Default" : "Custom"}
          </span>
          {prefsAreDefault ? null : (
            <span
              aria-hidden="true"
              className="ml-1.5 size-1.5 rounded-full bg-accent"
            />
          )}
        </Button>
      </div>

      {/* Preferences — popout card on desktop, anchored under the pills. */}
      {prefsOpen && !isMobile ? (
        <div
          role="dialog"
          aria-label="Weather preferences"
          className="pointer-events-auto absolute left-4 top-[60px] z-20 w-[320px] rounded-lg border border-border bg-surface p-4 shadow-lg"
        >
          <PreferencesPanel
            value={preferences}
            onChange={handlePreferencesChange}
            onReset={resetPreferences}
            isPremium={isPremium}
            onUpgradeClick={handleUpgradeFromMap}
            onClose={() => setPrefsOpen(false)}
          />
        </div>
      ) : null}

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
        <PreferencesSheet
          open={prefsOpen}
          onOpenChange={setPrefsOpen}
          value={preferences}
          onChange={handlePreferencesChange}
          onReset={resetPreferences}
          isPremium={isPremium}
          onUpgradeClick={handleUpgradeFromMap}
        />
      ) : null}

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
