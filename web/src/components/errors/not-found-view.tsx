import Link from "next/link";

import { PageFooter, PageHeader } from "@/components/layout";
import { MONTH_NAMES, type MonthSlug } from "@/lib/months";

/**
 * One month per quarter. Enough to make the point that the month pages exist
 * without turning a 404 into a twelve-item navigation problem.
 *
 * The labels come from `MONTH_NAMES` rather than from a CSS `capitalize` on a
 * lowercase slug: the slug is the URL, the name is the copy, and a screen
 * reader announces the text rather than the styling.
 */
const QUARTERS: readonly MonthSlug[] = ["january", "april", "july", "october"];

/**
 * The shared 404 body.
 *
 * A 404 is a real entry point here rather than an accident: `dynamicParams` is
 * on for every dynamic route, so any URL shaped like a country or a region
 * reaches a page that then decides the slug is unknown. Search engines,
 * old links and typos all land here, and the useful thing to do with that
 * visitor is show them the way in rather than apologise.
 *
 * Server component. No client JS on the 404 path.
 */

export type Suggestion = { slug: string; name: string };

export function NotFoundView({
  heading,
  message,
  suggestions = [],
  suggestionsLabel = "Popular destinations",
}: {
  heading: string;
  message: string;
  /** Published countries to offer. Empty is fine — the fixed links below stand alone. */
  suggestions?: readonly Suggestion[];
  suggestionsLabel?: string;
}) {
  return (
    <>
      <PageHeader />
      <main className="flex-1">
        <section className="border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-20 md:px-12 md:py-28">
            <div className="max-w-[680px]">
              <div className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-text-muted">
                404 — not found
              </div>
              <h1 className="mt-3 font-display text-[44px] font-medium leading-[1.08] tracking-[-0.01em] text-text md:text-[56px]">
                {heading}
              </h1>
              <p className="mt-5 text-[17px] leading-[1.6] text-text-muted">{message}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/map"
                  className="rounded-md bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground hover:bg-primary-hover"
                >
                  Open the map
                </Link>
                <Link
                  href="/"
                  className="rounded-md border border-border bg-surface px-5 py-2.5 text-[14px] font-medium text-text hover:bg-surface-2"
                >
                  Browse countries
                </Link>
              </div>
            </div>
          </div>
        </section>

        {suggestions.length > 0 && (
          <section className="border-b border-border bg-background">
            <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
              <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                {suggestionsLabel}
              </h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {suggestions.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/${s.slug}`}
                      className="block rounded-md border border-border bg-surface px-4 py-3 text-[14px] text-text hover:bg-surface-2"
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="bg-surface">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              Or start from a month
            </h2>
            <p className="mt-2 max-w-[680px] text-[14px] leading-[1.6] text-text-muted">
              If you know when you can travel but not where, the month pages
              rank every published country by how well it matches the default
              preferences.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {QUARTERS.map((month) => (
                <Link
                  key={month}
                  href={`/best-weather-in/${month}`}
                  className="rounded-full border border-border bg-surface px-4 py-1.5 text-[13px] text-text hover:bg-surface-2"
                >
                  {MONTH_NAMES[month]}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <PageFooter />
    </>
  );
}
