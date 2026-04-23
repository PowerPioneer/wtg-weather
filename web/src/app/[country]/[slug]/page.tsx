import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClimateChart } from "@/components/charts";
import {
  ClimateGrid,
  MonthHero,
  MonthPager,
  MonthStats,
  PlanCta,
  RegionsGrid,
  RelatedCountries,
  SafetySection,
} from "@/components/country";
import { PageFooter, PageHeader } from "@/components/layout";
import { ScoreBadge } from "@/components/match";
import { getCountry } from "@/lib/api-client";
import { COUNTRIES } from "@/lib/countries";
import { estimateMonthScore, monthRank } from "@/lib/country-derive";
import {
  MONTH_NAMES,
  MONTH_SHORT,
  MONTH_SLUGS,
  isMonthSlug,
  monthIndex,
  type MonthSlug,
} from "@/lib/months";
import {
  estimateRegionMonthScore,
  findRegion,
  regionBestMonthIndices,
  regionSlug,
  regionTempRange,
} from "@/lib/regions";
import {
  monthJsonLd,
  monthMetadata,
  regionJsonLd,
  regionMetadata,
} from "@/lib/seo";
import type { CountryData, RegionRow } from "@/lib/types";

/**
 * Second-level country route. Next.js App Router cannot have two dynamic
 * siblings (`[month]` + `[region]`) under `[country]`, so we collapse them
 * into one `[slug]` segment and dispatch internally. Months take priority
 * over regions on slug collision — the month set is closed and canonical.
 */

export const revalidate = 2592000;
export const dynamicParams = false;

