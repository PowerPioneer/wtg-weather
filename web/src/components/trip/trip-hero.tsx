import Link from "next/link";

import { ScoreBadge } from "@/components/match/score-badge";
import type { TripView } from "@/lib/trip-server";

/**
 * Hero strip. The owner gets a dark ribbon naming the trip as theirs; a
 * read-only viewer gets an amber "shared" banner. Both are server-rendered.
 *
 * What is *not* here any more: "Saved {date} · Updated {date}", "Auto-sync on"
 * and "Last alert · Apr 18 (rainfall ↑ Cusco)" were fixture strings — the trip
 * payload carries no timestamps and there is no sync to report on. So was
 * "~6 weeks window", on a trip that names one month.
 */
export function TripHero({ trip, mode }: { trip: TripView; mode: "owner" | "public" }) {
  const isOwner = mode === "owner";
  const where = [trip.regionName, trip.countryName].filter(Boolean).join(", ");

  return (
    <>
      {!isOwner && (
        <div className="border-b border-accent bg-[#FBF3DC]">
          <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-6 py-2.5 font-mono text-[12px] text-text md:px-12">
            <div>
              <span className="font-semibold uppercase tracking-[0.1em] text-accent-text">
                Shared trip
              </span>
              <span className="mx-2.5 text-border">·</span>
              Read-only view
            </div>
            <Link href="/login" className="font-semibold text-accent-text hover:underline">
              Plan your own →
            </Link>
          </div>
        </div>
      )}

      {isOwner && (
        <div className="bg-primary text-primary-foreground">
          <div className="mx-auto flex w-full max-w-[1280px] items-center gap-3 px-6 py-2 font-mono text-[11.5px] md:px-12">
            <span className="font-semibold uppercase tracking-[0.14em] text-[#E0C98A]">
              Your trip
            </span>
            <span className="text-white/40">·</span>
            <span className="text-white/80">
              Re-scored against the latest published climate data
            </span>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-[1280px] px-6 pb-6 pt-12 md:px-12 md:pt-14">
        <div className="mb-4 flex items-center gap-3.5">
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            {isOwner ? "Saved trip" : "Shared trip · read-only"}
          </span>
          <div className="h-px flex-1 bg-border" aria-hidden="true" />
          {(where || trip.monthName) && (
            <span className="font-mono text-[11px] uppercase text-text-muted">
              {[where, trip.monthName].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>

        <h1 className="mt-1 font-display text-[48px] font-normal leading-[1.05] tracking-[-0.022em] text-text md:text-[64px]">
          {trip.title}
        </h1>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-text-muted">
          {where && (
            <span>
              <strong className="font-medium text-text">{where}</strong>
            </span>
          )}
          <span>
            <strong className="font-medium text-text">
              {trip.monthName ?? "No month set"}
            </strong>
          </span>
          {trip.destinations.length > 0 && (
            <>
              <span className="text-border">·</span>
              <span>
                <strong className="font-medium text-text">
                  {trip.destinations.length}
                </strong>{" "}
                ranked destinations
              </span>
            </>
          )}
          {trip.score !== null && (
            <>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-2">
                Match
                <ScoreBadge score={trip.score} size="md" />
              </span>
            </>
          )}
        </div>
      </div>
    </>
  );
}
