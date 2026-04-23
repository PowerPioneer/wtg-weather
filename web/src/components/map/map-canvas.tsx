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
  const [styleReady, setStyleReady] = useState(false);
  const [hasPremiumLayer, setHasPremiumLayer] = useState(false);
  const [hoverId, setHoverId] = useState<string | number | null>(null);

  // Style build depends on URLs; rebuild only when URLs change.
  useEffect(() => {
    if (!containerRef.current || !freeTilesUrl) return;
    registerPmtilesProtocol();

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
      setStyleReady(false);
      setHasPremiumLayer(false);
      map.remove();
    };
    // Intentional: mode/month updates are applied via setPaintProperty below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeTilesUrl, premiumTilesUrl]);

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