export async function generateStaticParams() {
  const seen = new Set<string>();
  const out: { country: string; slug: string }[] = [];
  const push = (country: string, slug: string) => {
    const key = `${country}/${slug}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ country, slug });
  };
  for (const c of COUNTRIES) {
    for (const m of MONTH_SLUGS) push(c.slug, m);
    const data = await getCountry(c.slug);
    if (!data) continue;
    for (const r of data.regions) push(c.slug, regionSlug(r.name));
  }
  return out;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string; slug: string }>;
}): Promise<Metadata> {
  const { country, slug } = await params;
  const data = await getCountry(country);
  if (!data) return { title: "Country not found" };

  if (isMonthSlug(slug)) {
    const idx = monthIndex(slug);
    return monthMetadata({
      country: data,
      month: slug,
      monthName: MONTH_NAMES[slug],
      monthIdx: idx,
      verdict: "",
      narrative: "",
      score: estimateMonthScore(data, idx),
      rank: monthRank(data, idx),
    });
  }
  const region = findRegion(data, slug);
  if (region) return regionMetadata(data, region);
  return { title: "Not found" };
}

export default async function CountrySlugPage({
  params,
}: {
  params: Promise<{ country: string; slug: string }>;
}) {
  const { country, slug } = await params;
  const data = await getCountry(country);
  if (!data) notFound();

  if (isMonthSlug(slug)) return <MonthView country={data} month={slug} />;
  const region = findRegion(data, slug);
  if (region) return <RegionView country={data} region={region} />;
  notFound();
}

// ─── Month view ──────────────────────────────────────────────────────

function MonthView({ country, month }: { country: CountryData; month: MonthSlug }) {
  const idx = monthIndex(month);
  const monthName = MONTH_NAMES[month];
  const short = MONTH_SHORT[month];
  const score = estimateMonthScore(country, idx);
  const rank = monthRank(country, idx);
  const note = country.monthNotes[short] ?? "";
  const verdict = note;
  const narrative = buildMonthNarrative({
    countryName: country.name,
    monthName,
    rank,
    note,
  });

  const detail = {
    country,
    month,
    monthName,
    monthIdx: idx,
    verdict,
    narrative,
    score,
    rank,
  };

  return (
    <>
      <PageHeader />
      <main className="flex-1">
        <MonthHero
          country={country}
          month={month}
          score={score}
          verdict={verdict}
          narrative={narrative}
        />
        <MonthStats country={country} monthIdx={idx} />
        <RegionsGrid country={country} currentMonthIdx={idx} />
        <SafetySection advisories={country.advisories} countryName={country.name} />
        <ClimateGrid country={country} />
        <MonthPager country={country} month={month} />
        <RelatedCountries country={country} />
        <PlanCta
          headline={`Plan a ${monthName} trip to ${country.name}.`}
          primaryHref={`/map?country=${country.slug}&month=${idx + 1}`}
        />
      </main>
      <PageFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: monthJsonLd(detail) }}
      />
    </>
  );
}

function buildMonthNarrative({
  countryName,
  monthName,
  rank,
  note,
}: {
  countryName: string;
  monthName: string;
  rank: number;
  note: string;
}): string {
  const rankPhrase =
    rank <= 3
      ? `one of the strongest months to visit ${countryName}`
      : rank <= 6
        ? `a solid shoulder-season month in ${countryName}`
        : rank <= 9
          ? `a mixed month for ${countryName} — worth planning around specific regions`
          : `a challenging month for ${countryName} overall; regional choices matter most`;
  return `${monthName} is ${rankPhrase}. ${note} Use the regional grid below to find where this month works best — national averages hide the swings between coast, highlands, and inland.`;
}

// ─── Region view ─────────────────────────────────────────────────────

function RegionView({
  country,
  region,
}: {
  country: CountryData;
  region: RegionRow;
}) {
  const range = regionTempRange(region);
  const best = regionBestMonthIndices(country, region, 3);
  const bestLabel = best.map((i) => MONTH_SHORT[MONTH_SLUGS[i]]).join(" · ");
  const countryTempMean =
    country.climate.t.reduce((s, v) => s + v, 0) / country.climate.t.length;
  const regionTempMean = region.tl.reduce((s, v) => s + v, 0) / region.tl.length;
  const delta = regionTempMean - countryTempMean;

  const months = region.tl.map((v, i) => ({ month: i, value: v }));

  return (
    <>
      <PageHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1280px] px-6 pt-6 md:px-12">
          <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12px] text-text-muted">
            <Link href="/" className="hover:text-text">
              Home
            </Link>
            <span aria-hidden="true">·</span>
            <Link href={`/${country.slug}`} className="hover:text-text">
              {country.name}
            </Link>
            <span aria-hidden="true">·</span>
            <span className="text-text">{region.name}</span>
          </nav>
        </div>

        <RegionHero
          country={country}
          region={region}
          range={range}
          bestLabel={bestLabel}
          delta={delta}
        />

        <section className="border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
            <div className="mb-6">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                12-month temperature · {region.name}
              </div>
              <h2 className="mt-1 font-display text-[28px] font-medium leading-[1.2] text-text">
                How the year moves in {region.name}
              </h2>
              <p className="mt-2 max-w-[680px] text-[14px] text-text-muted">
                Monthly mean temperature from ERA5. Rainfall and sunshine are
                currently shown at country level below — per-region coverage
                lands with the next pipeline cut.
              </p>
            </div>
            <ClimateChart
              kind="temp"
              months={months}
              context={`${region.name}, ${country.name}`}
            />
          </div>
        </section>

        <MonthScoreTable country={country} region={region} />
        <NeighbourRegions country={country} currentSlug={regionSlug(region.name)} />
        <SafetySection advisories={country.advisories} countryName={country.name} />
        <PlanCta
          headline={`Plan a trip to ${region.name}.`}
          primaryHref={`/map?country=${country.slug}`}
        />
      </main>
      <PageFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: regionJsonLd(country, region) }}
      />
    </>
  );
}

function RegionHero({
  country,
  region,
  range,
  bestLabel,
  delta,
}: {
  country: CountryData;
  region: RegionRow;
  range: { low: number; high: number };
  bestLabel: string;
  delta: number;
}) {
  const deltaStr =
    delta === 0
      ? "same as the national mean"
      : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}°C vs. ${country.name} mean`;
  return (
    <section className="relative overflow-hidden border-b border-border bg-surface">
      <div className="mx-auto grid w-full max-w-[1280px] gap-10 px-6 py-12 md:grid-cols-[1.15fr_1fr] md:px-12 md:py-16">
        <div className="flex flex-col justify-center gap-6">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            {country.name} · Regional climate
          </div>
          <h1 className="font-display text-[64px] font-medium leading-[1.04] tracking-[-0.02em] text-text md:text-[80px]">
            {region.name}
            <span className="block text-[32px] italic text-[#8A4A1E] md:text-[40px]">
              when to go
            </span>
          </h1>
          <p className="max-w-[560px] font-display text-[17px] leading-[1.55] text-text-muted">
            Regional slice of {country.name} with its own temperature profile.
            Best months here: <span className="text-text">{bestLabel}</span>.
          </p>
          <dl className="grid max-w-[520px] grid-cols-2 gap-x-6 gap-y-2 font-mono text-[12px] text-text-muted">
            <div className="flex gap-2">
              <dt className="text-text-subtle">Range</dt>
              <dd className="text-text">
                {range.low.toFixed(0)}–{range.high.toFixed(0)}°C
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-text-subtle">Compare</dt>
              <dd className="text-text">{deltaStr}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-text-subtle">Country</dt>
              <dd className="text-text">{country.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-text-subtle">TZ</dt>
              <dd className="text-text">{country.tz}</dd>
            </div>
          </dl>
        </div>
        <div className="flex items-start justify-end">
          <div className="flex items-center gap-4 rounded-md border border-border bg-background p-5">
            <ScoreBadge score={region.score} size="lg" />
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-text-muted">
                Region match
              </div>
              <div className="mt-1 font-display text-[18px] font-medium text-text">
                {region.score}/100
              </div>
              <p className="mt-1 max-w-[220px] text-[12px] text-text-muted">
                Free-tier default preferences. Tune preferences on the map to
                reshape this score.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MonthScoreTable({
  country,
  region,
}: {
  country: CountryData;
  region: RegionRow;
}) {
  const rows = MONTH_SLUGS.map((slug, i) => ({
    slug,
    name: MONTH_NAMES[slug],
    t: region.tl[i],
    score: estimateRegionMonthScore(country, region, i),
  }));
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
        <div className="mb-6">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Month by month · {region.name}
          </div>
          <h2 className="mt-1 font-display text-[28px] font-medium leading-[1.2] text-text">
            Pick your window
          </h2>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {rows.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/${country.slug}/${regionSlug(region.name)}/${r.slug}`}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-4 hover:bg-surface-2"
              >
                <div>
                  <div className="font-display text-[18px] font-medium text-text">
                    {r.name}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-text-muted">
                    {r.t.toFixed(0)}°C mean
                  </div>
                </div>
                <ScoreBadge score={r.score} size="sm" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function NeighbourRegions({
  country,
  currentSlug,
}: {
  country: CountryData;
  currentSlug: string;
}) {
  const others = country.regions.filter((r) => regionSlug(r.name) !== currentSlug);
  if (others.length === 0) return null;
  const top = [...others].sort((a, b) => b.score - a.score).slice(0, 6);
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
        <div className="mb-6">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Other regions · {country.name}
          </div>
          <h2 className="mt-1 font-display text-[28px] font-medium leading-[1.2] text-text">
            Nearby and comparable
          </h2>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {top.map((r) => (
            <li key={r.name}>
              <Link
                href={`/${country.slug}/${regionSlug(r.name)}`}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface p-3 hover:bg-surface-2"
              >
                <span className="text-[13px] font-medium text-text">{r.name}</span>
                <ScoreBadge score={r.score} size="sm" label="number" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
