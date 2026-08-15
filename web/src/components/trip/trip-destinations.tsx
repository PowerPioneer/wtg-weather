import Link from "next/link";

import { ScoreBadge } from "@/components/match/score-badge";
import type { TripDestinationRow } from "@/lib/trip-server";

/**
 * The country's admin-1 regions, ranked for the trip's month under the trip's
 * own preferences.
 *
 * The "itinerary tag" column is gone: it held editorial captions ("Sacred
 * Valley · Machu Picchu") that only ever existed in the fixture, and there is
 * no field on any payload to fill it from. Each row now links to the region's
 * own page instead of sending all ten to the country page.
 */
export function TripDestinations({
  destinations,
  monthName,
}: {
  destinations: readonly TripDestinationRow[];
  monthName: string | null;
}) {
  if (destinations.length === 0) return null;

  const columns = "40px 1.8fr 0.9fr 0.9fr 0.9fr 80px 90px";

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 pb-14 md:px-12">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
          Top {destinations.length} regions · ranked by match
        </span>
        {monthName && (
          <span className="font-mono text-[11px] text-text-subtle">
            scored for {monthName} · 10-year ERA5 means · metric units
          </span>
        )}
      </div>
      <h2 className="mb-5 mt-2 font-display text-[28px] font-normal tracking-[-0.012em] md:text-[30px]">
        Where this trip works best.
      </h2>

      <div className="overflow-x-auto">
        <div className="min-w-[720px] overflow-hidden rounded-md border border-border bg-surface">
          <div
            className="grid items-center gap-4 border-b border-border bg-[#FCFBF8] px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-subtle"
            style={{ gridTemplateColumns: columns }}
          >
            <div>#</div>
            <div>Region</div>
            <div>Temp</div>
            <div>Rain</div>
            <div>Sun</div>
            <div className="text-right">Score</div>
            <div className="text-right">Open</div>
          </div>
          {destinations.map((d, i) => (
            <div
              key={d.rank}
              className={
                "grid items-center gap-4 border-b border-border px-4 py-3.5 last:border-b-0 md:px-5 " +
                (i === 0 ? "bg-[#FCFBF8]" : "bg-surface")
              }
              style={{ gridTemplateColumns: columns }}
            >
              <div className="font-mono text-[13px] text-text-muted">
                {String(d.rank).padStart(2, "0")}
              </div>
              <div className="font-display text-[18px] font-medium tracking-[-0.005em] text-text">
                {d.name}
              </div>
              <div className="font-mono text-[12px] text-text">{d.temp}</div>
              <div className="font-mono text-[12px] text-text">{d.rain}</div>
              <div className="font-mono text-[12px] text-text">{d.sun}</div>
              <div className="flex justify-end">
                <ScoreBadge score={d.score} size="sm" />
              </div>
              <div className="text-right">
                {d.href ? (
                  <Link href={d.href} className="text-[12px] text-accent hover:underline">
                    Region →
                  </Link>
                ) : (
                  <span className="font-mono text-[11px] text-text-subtle">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
