"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Owner-only action rail. Most buttons are stubs until Phase 5.5 wires the
 * real /api/trips endpoints. The "Copy share link" button is wired to
 * `navigator.clipboard` so owners get an immediate confirmation.
 */
export function TripActionRail({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be unavailable (http, sandboxed iframes); fail quietly. */
    }
  }

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="mb-3 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
        Owner actions
      </div>
      <div className="flex flex-col gap-2">
        <Button variant="secondary" size="md" className="w-full justify-between">
          <span className="flex items-center gap-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M14 4l6 6L10 20H4v-6L14 4z" />
            </svg>
            Edit preferences
          </span>
          <span className="font-mono text-[10.5px] text-text-subtle">adjust ranges</span>
        </Button>
        <Button variant="secondary" size="md" className="w-full justify-between">
          <span className="flex items-center gap-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2zM10 21h4" />
            </svg>
            Add to alerts
          </span>
          <span className="font-mono text-[10.5px] text-text-subtle">weekly</span>
        </Button>

        <div className="rounded-sm border border-border bg-[#FCFBF8] px-3.5 py-3">
          <div className="mb-2 flex items-center gap-2.5 text-[12px] font-medium text-text">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="6" cy="12" r="2.5" />
              <circle cx="18" cy="6" r="2.5" />
              <circle cx="18" cy="18" r="2.5" />
              <path d="M8 11l8-4M8 13l8 4" />
            </svg>
            Share link
            <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-score-perfect">
              ● Public
            </span>
          </div>
          <div className="flex gap-1.5">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 rounded-sm border border-border bg-white px-2.5 py-1.5 font-mono text-[11px] text-text-muted"
            />
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1.5 rounded-sm bg-primary px-3 text-[11px] text-primary-foreground hover:bg-primary/90"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="8" y="8" width="12" height="12" rx="1" />
                <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
              </svg>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <Button variant="secondary" size="md" className="w-full justify-between">
          <span className="flex items-center gap-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M6 3h9l5 5v13H6z" />
              <path d="M14 3v6h6" />
            </svg>
            Export PDF
          </span>
          <span className="font-mono text-[10.5px] text-text-subtle">for client</span>
        </Button>
        <Button variant="secondary" size="md" className="w-full justify-start text-destructive">
          <span className="flex items-center gap-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" />
            </svg>
            Delete trip
          </span>
        </Button>
      </div>
    </div>
  );
}
