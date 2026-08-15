"use client";

/**
 * "Email me when this starts matching" — the only way an alert gets created.
 *
 * The alert stores the same question a trip does (where, which month, which
 * preferences); `jobs/alerts_weekly.py` re-answers it each Monday and emails
 * on a transition. Nothing about today's score is saved.
 *
 * Three states before the button is a button:
 *   - anonymous → sign in, not a control that silently fails;
 *   - free → the upgrade prompt from `upgrade/copy.ts`, because the pricing
 *     table sells alerts as Premium;
 *   - already alerting on this exact place and month → say so, rather than
 *     quietly creating a duplicate that emails twice.
 *
 * The gate here is presentation. `POST /api/alerts` enforces the same tier
 * boundary server-side, which is where it counts.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { UPGRADE_PROMPTS } from "@/components/upgrade/copy";
import { usePremiumEntitlement, useSession } from "@/hooks/use-session";
import { createAlert, isUnauthorized, listAlerts } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { WeatherPreferences } from "@/lib/scoring";

export type CreateAlertButtonProps = {
  countryIso2: string;
  regionCode?: string | null;
  placeName: string;
  /** 1–12. */
  month: number;
  monthName: string;
  preferences: WeatherPreferences;
  className?: string;
};

type Status = "loading" | "ready" | "exists" | "created";

export function CreateAlertButton({
  countryIso2,
  regionCode = null,
  placeName,
  month,
  monthName,
  preferences,
  className,
}: CreateAlertButtonProps) {
  const { session, loading: sessionLoading } = useSession();
  const { premium } = usePremiumEntitlement();
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only premium users have a list worth reading; a free user's is empty by
  // construction and the request would only be refused.
  useEffect(() => {
    if (!premium) return;
    let cancelled = false;
    listAlerts()
      .then((alerts) => {
        if (cancelled) return;
        const duplicate = alerts.some(
          (a) =>
            (a.countryIso2 ?? "").toUpperCase() === countryIso2.toUpperCase() &&
            (a.regionCode ?? null) === regionCode &&
            a.month === month,
        );
        setStatus(duplicate ? "exists" : "ready");
      })
      .catch(() => {
        // An unreadable list is not a reason to hide the button; a duplicate
        // is a nuisance, an unavailable feature is worse.
        if (!cancelled) setStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [countryIso2, month, premium, regionCode]);

  const shell = cn(
    "inline-flex h-9 items-center gap-2 rounded-sm border border-border bg-surface px-3.5 text-[12.5px] font-medium text-text transition-colors hover:bg-surface-2 disabled:opacity-60",
    className,
  );

  if (sessionLoading) {
    return (
      <button type="button" disabled className={shell}>
        Email me when it matches
      </button>
    );
  }

  if (!session) {
    return (
      <Link href="/login" className={shell} data-testid="alert-signin">
        Sign in to set an alert
      </Link>
    );
  }

  if (!premium) {
    const copy = UPGRADE_PROMPTS.alerts;
    return (
      <div
        data-testid="alert-upgrade"
        className={cn(
          "max-w-[420px] rounded-md border border-dashed border-accent bg-[#FBF3DC] px-4 py-3",
          className,
        )}
      >
        <div className="text-[13px] font-medium text-text">{copy.title}</div>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-text-muted">{copy.body}</p>
        <Link
          href="/pricing"
          className="mt-2.5 inline-flex h-8 items-center rounded-sm bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
        >
          {copy.cta}
        </Link>
      </div>
    );
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await createAlert({
        countryIso2,
        regionCode,
        month,
        preferences: { ...preferences },
      });
      setStatus("created");
    } catch (err) {
      setError(
        isUnauthorized(err)
          ? "Your session expired. Sign in again."
          : "Couldn't create that alert. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (status === "created" || status === "exists") {
    return (
      <div className="inline-flex flex-col items-start gap-1">
        <span
          data-testid="alert-active"
          className="inline-flex h-9 items-center gap-2 rounded-sm border border-border bg-surface-2 px-3.5 font-mono text-[11.5px] text-text-muted"
        >
          ● Alerting on {placeName} in {monthName}
        </span>
        <Link
          href="/account?s=alerts"
          className="font-mono text-[11px] text-accent-text hover:underline"
        >
          Manage alerts →
        </Link>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={create}
        disabled={busy || status === "loading"}
        data-testid="alert-create"
        className={shell}
      >
        {busy ? "Setting up…" : `Email me when ${monthName} matches`}
      </button>
      {error && (
        <span role="alert" className="font-mono text-[11px] text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
