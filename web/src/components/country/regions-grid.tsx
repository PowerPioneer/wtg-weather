import Link from "next/link";

import { ScoreBadge } from "@/components/match";
import { Sparkline } from "@/components/charts";
import { MONTH_SLUGS } from "@/lib/months";
import { regionSlug } from "@/lib/regions";
import type { CountryData, RegionRow } from "@/lib/types";

/**
 * Per-region grid. Each card renders the region's 12-month temperature spark
 * with the current month highlighted, plus a ScoreBadge. Cards link into
 * `/[country]/[region]` (country context) or `/[country]/[region]/[month]`
 * (when viewed inside a month page).
 */
export function RegionsGrid({
  country,
  currentMonthIdx,
  limit,
}: {
  country: CountryData;
  /** 0–11 — marks the dot on the sparkline. */
  currentMonthIdx?: number;
  limit?: number;
}) {
  if (country.regions.length === 0) {
    return (
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[1280px] px-6 py-12 md:px-12">
          <div className="rounded-md border border-dashed border-border bg-background p-6 text-[13px] text-text-muted">
            Regional climatology for {country.name} is not yet available.
          </div>
        </div>
      </section>
    );
  }
  const regions = limit ? country.regions.slice(0, limit) : country.regions;
  const label = currentMonthIdx != null ? `${regions.length} regions · current month` : `${regions.length} regions`;

  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              {label}
            </div>
            <h2 className="mt-1 font-display text-[28px] font-medium leading-[1.2] text-text">
              {country.name}, taken apart
            </h2>
          </div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {regions.map((r) => (
            <RegionCard
              key={r.name}
              countrySlug={country.slug}
              region={r}
              currentMonthIdx={currentMonthIdx}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

function RegionCard({
  countrySlug,
  region,
  currentMonthIdx,
}: {
  countrySlug: string;
  region: RegionRow;
  currentMonthIdx?: number;
}) {
  const low = Math.min(...region.tl);
  const high = Math.max(...region.tl);
  const current = currentMonthIdx != null ? region.tl[currentMonthIdx] : undefined;
  const slug = regionSlug(region.name);
  const href =
    currentMonthIdx != null
      ? `/${countrySlug}/${slug}/${MONTH_SLUGS[currentMonthIdx]}`
      : `/${countrySlug}/${slug}`;
  return (
    <li>
      <Link
        href={href}
        className="flex h-full flex-col gap-2 rounded-md border border-border bg-surface p-4 hover:bg-surface-2"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13px] font-medium text-text">{region.name}</span>
          <ScoreBadge score={region.score} size="sm" label="number" />
        </div>
        <Sparkline
          values={region.tl}
          highlight={currentMonthIdx}
          tone="ink"
          title={`${region.name} — 12-month temperature trend`}
          className="h-7 w-full"
        />
        <div className="font-mono text-[11px] text-text-muted">
          {current != null ? <span>{current.toFixed(0)}°C now · </span> : null}
          {low.toFixed(0)}–{high.toFixed(0)}°C yr
        </div>
      </Link>
    </li>
  );
}
