import Link from "next/link";
import { ScoreGauge } from "@/components/match";
import { MONTH_NAMES, MONTH_SHORT, nextMonth, previousMonth, type MonthSlug } from "@/lib/months";
import type { CountryData } from "@/lib/types";

/**
 * Hero for `/[country]/[month]`. Left rail is editorial (verdict, narrative,
 * CTAs); right rail is the score gauge. Prev/next month links live in the
 * breadcrumb rather than next to the hero so readers can navigate without
 * scrolling back up after reading the narrative.
 */
export function MonthHero({
  country,
  month,
  score,
  verdict,
  narrative,
}: {
  country: CountryData;
  month: MonthSlug;
  score: number;
  verdict: string;
  narrative: string;
}) {
  const monthName = MONTH_NAMES[month];
  const prev = previousMonth(month);
  const next = nextMonth(month);
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-[1280px] px-6 pt-10 md:px-12 md:pt-12">
        <nav className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-text-muted">
          <Link href="/" className="hover:text-text">Home</Link>
          <span aria-hidden="true">·</span>
          <Link href={`/${country.slug}`} className="hover:text-text">{country.name}</Link>
          <span aria-hidden="true">·</span>
          <span className="text-text">{monthName}</span>
          <span className="mx-3 text-text-subtle" aria-hidden="true">|</span>
          <Link href={`/${country.slug}/${prev}`} className="hover:text-text">← {MONTH_SHORT[prev]}</Link>
          <Link href={`/${country.slug}/${next}`} className="hover:text-text">{MONTH_SHORT[next]} →</Link>
        </nav>
        <div className="grid gap-8 pb-10 md:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              {country.name} · Month guide
            </div>
            <h1 className="font-display text-[56px] font-medium leading-[1.06] tracking-[-0.01em] text-text md:text-[72px]">
              {country.name} in <span className="italic text-[#8A4A1E]">{monthName}</span>
            </h1>
            <p className="font-display text-[22px] leading-[1.35] text-text">{verdict}</p>
            <p className="max-w-[640px] text-[15px] leading-[1.6] text-text-muted">{narrative}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Link
                href="/map"
                className="inline-flex items-center rounded-md bg-primary px-4 py-2.5 text-[13.5px] font-medium text-primary-foreground hover:bg-primary-hover"
              >
                Plan a trip in {monthName}
              </Link>
              <Link
                href={`/${country.slug}`}
                className="inline-flex items-center rounded-md border border-border bg-surface px-4 py-2.5 text-[13.5px] font-medium text-text hover:bg-surface-2"
              >
                ← {country.name} year-round
              </Link>
            </div>
          </div>
          <div className="flex items-start justify-center md:justify-end">
            <ScoreGauge
              score={score}
              size="lg"
              sub={`${country.name} · ${monthName}`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
