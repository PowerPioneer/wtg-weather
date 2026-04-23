import Link from "next/link";
import { ScoreBadge } from "@/components/match";
import { MONTH_NAMES, MONTH_SLUGS, type MonthSlug } from "@/lib/months";
import type { CountryData } from "@/lib/types";
import { estimateMonthScore } from "@/lib/country-derive";

/**
 * Twelve-month accordion — one <details> per month. Uses native <details> so
 * it works with zero client JS (accessibility requirement for SSR pages).
 * Each row carries a jump-link into `/[country]/[month]` so the same data
 * is both expandable inline and linkable out.
 */
export function MonthAccordion({ country }: { country: CountryData }) {
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
        <div className="mb-6">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Month by month
          </div>
          <h2 className="mt-1 font-display text-[28px] font-medium leading-[1.2] text-text">
            A year in {country.name}, in order
          </h2>
        </div>
        <ol className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {MONTH_SLUGS.map((slug, idx) => (
            <MonthRow key={slug} slug={slug} idx={idx} country={country} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function MonthRow({
  slug,
  idx,
  country,
}: {
  slug: MonthSlug;
  idx: number;
  country: CountryData;
}) {
  const name = MONTH_NAMES[slug];
  const short3 = name.slice(0, 3);
  const note = country.monthNotes[short3] ?? "";
  const t = country.climate.t[idx];
  const r = country.climate.r[idx];
  const s = country.climate.s[idx];
  const score = estimateMonthScore(country, idx);

  return (
    <li>
      <details className="group bg-surface">
        <summary className="flex cursor-pointer select-none items-center gap-4 px-5 py-4 hover:bg-surface-2">
          <div className="min-w-[72px] font-mono text-[12px] uppercase tracking-[0.16em] text-text-muted">
            {short3}
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-[20px] font-medium text-text">{name}</span>
              <span className="font-mono text-[11.5px] text-text-muted">
                {t.toFixed(1)}°C · {Math.round(r)} mm · {s.toFixed(1)} hr/day
              </span>
            </div>
            <p className="mt-0.5 line-clamp-1 text-[13px] text-text-muted">{note}</p>
          </div>
          <ScoreBadge score={score} size="sm" />
          <span
            aria-hidden="true"
            className="ml-2 text-text-subtle transition-transform group-open:rotate-45"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
        </summary>
        <div className="border-t border-border bg-background px-5 py-4">
          <p className="max-w-[680px] text-[14px] leading-[1.55] text-text">{note}</p>
          <div className="mt-3">
            <Link
              href={`/${country.slug}/${slug}`}
              className="font-mono text-[12px] text-text-link hover:underline"
            >
              Open the {name} page →
            </Link>
          </div>
        </div>
      </details>
    </li>
  );
}
