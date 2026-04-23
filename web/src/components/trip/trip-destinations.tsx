import Link from "next/link";

import { ScoreBadge } from "@/components/match/score-badge";
import type { TripDestination } from "@/lib/types";

/**
 * Top-10 destinations table. Server-rendered; the "Region →" link takes the
 * owner back to the country/region page so they can drill into one row.
 */
export function TripDestinations({
  countrySlug,
  destinations,
}: {
  countrySlug: string;
  destinations: readonly TripDestination[];
}) {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 pb-14 md:px-12">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
          Top {destinations.length} destinations · ranked by match
        </span>
        <span className="font-mono text-[11px] text-text-subtle">
          scoring window: April + May 2026 · default unit metric
        </span>
      </div>
      <h2 className="mb-5 mt-2 font-display text-[28px] font-normal tracking-[-0.012em] md:text-[30px]">
        Where this trip works best.
      </h2>

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <div
          className="hidden items-center gap-4 border-b border-border bg-[#FCFBF8] px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-subtle md:grid"
          style={{ gridTemplateColumns: "40px 1.6fr 1fr 0.7fr 0.7fr 0.7fr 80px 90px" }}
        >
          <div>#</div>
          <div>Destination</div>
          <div>Itinerary tag</div>
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
            style={{ gridTemplateColumns: "40px 1.6fr 1fr 0.7fr 0.7fr 0.7fr 80px 90px" }}
          >
            <div className="font-mono text-[13px] text-text-muted">
              {String(d.rank).padStart(2, "0")}
            </div>
            <div>
              <div className="font-display text-[18px] font-medium tracking-[-0.005em] text-text">
                {d.region}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-text-muted">{d.country}</div>
            </div>
            <div className="font-display text-[12.5px] italic text-text-muted">{d.tag}</div>
            <div className="font-mono text-[12px] text-text">{d.t}</div>
            <div className="font-mono text-[12px] text-text">{d.r}</div>
            <div className="font-mono text-[12px] text-text">{d.s}</div>
            <div className="flex justify-end">
              <ScoreBadge score={d.score} size="sm" />
            </div>
            <div className="text-right">
              <Link
                href={`/${countrySlug}`}
                className="text-[12px] text-accent hover:underline"
              >
                Region →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
