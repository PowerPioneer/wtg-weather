"use client";

/**
 * Owner actions: rename, share, delete.
 *
 * Every button here used to be a stub — "Edit preferences", "Add to alerts",
 * "Export PDF" and "Delete trip" did nothing at all, and the share box showed
 * a fixture URL (`atlasweather.io/t/8h2k9p-honeymoon`) that resolved nowhere.
 * What is left is what the API can actually do; PDF export is on the product
 * backlog, not implemented behind a button that looks implemented.
 *
 * Sharing is opt-in: no link exists until the owner asks for one, and revoking
 * makes the existing link 404 immediately.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  deleteTrip,
  isUnauthorized,
  shareTrip,
  unshareTrip,
  updateTrip,
} from "@/lib/api-client";

export function TripActionRail({
  tripId,
  title,
  shareToken,
  siteUrl,
}: {
  tripId: string;
  title: string;
  shareToken: string | null;
  /** Origin for the share link, so the copied URL is absolute. */
  siteUrl: string;
}) {
  const router = useRouter();
  const [token, setToken] = useState(shareToken);
  const [name, setName] = useState(title);
  const [busy, setBusy] = useState<null | "rename" | "share" | "delete">(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareUrl = token ? `${siteUrl}/trip/share/${token}` : null;

  function fail(err: unknown, fallback: string) {
    setError(isUnauthorized(err) ? "Your session expired. Sign in again." : fallback);
  }

  async function rename(event: React.FormEvent) {
    event.preventDefault();
    const next = name.trim();
    if (!next || next === title) return;
    setBusy("rename");
    setError(null);
    try {
      await updateTrip(tripId, { title: next });
      router.refresh();
    } catch (err) {
      fail(err, "Couldn't rename that. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleShare() {
    setBusy("share");
    setError(null);
    try {
      if (token) {
        await unshareTrip(tripId);
        setToken(null);
      } else {
        setToken(await shareTrip(tripId));
      }
    } catch (err) {
      fail(err, "Couldn't change sharing. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    // A trip is not recoverable, and the API has no undo. `confirm` is the
    // browser's own modal: available with no JS bundle of ours, and the one
    // dialog users already recognise as "this is final".
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setBusy("delete");
    setError(null);
    try {
      await deleteTrip(tripId);
      router.push("/account?s=trips");
      router.refresh();
    } catch (err) {
      fail(err, "Couldn't delete that. Try again.");
      setBusy(null);
    }
  }

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard is unavailable over http and in sandboxed frames; the input
         is selectable either way, so there is nothing to recover from. */
    }
  }

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="mb-3 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
        Owner actions
      </div>

      <form onSubmit={rename} className="mb-3">
        <label
          htmlFor="trip-title"
          className="mb-1 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-subtle"
        >
          Title
        </label>
        <div className="flex gap-1.5">
          <input
            id="trip-title"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            className="flex-1 rounded-sm border border-border bg-white px-2.5 py-1.5 text-[12.5px] text-text"
          />
          <Button
            type="submit"
            variant="secondary"
            size="md"
            disabled={busy !== null || name.trim() === "" || name.trim() === title}
          >
            {busy === "rename" ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>

      <div className="rounded-sm border border-border bg-[#FCFBF8] px-3.5 py-3">
        <div className="mb-2 flex items-center gap-2.5 text-[12px] font-medium text-text">
          Share link
          <span
            className={
              "ml-auto font-mono text-[10px] uppercase tracking-[0.1em] " +
              (token ? "text-score-perfect" : "text-text-subtle")
            }
          >
            {token ? "● Anyone with the link" : "○ Private"}
          </span>
        </div>

        {shareUrl && (
          <div className="mb-2 flex gap-1.5">
            <input
              readOnly
              value={shareUrl}
              aria-label="Share link"
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-sm border border-border bg-white px-2.5 py-1.5 font-mono text-[11px] text-text-muted"
            />
            <button
              type="button"
              onClick={copy}
              className="rounded-sm bg-primary px-3 text-[11px] text-primary-foreground hover:bg-primary/90"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}

        <Button
          variant="secondary"
          size="md"
          className="w-full"
          onClick={toggleShare}
          disabled={busy !== null}
        >
          {busy === "share"
            ? "Working…"
            : token
              ? "Stop sharing"
              : "Create share link"}
        </Button>
        {token && (
          <p className="mt-2 font-mono text-[10.5px] leading-[1.5] text-text-subtle">
            Anyone with this link can view the trip. Stopping makes it stop
            working immediately.
          </p>
        )}
      </div>

      <Button
        variant="secondary"
        size="md"
        className="mt-2 w-full justify-start text-destructive"
        onClick={remove}
        disabled={busy !== null}
      >
        {busy === "delete" ? "Deleting…" : "Delete trip"}
      </Button>

      {error && (
        <p role="alert" className="mt-2 font-mono text-[11px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
