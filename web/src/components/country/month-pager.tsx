import Link from "next/link";
import { ScoreBadge } from "@/components/match";
import {
  MONTH_NAMES,
  MONTH_SLUGS,
  monthIndex,
  nextMonth,
  previousMonth,
  type MonthSlug,
} from "@/lib/months";
import { estimateMonthScore } from "@/lib/country-derive";
import type { CountryData } from "@/lib/types";

/**
 * Prev/next month cards at the bottom of a month page. Using concrete month
 * data (not just labels) because the reader's next question is usually
 * "what about March or May?" — showing the score up front answers that
 * without another click.
 */
export function MonthPager({
  country,
  month,
}: {
  country: CountryData;
  month: MonthSlug;
}) {
  const prev = previousMonth(month);
  const next = nextMonth(month);
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
        <div className="grid gap-4 md:grid-cols-2">
          <PagerCard country={country} slug={prev} direction="prev" />
          <PagerCard country={country} slug={next} direction="next" />
        </div>
      </div>
    </section>
  );
}

function PagerCard({
  country,
  slug,
  direction,
}: {
  country: CountryData;
  slug: MonthSlug;
  direction: "prev" | "next";
}) {
  const idx = monthIndex(slug);
  const name = MONTH_NAMES[slug];
  const short3 = MONTH_SLUGS[idx].slice(0, 3);
  const normalised = short3.charAt(0).toUpperCase() + short3.slice(1);
  const note = country.monthNotes[normalised] ?? "";
  const score = estimateMonthScore(country, idx);
  return (
    <Link
      href={`/${country.slug}/${slug}`}
      className="flex items-center gap-5 rounded-md border border-border bg-surface p-5 hover:bg-surface-2"
    >
      <div className="flex-1">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          {direction === "prev" ? "← Earlier" : "Later →"}
        </div>
        <div className="mt-1 font-display text-[24px] font-medium text-text">{name}</div>
        <p className="mt-1 line-clamp-1 text-[13px] text-text-muted">{note}</p>
      </div>
      <ScoreBadge score={score} size="md" />
    </Link>
  );
}
