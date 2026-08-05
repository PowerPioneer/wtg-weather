"use client";

/**
 * MapLibre container. One instance per page. Paint / zoom updates on a mode
 * or month change happen via `setPaintProperty` — NEVER by refetching tiles.
 *
 * Route-split: this module is the sole import point for `maplibre-gl` and
 * `pmtiles`. Lazy-load it with `next/dynamic` so the 250KB map bundle stays
 * out of every other route's JS payload.
 */

import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import {
  ADMIN2_FILL_LAYER,
  FILL_LAYER_IDS,
  buildFillColorExpression,
  buildFillOpacityExpression,
  buildMapStyle,
} from "@/lib/map-style";
import { registerPmtilesProtocol } from "@/lib/pmtiles";
import type { DisplayModeId } from "@/lib/display-modes";
import { DISPLAY_MODES } from "@/lib/display-modes";

import "maplibre-gl/dist/maplibre-gl.css";

export type MapCanvasProps = {
  freeTilesUrl: string | null;
  premiumTilesUrl: string | null;
  mode: DisplayModeId;
  /** 1-indexed month (1 = January). */
  month: number;
  /** Fires when the user tries to zoom past the free tier's max zoom. */
  onPremiumZoomBlocked?: () => void;
  /** Fires on click — feature properties include `iso`, `name`, etc. */
  onFeatureSelect?: (feature: maplibregl.MapGeoJSONFeature) => void;
};

const FREE_MAX_ZOOM = 5.5;
const PREMIUM_MAX_ZOOM = 9;
const INITIAL_CENTER: [number, number] = [10, 25];
const INITIAL_ZOOM = 1.8;
const MIN_ZOOM = 1;

