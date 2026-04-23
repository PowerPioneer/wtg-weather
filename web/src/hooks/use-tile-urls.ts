"use client";

/**
 * Resolves signed PMTiles URLs for the MapCanvas. Always fetches `free`;
 * additionally fetches `premium` when the session is entitled. A 403 on the
 * premium tier never crashes the map — it silently drops `premiumUrl` and
 * surfaces `{ premiumDenied: true }` so the UI can show an upgrade prompt.
 */

import { useEffect, useRef, useState } from "react";

import { fetchTileUrl } from "@/lib/api-client";
import type { Entitlement } from "@/lib/types";

export type TileUrls = {
  freeUrl: string | null;
  premiumUrl: string | null;
  /** True when a premium request was attempted and denied (403). */
  premiumDenied: boolean;
  loading: boolean;
  error: string | null;
};

// Re-request 60s before expiry so an in-flight pan never hits a 403 for a
// stale signature. `expiresAt` is unix seconds per the API contract.
const REFRESH_LEAD_SECONDS = 60;

export function useTileUrls(entitlement: Pick<Entitlement, "premium">): TileUrls {
  const { premium } = entitlement;
  const [freeUrl, setFreeUrl] = useState<string | null>(null);
  const [premiumUrl, setPremiumUrl] = useState<string | null>(null);
  const [premiumDenied, setPremiumDenied] = useState(false);
  const [freeDone, setFreeDone] = useState(false);
  const [premiumDone, setPremiumDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;

    const scheduleRefresh = (tier: "free" | "premium", expiresAt: number) => {
      const delayMs = Math.max(
        1_000,
        (expiresAt - REFRESH_LEAD_SECONDS) * 1000 - Date.now(),
      );
      const id = window.setTimeout(() => {
        if (!cancelled) void load(tier);
      }, delayMs);
      timers.current.push(id);
    };

    const markDone = (tier: "free" | "premium") => {
      if (tier === "free") setFreeDone(true);
      else setPremiumDone(true);
    };

    const load = async (tier: "free" | "premium") => {
      try {
        const result = await fetchTileUrl(tier);
        if (cancelled) return;
        if (result === "forbidden") {
          if (tier === "premium") setPremiumDenied(true);
          markDone(tier);
          return;
        }
        if (tier === "free") setFreeUrl(result.url);
        else setPremiumUrl(result.url);
        markDone(tier);
        scheduleRefresh(tier, result.expiresAt);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        markDone(tier);
      }
    };

    void load("free");
    if (premium) void load("premium");

    return () => {
      cancelled = true;
      for (const id of timers.current) window.clearTimeout(id);
      timers.current = [];
    };
  }, [premium]);

  const loading = !freeDone || (premium && !premiumDone);
  return { freeUrl, premiumUrl, premiumDenied, loading, error };
}
