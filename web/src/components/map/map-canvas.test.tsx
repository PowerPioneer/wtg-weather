import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN1_SELECTED_LAYER,
  COUNTRY_SELECTED_LAYER,
} from "@/lib/map-style";

/**
 * The regression these cover: signed tile URLs are re-issued about a minute
 * before their 15-minute expiry, so the URL string changes roughly every 14
 * minutes while the page is open. Constructing the MapLibre instance from that
 * URL meant the map was destroyed and rebuilt at the initial centre and zoom on
 * that cadence — the user lost their pan and zoom mid-session, on both tiers.
 */

class FakeMap {
  static instances: FakeMap[] = [];

  opts: Record<string, unknown>;
  handlers: Record<string, unknown[]> = {};
  removed = false;
  setStyleCalls: unknown[] = [];
  maxZoomCalls: number[] = [];

  constructor(opts: Record<string, unknown>) {
    this.opts = opts;
    FakeMap.instances.push(this);
  }

  layerHandlers: Record<string, Record<string, unknown[]>> = {};
  filters: [string, unknown][] = [];

  addControl() {}
  on(event: string, a: unknown, b?: unknown) {
    (this.handlers[event] ||= []).push(b ?? a);
    if (typeof a === "string") {
      ((this.layerHandlers[a] ||= {})[event] ||= []).push(b);
    }
  }
  off() {}
  remove() {
    this.removed = true;
  }
  /** Mirrors the real map: a layer exists if the applied style declares it. */
  getLayer(id: string) {
    const style = (this.setStyleCalls.at(-1) ?? this.opts.style) as {
      layers?: { id: string }[];
    };
    return style?.layers?.find((layer) => layer.id === id) ?? null;
  }
  setFilter(layerId: string, filter: unknown) {
    this.filters.push([layerId, filter]);
  }
  /** Run the `style.load` callback the component registered at construction. */
  emitStyleLoad() {
    for (const handler of this.handlers["style.load"] ?? []) {
      (handler as () => void)();
    }
  }
  emitLayerEvent(event: string, layerId: string, payload: unknown) {
    for (const handler of this.layerHandlers[layerId]?.[event] ?? []) {
      (handler as (e: unknown) => void)(payload);
    }
  }
  getCanvas() {
    return { style: {} as Record<string, string> };
  }
  setPaintProperty() {}
  setStyle(style: unknown) {
    this.setStyleCalls.push(style);
  }
  setMaxZoom(zoom: number) {
    this.maxZoomCalls.push(zoom);
  }
  getZoom() {
    return 2;
  }
  setZoom() {}
  zoomIn() {}
  zoomOut() {}
}

vi.mock("maplibre-gl", () => {
  const NavigationControl = class {};
  return {
    default: { Map: FakeMap, NavigationControl },
    Map: FakeMap,
    NavigationControl,
  };
});

vi.mock("@/lib/pmtiles", () => ({ registerPmtilesProtocol: () => {} }));

const { MapCanvas } = await import("./map-canvas");

const FREE_A = "https://cdn.test/free.pmtiles?exp=1000&sig=aaa";
const FREE_B = "https://cdn.test/free.pmtiles?exp=2000&sig=bbb";
const PREMIUM = "https://cdn.test/premium.pmtiles?exp=1000&sig=ccc";

beforeEach(() => {
  FakeMap.instances = [];
});

afterEach(() => {
  cleanup();
});

