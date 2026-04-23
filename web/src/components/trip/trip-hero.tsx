import Link from "next/link";

import { ScoreBadge } from "@/components/match/score-badge";
import type { TripData } from "@/lib/types";

/**
 * Hero strip. Owner sees a black tracking ribbon ("Your trip · saved / updated");
 * the public read-only viewer sees an amber "shared" banner with a "Save a copy"
 * link. Banner + title + meta are server-rendered so the page is indexable.
 */
export function TripHero({ trip, mode }: { trip: TripData; mode: "owner" | "public" }) {
  const isOwner = mode === "owner";
  const agencyOwner = trip.owner.kind === "agency" ? trip.owner : null;

  return (
    <>
      {!isOwner && (
        <div className="border-b border-accent bg-[#FBF3DC]">
          <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-6 py-2.5 font-mono text-[12px] text-text md:px-12">
            <div>
              <span className="font-semibold uppercase tracking-[0.1em] text-accent">Shared trip</span>
              <span className="mx-2.5 text-border">·</span>
              Read-only view
              {agencyOwner && (
                <>
                  {" from "}
                  <strong className="font-sans text-text">{agencyOwner.agency}</strong>
                </>
              )}
              <span className="mx-2.5 text-border">·</span>
              {trip.shareUrl}
            </div>
            <Link href="/signup" className="font-semibold text-accent hover:underline">
              Save a copy →
            </Link>
          </div>
        </div>
      )}

      {isOwner && (
        <div className="bg-primary text-primary-foreground">
          <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-6 py-2 font-mono text-[11.5px] md:px-12">
            <div>
              <span className="font-semibold uppercase tracking-[0.14em] text-[#E0C98A]">Your trip</span>
              <span className="mx-2.5 text-white/40">·</span>
              Saved {trip.createdAt} · Updated {trip.updatedAt} · {trip.id}
            </div>
            <div className="hidden gap-5 md:flex">
              <span>● Auto-sync on</span>
              <span className="text-white/60">Last alert · Apr 18 (rainfall ↑ Cusco)</span>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-[1280px] px-6 pb-6 pt-12 md:px-12 md:pt-14">
        <div className="mb-4 flex items-center gap-3.5">
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            {isOwner ? "Saved trip" : "Shared trip · read-only"}
          </span>
          <div className="h-px flex-1 bg-border" aria-hidden="true" />
          <span className="font-mono text-[11px] uppercase text-text-muted">
            {trip.country} · {trip.months.join(" – ")} · {trip.year}
          </span>
        </div>

        {agencyOwner && (
          <div className="mb-2 flex items-center gap-2.5 text-[13px] text-text-muted">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">For</span>
            <span className="font-display text-[18px] italic text-text">{agencyOwner.client}</span>
            <span className="text-border">·</span>
            <span>prepared by {agencyOwner.agency}</span>
          </div>
        )}

        <h1 className="mt-1 font-display text-[48px] font-normal leading-[1.05] tracking-[-0.022em] text-text md:text-[64px]">
          {trip.title}
        </h1>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-text-muted">
          <span>
            <strong className="font-medium text-text">{trip.country}</strong> · all regions
          </span>
          <span className="text-border">·</span>
          <span>
            <strong className="font-medium text-text">{trip.months.join(" & ")}</strong> {trip.year} · ~6 weeks window
          </span>
          <span className="text-border">·</span>
          <span>
            <strong className="font-medium text-text">{trip.destinations.length}</strong> matching destinations
          </span>
          <span className="text-border">·</span>
          <span className="inline-flex items-center gap-2">
            Overall fit
            <ScoreBadge score={trip.score} size="md" />
          </span>
        </div>
      </div>
    </>
  );
}
