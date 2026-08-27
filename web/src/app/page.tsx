import Link from "next/link";

import { PageFooter, PageHeader } from "@/components/layout";
import { ScoreBadge } from "@/components/match";
import { featuredCountries } from "@/lib/featured";
import { MONTH_NAMES, MONTH_SLUGS } from "@/lib/months";

/**
 * Landing page. Keeps a lightweight hero plus a "featured countries" grid so
 * there's real content at `/` (the map lives at `/map`). The CTA leads into
 * `/map` for the interactive experience; the secondary CTA into `/pricing`.
 *
 * This is deliberately zero-JS — the whole page is a server component and
 * the entry points are plain <Link>s.
 */

/**
 * Daily (86,400s), because the grid is ranked for the current month and the
 * page is otherwise static. The country pages sit at 30 days; this one has to
 * notice a month boundary, and a day's staleness at one is invisible.
 *
 * Written as a literal, not as `60 * 60 * 24`. Next reads the segment config
 * exports by static analysis and rejects an expression it has to evaluate:
 * the arithmetic version failed the whole production build with "Invalid
 * segment configuration export detected", which is a message that names
 * neither the file nor the export. Every other `revalidate` in the app is
 * already a literal.
 */
export const revalidate = 86400;

export default async function HomePage() {
  // Rendered at build or at revalidation, never per request — so this is the
  // month the cached page was built for, not the visitor's.
  const monthIdx = new Date().getUTCMonth();
  const monthName = MONTH_NAMES[MONTH_SLUGS[monthIdx]!];
  const featured = await featuredCountries(monthIdx);

  return (
    <>
      <PageHeader activePath="/" />
      <main className="flex-1">
        <section className="border-b border-border bg-surface">
          <div className="mx-auto grid w-full max-w-[1280px] gap-10 px-6 py-16 md:grid-cols-[1.2fr_1fr] md:px-12 md:py-24">
            <div className="flex flex-col justify-center gap-6">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                Travel-climate map · Atlas Weather
              </div>
              <h1 className="font-display text-[56px] font-medium leading-[1.06] tracking-[-0.01em] text-text md:text-[80px]">
                Plan trips around the weather{" "}
                <span className="italic text-[#8A4A1E]">you actually like.</span>
              </h1>
              <p className="max-w-[640px] text-[17px] leading-[1.6] text-text-muted">
                Ten years of ERA5 climate data and six-government travel advisories in one map.
                Free to explore; Premium for district-level depth and percentile bands.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/map"
                  className="inline-flex items-center rounded-md bg-primary px-5 py-3 text-[14px] font-medium text-primary-foreground hover:bg-primary-hover"
                >
                  Open the map
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center rounded-md border border-border bg-surface px-5 py-3 text-[14px] font-medium text-text hover:bg-surface-2"
                >
                  See pricing · €2.99/mo
                </Link>
              </div>
            </div>
            <div
              className="relative hidden min-h-[360px] overflow-hidden rounded-md border border-border md:block"
              aria-hidden="true"
            >
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(120% 90% at 20% 30%, rgba(224,201,138,0.38), transparent 55%), radial-gradient(120% 90% at 80% 80%, rgba(184,118,62,0.35), transparent 55%), linear-gradient(180deg, #0F1B2D 0%, #1C2A44 100%)",
                }}
              />
              <div className="absolute bottom-6 left-6 right-6 font-mono text-[11px] uppercase tracking-[0.18em] text-[#E0C98A]">
                10 yrs · ERA5 · 5 governments
              </div>
            </div>
          </div>
        </section>

        {featured.length > 0 && (
          <section className="border-b border-border bg-background">
            <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
              <div className="mb-6">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                  Featured countries
                </div>
                <h2 className="mt-1 font-display text-[28px] font-medium leading-[1.2] text-text">
                  Good weather in {monthName}
                </h2>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {featured.map((f) => (
                  <li key={f.slug}>
                    <Link
                      href={`/${f.slug}/${f.month}`}
                      className="flex h-full flex-col gap-2 rounded-md border border-border bg-surface p-5 hover:bg-surface-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-display text-[22px] font-medium text-text">
                          {f.name}
                        </span>
                        <ScoreBadge score={f.score} size="sm" />
                      </div>
                      <div className="font-mono text-[11.5px] text-text-muted">
                        {f.region} · {f.monthName}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </main>
      <PageFooter />
    </>
  );
}