describe("MapCanvas tile-URL handling", () => {
  it("keeps one map instance when a signed URL is re-issued", () => {
    const { rerender } = render(
      <MapCanvas freeTilesUrl={FREE_A} premiumTilesUrl={null} mode="preferences" month={4} />,
    );
    expect(FakeMap.instances).toHaveLength(1);

    rerender(
      <MapCanvas freeTilesUrl={FREE_B} premiumTilesUrl={null} mode="preferences" month={4} />,
    );

    expect(FakeMap.instances).toHaveLength(1);
    expect(FakeMap.instances[0].removed).toBe(false);
  });

  it("swaps the style in place rather than rebuilding the camera", () => {
    const { rerender } = render(
      <MapCanvas freeTilesUrl={FREE_A} premiumTilesUrl={null} mode="preferences" month={4} />,
    );
    const map = FakeMap.instances[0];
    expect(map.setStyleCalls).toHaveLength(0);

    rerender(
      <MapCanvas freeTilesUrl={FREE_B} premiumTilesUrl={null} mode="preferences" month={4} />,
    );

    expect(map.setStyleCalls).toHaveLength(1);
    expect(JSON.stringify(map.setStyleCalls[0])).toContain("sig=bbb");
    // `setStyle` leaves the camera alone; a style carrying its own centre or
    // zoom would defeat that, so the builder must not emit one.
    const style = map.setStyleCalls[0] as Record<string, unknown>;
    expect(style.center).toBeUndefined();
    expect(style.zoom).toBeUndefined();
  });

  it("does not restyle when only the month or mode changes", () => {
    // Those are applied through setPaintProperty; restyling would refetch tiles.
    const { rerender } = render(
      <MapCanvas freeTilesUrl={FREE_A} premiumTilesUrl={null} mode="preferences" month={4} />,
    );
    const map = FakeMap.instances[0];

    rerender(
      <MapCanvas freeTilesUrl={FREE_A} premiumTilesUrl={null} mode="temperature" month={9} />,
    );

    expect(map.setStyleCalls).toHaveLength(0);
  });

  it("restyles and lifts the zoom ceiling when premium entitlement arrives", () => {
    const { rerender } = render(
      <MapCanvas freeTilesUrl={FREE_A} premiumTilesUrl={null} mode="preferences" month={4} />,
    );
    const map = FakeMap.instances[0];
    expect(map.opts.maxZoom).toBe(5.5);

    rerender(
      <MapCanvas freeTilesUrl={FREE_A} premiumTilesUrl={PREMIUM} mode="preferences" month={4} />,
    );

    expect(FakeMap.instances).toHaveLength(1);
    expect(map.setStyleCalls).toHaveLength(1);
    expect(map.maxZoomCalls).toEqual([9]);
  });

  it("reports hovered features with their pointer position, and clears on leave", () => {
    const onFeatureHover = vi.fn();
    render(
      <MapCanvas
        freeTilesUrl={FREE_A}
        premiumTilesUrl={null}
        mode="preferences"
        month={4}
        onFeatureHover={onFeatureHover}
      />,
    );
    const map = FakeMap.instances[0];
    act(() => map.emitStyleLoad());

    const feature = { properties: { id: "GEO", name: "Georgia" } };
    act(() =>
      map.emitLayerEvent("mousemove", "wtg-country-fill", {
        features: [feature],
        point: { x: 12, y: 34 },
      }),
    );
    expect(onFeatureHover).toHaveBeenCalledWith({
      feature,
      point: { x: 12, y: 34 },
    });

    onFeatureHover.mockClear();
    act(() => map.emitLayerEvent("mouseleave", "wtg-country-fill", {}));
    expect(onFeatureHover).toHaveBeenCalledWith(null);
  });

  it("outlines the selected polygon, and re-applies the outline after a restyle", () => {
    // A style swap rebuilds every layer with its default "match nothing"
    // filter, so the outline has to be re-applied or a re-signed tile URL
    // would silently drop the selection the user is looking at.
    const { rerender } = render(
      <MapCanvas
        freeTilesUrl={FREE_A}
        premiumTilesUrl={null}
        mode="preferences"
        month={4}
        selectedFeatureId="GEO"
      />,
    );
    const map = FakeMap.instances[0];
    act(() => map.emitStyleLoad());

    const applied = map.filters.filter(([, filter]) =>
      JSON.stringify(filter).includes("GEO"),
    );
    expect(applied.map(([layerId]) => layerId)).toEqual([
      COUNTRY_SELECTED_LAYER,
      ADMIN1_SELECTED_LAYER,
    ]);

    map.filters = [];
    rerender(
      <MapCanvas
        freeTilesUrl={FREE_B}
        premiumTilesUrl={null}
        mode="preferences"
        month={4}
        selectedFeatureId="GEO"
      />,
    );
    act(() => map.emitStyleLoad());
    expect(
      map.filters.some(([, filter]) => JSON.stringify(filter).includes("GEO")),
    ).toBe(true);
  });

  it("clears the outline when the selection is dropped", () => {
    const { rerender } = render(
      <MapCanvas
        freeTilesUrl={FREE_A}
        premiumTilesUrl={null}
        mode="preferences"
        month={4}
        selectedFeatureId="GEO"
      />,
    );
    const map = FakeMap.instances[0];
    act(() => map.emitStyleLoad());
    map.filters = [];

    rerender(
      <MapCanvas
        freeTilesUrl={FREE_A}
        premiumTilesUrl={null}
        mode="preferences"
        month={4}
        selectedFeatureId={null}
      />,
    );

    expect(map.filters.length).toBeGreaterThan(0);
    for (const [, filter] of map.filters) {
      expect(JSON.stringify(filter)).not.toContain("GEO");
    }
  });

  it("builds the map only once tiles are available", () => {
    const { rerender } = render(
      <MapCanvas freeTilesUrl={null} premiumTilesUrl={null} mode="preferences" month={4} />,
    );
    expect(FakeMap.instances).toHaveLength(0);

    rerender(
      <MapCanvas freeTilesUrl={FREE_A} premiumTilesUrl={null} mode="preferences" month={4} />,
    );

    expect(FakeMap.instances).toHaveLength(1);
    // Constructed with the current URL, so no redundant restyle follows.
    expect(FakeMap.instances[0].setStyleCalls).toHaveLength(0);
  });
});
