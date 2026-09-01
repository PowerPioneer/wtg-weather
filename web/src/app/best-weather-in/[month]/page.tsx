import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageFooter, PageHeader } from "@/components/layout";
import { ScoreBadge } from "@/components/match";
import { RainfallMonthly, Temperature, TemperatureRange } from "@/components/units";
import { routableCountries } from "@/lib/country-routes";
import {
  MONTH_NAMES,
  MONTH_SLUGS,
  isMonthSlug,
  nextMonth,
  previousMonth,
} from "@/lib/months";
import {
  TOP_N,
  monthLandingHref,
  topCountriesForMonth,
} from "@/lib/month-ranking";
import { DEFAULT_PREFERENCES, rainLevelForCeiling } from "@/lib/scoring";
import { monthLandingJsonLd, monthLandingMetadata } from "@/lib/seo";

/**
 * Month-first landing pages: `/best-weather-in/april`.
 *
 * Twelve pages, one per month, each ranking the published countries by how
 * well that month matches the default preference profile. They exist because
 * the site's entire SEO surface is country-first — `/[country]`,
 * `/[country]/[month]` — and the query people actually type when they have
 * leave booked and nowhere chosen is the other way round. Every row links into
 * the country tree, so they are also the strongest internal-linking page on
 * the site.
 *
 * Server components throughout: no client JS, per the zero-JS rule.
 */

export const revalidate = 2592000;

/**
 * On, for the reason it is on everywhere else: `generateStaticParams` can
 * legitimately come back empty when the API is unreachable, and these pages
 * must still exist at request time.
 */
export const dynamicParams = true;

/**
 * The twelve months — but only when there is something to rank them over.
 *
 * `MONTH_SLUGS` is a constant, so this could always return twelve. It must
 * not. A `pnpm build` with no stack up would then prerender twelve pages whose
 * ranking is empty and cache each for thirty days, which is precisely the
 * sitemap's failure (a prerendered file baked inside `docker build`, where the
 * API is not reachable) applied to a page instead of an XML document. Emitting
 * nothing leaves them to render on demand against a live API, which is what
 * `dynamicParams` is for, and keeps the build green with no API at all.
 */
export async function generateStaticParams() {
  const published = await routableCountries();
  if (published.length === 0) return [];
  return MONTH_SLUGS.map((month) => ({ month }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ month: string }>;
}): Promise<Metadata> {
  const { month } = await params;
  if (!isMonthSlug(month)) return { title: "Month not found" };
  return monthLandingMetadata(month, MONTH_NAMES[month], TOP_N);
}