export function MapCanvas({
  freeTilesUrl,
  premiumTilesUrl,
  mode,
  month,
  onPremiumZoomBlocked,
  onFeatureSelect,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // Which URL pair the live style was built from, so a re-render that did not
  // change them does not trigger a pointless restyle.
  const appliedUrlsRef = useRef<string | null>(null);
  const urlKey = `${freeTilesUrl ?? ""}|${premiumTilesUrl ?? ""}`;
  const [styleReady, setStyleReady] = useState(false);
  const [hasPremiumLayer, setHasPremiumLayer] = useState(false);
  const [hoverId, setHoverId] = useState<string | number | null>(null);

  // Signed tile URLs are re-issued shortly before their 15-minute expiry, so
  // the URL string changes roughly every 14 minutes for as long as the page is
  // open. Tying the map's *construction* to it meant the instance was torn
  // down and rebuilt at INITIAL_CENTER/INITIAL_ZOOM on that cadence, throwing
  // the user back to world view mid-session. Construction is therefore keyed
  // only on whether tiles are available at all; a URL change swaps the style
  // in place below, which leaves the camera untouched.
  const hasTiles = freeTilesUrl != null;

  useEffect(() => {
    if (!containerRef.current || !freeTilesUrl) return;
    registerPmtilesProtocol();
    appliedUrlsRef.current = urlKey;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle({
        freeTilesUrl,
        premiumTilesUrl,
        mode,
        month,
      }),
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: premiumTilesUrl ? PREMIUM_MAX_ZOOM : FREE_MAX_ZOOM,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchZoomRotate: true,
      keyboard: true,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("style.load", () => {
      setStyleReady(true);
      setHasPremiumLayer(map.getLayer(ADMIN2_FILL_LAYER) != null);
    });
    mapRef.current = map;

    return () => {
      mapRef.current = null;
      appliedUrlsRef.current = null;
      setStyleReady(false);
      setHasPremiumLayer(false);
      map.remove();
    };
    // Intentional: this effect owns the map's lifetime and must run exactly
    // once per mount. The tile URLs, mode and month it reads are the values at
    // construction; each is kept current afterwards by an effect of its own —
    // URLs by the restyle effect below, mode/month by the paint effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTiles]);

  // Swap the style in place when a signed URL is re-issued, or when premium
  // entitlement appears or lapses. `setStyle` preserves the camera, so this is
  // invisible to the user beyond the tiles reloading.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !freeTilesUrl) return;
    // Already applied at construction — mode/month changes must not restyle.
    if (appliedUrlsRef.current === urlKey) return;
    appliedUrlsRef.current = urlKey;

    setStyleReady(false);
    map.setMaxZoom(premiumTilesUrl ? PREMIUM_MAX_ZOOM : FREE_MAX_ZOOM);
    map.setStyle(buildMapStyle({ freeTilesUrl, premiumTilesUrl, mode, month }));
  }, [urlKey, freeTilesUrl, premiumTilesUrl, mode, month]);

  // Live paint updates — mode, month.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const fillColor = buildFillColorExpression(mode, month);
    const opacity = buildFillOpacityExpression(mode);
    for (const layerId of FILL_LAYER_IDS) {
      if (!map.getLayer(layerId)) continue;
      map.setPaintProperty(layerId, "fill-color", fillColor);
      map.setPaintProperty(layerId, "fill-opacity", opacity);
    }
  }, [mode, month, styleReady]);

  // Hover + click interactivity, plus the premium-zoom gate.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    const onMouseMove = (
      event: maplibregl.MapLayerMouseEvent,
    ) => {
      const feature = event.features?.[0];
      if (!feature) return;
      setHoverId(feature.id ?? null);
      map.getCanvas().style.cursor = "pointer";
    };
    const onMouseLeave = () => {
      setHoverId(null);
      map.getCanvas().style.cursor = "";
    };
    const onClick = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (feature && onFeatureSelect) onFeatureSelect(feature);
    };

    // Listen on every fill layer that exists in the current style.
    const activeLayers = FILL_LAYER_IDS.filter((id) => map.getLayer(id));
    for (const id of activeLayers) {
      map.on("mousemove", id, onMouseMove);
      map.on("mouseleave", id, onMouseLeave);
      map.on("click", id, onClick);
    }

    const onZoom = () => {
      if (!premiumTilesUrl && map.getZoom() > FREE_MAX_ZOOM - 0.01) {
        // Clamp and notify the page, which shows the upgrade popover.
        map.setZoom(FREE_MAX_ZOOM);
        onPremiumZoomBlocked?.();
      }
    };
    map.on("zoom", onZoom);

    return () => {
      for (const id of activeLayers) {
        map.off("mousemove", id, onMouseMove);
        map.off("mouseleave", id, onMouseLeave);
        map.off("click", id, onClick);
      }
      map.off("zoom", onZoom);
    };
  }, [styleReady, premiumTilesUrl, onFeatureSelect, onPremiumZoomBlocked]);

  // Keyboard zoom. MapLibre's built-in keyboard handler already covers arrow
  // pan + shift-arrow rotate; we bind +/- explicitly because the default
  // "=" key is inconsistent across layouts.
  useEffect(() => {
    const el = containerRef.current;
    const map = mapRef.current;
    if (!el || !map) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        map.zoomIn();
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        map.zoomOut();
      }
    };
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, []);

  const modeLabel = DISPLAY_MODES[mode].label;

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={`Climate map — ${modeLabel}. Arrow keys pan, plus and minus zoom.`}
      aria-describedby="wtg-map-a11y-hint"
      tabIndex={0}
      className="relative h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)] focus-visible:ring-offset-2"
      data-mode={mode}
      data-month={month}
      data-has-premium-layer={hasPremiumLayer ? "true" : "false"}
      data-hover-id={hoverId ?? ""}
    >
      <span id="wtg-map-a11y-hint" className="sr-only">
        Interactive climate map. Use arrow keys to pan. Use plus and minus to zoom.
        Press Tab to move focus to the controls that overlay the map.
      </span>
    </div>
  );
}
