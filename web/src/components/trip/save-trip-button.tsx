"use client";

/**
 * "Save as trip" — the only way a trip has ever been created.
 *
 * A trip is a saved question: this country (or region), this month, these
 * preferences. It is not a snapshot of today's answer — the trip page re-scores
 * it against whatever the pipeline published last — so all that is stored is
 * the question.
 *
 * Anonymous visitors get a sign-in link, for the same reason the favourite
 * button does: a control that appears to save and does not is worse than one
 * that says it needs an account.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useSession } from "@/hooks/use-session";
import { createTrip, isUnauthorized } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { MonthSlug } from "@/lib/months";
import type { WeatherPreferences } from "@/lib/scoring";

export type SaveTripButtonProps = {
  /** Where. ISO-3166-1 alpha-2. */
  countryIso2: string;
  /** `adm1_code`, when the trip is about one region rather than a country. */
  regionCode?: string | null;
  /** What to call it — the country or region name plus the month. */
  placeName: string;
  monthSlug: MonthSlug;
  monthName: string;
  /** 1–12. */
  month: number;
  /** The preferences on screen right now. */
  preferences: WeatherPreferences;
  className?: string;
};

export function SaveTripButton({
  countryIso2,
  regionCode,
  placeName,
  monthName,
  month,
  preferences,
  className,
}: SaveTripButtonProps) {
  const router = useRouter();
  const { session, loading } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shell = cn(
    "inline-flex h-9 items-center gap-2 rounded-sm bg-primary px-3.5 text-[12.5px] font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60",
    className,
  );

  if (loading) {
    return (
      <button type="button" disabled className={shell}>
        Save as trip
      </button>
    );
  }

  if (!session) {
    return (
      <Link href="/login" className={shell} data-testid="save-trip-signin">
        Sign in to save this trip
      </Link>
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const trip = await createTrip({
        // The default title names the question. The owner can rename it on the
        // trip page; storing a generated one beats an "Untitled trip" list.
        title: `${placeName} in ${monthName}`,
        countryIso2,
        regionCode: regionCode ?? null,
        month,
        preferences: { ...preferences },
      });
      router.push(`/trip/${trip.id}`);
    } catch (err) {
      setError(
        isUnauthorized(err)
          ? "Your session expired. Sign in again."
          : "Couldn't save that trip. Try again.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={save}
        disabled={busy}
        data-testid="save-trip"
        className={shell}
      >
        {busy ? "Saving…" : "Save as trip"}
      </button>
      {error && (
        <span role="alert" className="font-mono text-[11px] text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
