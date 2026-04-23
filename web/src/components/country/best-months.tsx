import Link from "next/link";
import { ScoreBadge } from "@/components/match";
import { MONTH_SLUGS } from "@/lib/months";
import type { CountryData } from "@/lib/types";

/**
 * Three best-month pill cards, rendered above the monthly accordion. The
 * first slot is the "winner" — dark ink background — so the reader's eye
 * lands on the single-most-compelling month first.
 */
export function BestMonths({ country }: { country: CountryData }) {
  const items = country.bestMonths.slice(0, 3);

  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
        <div className="mb-6 flex items-baseline justify-between gap-6">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              Best months to visit
            </div>
            <h2 className="mt-1 font-display text-[28px] font-medium leading-[1.2] text-text">
              When {country.name} shines
            </h2>
          </div>
          <Link
            href={`/${country.slug}/${MONTH_SLUGS[0]}`}
            className="font-mono text-[12px] text-text-link hover:underline"
          >
            See every month →
          </Link>
        </div>

        <ol className="grid gap-4 md:grid-cols-3">
          {items.map((best, idx) => {
            const monthSlug = best.month.toLowerCase();
            const primary = idx === 0;
            return (
              <li key={best.month}>
                <Link
                  href={`/${country.slug}/${monthSlug}`}
                  className={
                    "flex h-full flex-col gap-3 rounded-md border p-5 transition-colors " +
                    (primary
                      ? "border-primary bg-primary text-primary-foreground hover:bg-primary-hover"
                      : "border-border bg-surface text-text hover:bg-surface-2")
                  }
                >
                  <div className="flex items-baseline justify-between">
                    <span className={primary ? "font-mono text-[11px] uppercase tracking-[0.18em] text-[rgba(247,246,242,0.72)]" : "font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted"}>
                      #{idx + 1} · {country.name}
                    </span>
                    <ScoreBadge score={best.score} size="sm" label="number" />
                  </div>
                  <div className="font-display text-[30px] font-medium leading-tight">
                    {best.month}
                  </div>
                  <p className={primary ? "text-[13px] text-[rgba(247,246,242,0.88)]" : "text-[13px] text-text-muted"}>
                    {best.note}
                  </p>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