export default async function BestWeatherInMonthPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;
  // The month set is closed and lowercase-English. Anything else is a 404, not
  // a redirect — there is no near-miss worth guessing at.
  if (!isMonthSlug(month)) notFound();

  const monthName = MONTH_NAMES[month];
  const ranked = await topCountriesForMonth(month);
  const prev = previousMonth(month);
  const next = nextMonth(month);

  return (
    <>
      <PageHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: monthLandingJsonLd(month, monthName, ranked),
        }}
      />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1280px] px-6 pt-6 md:px-12">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12px] text-text-muted"
          >
            <Link href="/" className="hover:text-text">
              Home
            </Link>
            <span aria-hidden="true">·</span>
            <span>Best weather by month</span>
            <span aria-hidden="true">·</span>
            <span className="text-text">{monthName}</span>
          </nav>
        </div>

        <section className="border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12 md:py-16">
            <div className="max-w-[760px]">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                Where to go
              </div>
              <h1 className="mt-2 font-display text-[48px] font-medium leading-[1.06] tracking-[-0.01em] text-text md:text-[64px]">
                Best weather in {monthName}
              </h1>
              <p className="mt-5 text-[17px] leading-[1.6] text-text-muted">
                The {ranked.length} countries whose {monthName} comes closest to
                comfortable travel weather, scored from ten years of ERA5 data.
                Open any of them for the month in detail — regional breakdown,
                the rest of the year, and current travel-advisory levels.
              </p>
              <p className="mt-4 max-w-[680px] text-[13px] leading-[1.6] text-text-subtle">
                Scored against the default profile: days{" "}
                <TemperatureRange
                  low={DEFAULT_PREFERENCES.dayMin}
                  high={DEFAULT_PREFERENCES.dayMax}
                  separator="–"
                />
                , nights{" "}
                <TemperatureRange
                  low={DEFAULT_PREFERENCES.nightMin}
                  high={DEFAULT_PREFERENCES.nightMax}
                  separator="–"
                />
                , no more than{" "}
                {rainLevelForCeiling(DEFAULT_PREFERENCES.rainMax).label.toLowerCase()},
                at least {DEFAULT_PREFERENCES.sunMin} hours of sun. Set your own on the{" "}
                <Link href="/map" className="text-text-link underline underline-offset-2">
                  map
                </Link>{" "}
                — averages, not a forecast.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-background">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-10 md:px-12">
            <ol className="overflow-hidden rounded-md border border-border">
              {ranked.map((country) => (
                <li
                  key={country.slug}
                  className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-surface px-5 py-4 last:border-b-0"
                >
                  <span
                    aria-hidden="true"
                    className="w-7 shrink-0 font-mono text-[13px] text-text-subtle"
                  >
                    {country.rank}
                  </span>
                  <span className="min-w-[180px] flex-1">
                    <Link
                      href={`/${country.slug}/${month}`}
                      className="font-display text-[19px] font-medium text-text hover:text-text-link"
                    >
                      {country.name} in {monthName}
                    </Link>
                    <span className="mt-0.5 block font-mono text-[11.5px] text-text-subtle">
                      {country.region}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-5 font-mono text-[12px] text-text-muted">
                    <span>
                      <Temperature value={country.temp} />
                    </span>
                    <span className="hidden sm:inline">
                      <RainfallMonthly value={country.rain} />
                    </span>
                    <span className="hidden md:inline">
                      {country.sun.toFixed(1)} h sun
                    </span>
                  </span>
                  <ScoreBadge score={country.score} />
                  <Link
                    href={`/${country.slug}`}
                    className="shrink-0 font-mono text-[11.5px] text-text-muted underline underline-offset-2 hover:text-text"
                  >
                    All year
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-10 md:px-12">
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              Travelling another month?
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {MONTH_SLUGS.map((slug) => (
                <Link
                  key={slug}
                  href={monthLandingHref(slug)}
                  aria-current={slug === month ? "page" : undefined}
                  className={
                    "rounded-full border px-4 py-1.5 text-[13px] " +
                    (slug === month
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-text hover:bg-surface-2")
                  }
                >
                  {MONTH_NAMES[slug]}
                </Link>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-[13.5px]">
              <Link
                href={monthLandingHref(prev)}
                className="text-text-link underline underline-offset-2"
              >
                ← Best weather in {MONTH_NAMES[prev]}
              </Link>
              <Link
                href={monthLandingHref(next)}
                className="text-text-link underline underline-offset-2"
              >
                Best weather in {MONTH_NAMES[next]} →
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-background">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-10 md:px-12">
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              How this ranking works
            </h2>
            <div className="mt-3 max-w-[760px] space-y-3 text-[14px] leading-[1.65] text-text-muted">
              <p>
                Every country&rsquo;s {monthName} is scored on three things:
                mean temperature, rainfall per day and sunshine hours, each
                averaged over ten years of ERA5 reanalysis. The score is the
                same one the map paints and the country pages print — a country
                cannot look better here than it does on its own page.
              </p>
              <p>
                Countries that score identically are ordered by how far inside
                the comfortable range they sit, so a country in the middle of
                the band comes before one at its edge. Averages describe a
                typical {monthName}; they are not a forecast for the week you
                travel, and a national figure hides a lot in a large country —
                open a country to see its regions.
              </p>
            </div>
          </div>
        </section>
      </main>
      <PageFooter />
    </>
  );
}
