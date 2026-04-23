import Link from "next/link";
import { ScoreBadge } from "@/components/match";
import type { CountryData } from "@/lib/types";

/**
 * "Neighbouring countries" grid — named `related` in the data because the
 * list is curated on climate affinity, not strict geographic adjacency
 * (e.g. Morocco is a legitimate match for Peru's coast).
 */
export function RelatedCountries({ country }: { country: CountryData }) {
  if (country.related.length === 0) return null;
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
        <div className="mb-6">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Same climate · neighbouring countries
          </div>
          <h2 className="mt-1 font-display text-[28px] font-medium leading-[1.2] text-text">
            If you like {country.name}, also consider
          </h2>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {country.related.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/${r.slug}`}
                className="flex h-full flex-col gap-2 rounded-md border border-border bg-surface p-4 hover:bg-surface-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-display text-[18px] font-medium text-text">{r.name}</span>
                  <ScoreBadge score={r.score} size="sm" label="number" />
                </div>
                <p className="text-[12.5px] leading-[1.45] text-text-muted">{r.sub}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
