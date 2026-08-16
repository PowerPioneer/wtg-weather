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
          if (tier === "premium") {
            setPremiumDenied(true);
            // Drop the URL we were holding, not just flag the refusal.
            //
            // This path is reached mid-session too: the signed URL is
            // re-requested about a minute before its 15-minute expiry, so a
            // subscription that lapses while the page is open comes back 403
            // on the next refresh. Keeping the old URL in state would leave
            // `buildMapStyle` pointing every layer at the premium archive
            // (RC-8 flipped country and admin-1 onto it, not just admin-2) via
            // a signature that is about to expire — and when it does, the map
            // goes blank rather than falling back. Clearing it restyles onto
            // the free archive while the free tiles are still good.
            setPremiumUrl(null);
          }
          markDone(tier);
          return;
        }
        if (tier === "free") setFreeUrl(result.url);
        else setPremiumUrl(result.url);
        markDone(tier);
        scheduleRefresh(tier, result.expiresAt);
      } catch (err) {
        if (cancelled) return;
        // Only the free tier is load-bearing. The premium archive is an
        // enhancement, so any failure to obtain it degrades to the free map
        // plus an upgrade prompt — it must never surface as a fatal error and
        // replace a map the visitor can already use.
        if (tier === "premium") {
          setPremiumDenied(true);
          setPremiumUrl(null);
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
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
