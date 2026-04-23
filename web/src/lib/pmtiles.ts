/**
 * Registers the `pmtiles://` protocol on MapLibre so a single signed URL
 * (`pmtiles://https://cdn.../free.pmtiles?exp=…&sig=…`) can be used as a
 * vector source. Idempotent — safe to call from React effects that re-run.
 */

import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";

let registered = false;

export function registerPmtilesProtocol(): void {
  if (registered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  registered = true;
}
