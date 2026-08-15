"use client";

/**
 * The alerts list in `/account`, with its controls live.
 *
 * The rows are rendered server-side and handed here as `initial`, so the
 * section still paints in the first response and reads correctly with JS off
 * — what JS adds is the pause switch and delete. Pausing is a real state on
 * the API (`PATCH /api/alerts/{id}`), not a delete: someone who wants quiet
 * for a month should not lose the definition.
 *
 * The toggle used to be a `<div role="img">` — a picture of a switch, with no
 * way to operate it and nothing behind it.
 */

import { useState } from "react";

import { cn } from "@/lib/cn";
import { deleteAlert, isUnauthorized, setAlertActive } from "@/lib/api-client";
import type { AccountAlert } from "@/lib/types";

export function AlertsList({ initial }: { initial: readonly AccountAlert[] }) {
  const [alerts, setAlerts] = useState<readonly AccountAlert[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function fail(err: unknown, fallback: string) {
    setError(isUnauthorized(err) ? "Your session expired. Sign in again." : fallback);
  }

  async function toggle(alert: AccountAlert) {
    setBusy(alert.id);
    setError(null);
    const next = !alert.active;
    // Optimistic — the switch has to move under the finger.
    setAlerts((rows) =>
      rows.map((r) => (r.id === alert.id ? { ...r, active: next } : r)),
    );
    try {
      await setAlertActive(alert.id, next);
    } catch (err) {
      setAlerts((rows) =>
        rows.map((r) => (r.id === alert.id ? { ...r, active: alert.active } : r)),
      );
      fail(err, "Couldn't change that alert. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(alert: AccountAlert) {
    if (!window.confirm(`Delete the alert for ${alert.label}?`)) return;
    setBusy(alert.id);
    setError(null);
    try {
      await deleteAlert(alert.id);
      setAlerts((rows) => rows.filter((r) => r.id !== alert.id));
    } catch (err) {
      fail(err, "Couldn't delete that alert. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        {alerts.map((a) => (
          <div
            key={a.id}
            className={cn(
              "grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border px-5 py-4 last:border-b-0",
              a.active ? "" : "opacity-55",
            )}
          >
            <div>
              <div className="text-[13.5px] font-medium leading-[1.4] tracking-[-0.002em] text-text">
                {a.label}
              </div>
              <div className="mt-1 font-mono text-[11px] text-text-subtle">
                {a.conditions}
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={a.active}
              aria-label={`${a.active ? "Pause" : "Resume"} alert for ${a.label}`}
              disabled={busy === a.id}
              onClick={() => toggle(a)}
              className={cn(
                "relative h-[18px] w-8 rounded-full transition-colors disabled:opacity-60",
                a.active ? "bg-score-perfect" : "bg-[#D9D6CD]",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all",
                  a.active ? "left-4" : "left-0.5",
                )}
              />
            </button>

            <button
              type="button"
              onClick={() => remove(a)}
              disabled={busy === a.id}
              aria-label={`Delete alert for ${a.label}`}
              className="rounded-sm border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:bg-surface-2 disabled:opacity-60"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 font-mono text-[11.5px] text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
