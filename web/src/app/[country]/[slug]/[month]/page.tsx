import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClimateChart } from "@/components/charts";
import { PlanCta, SafetySection } from "@/components/country";
import { PageFooter, PageHeader } from "@/components/layout";
import { ScoreBadge } from "@/components/match";
import { getCountry, getRegion } from "@/lib/api-client";
import { COUNTRIES } from "@/lib/countries";
import {
  MONTH_NAMES,
  MONTH_SHORT,
  MONTH_SLUGS,
  isMonthSlug,
  monthIndex,
  nextMonth,
  previousMonth,
  type MonthSlug,
} from "@/lib/months";
import {
  estimateRegionMonthScore,
  regionBestMonthIndices,
  regionMonthRank,
  regionSlug,
} from "@/lib/regions";
import { regionMonthJsonLd, regionMonthMetadata } from "@/lib/seo";
import type { CountryData, RegionRow } from "@/lib/types";

/**
 * Third-level route `/[country]/[slug]/[month]`. The parent `[slug]` segment
 * dispatches between months (e.g. `/peru/april`) and regions (e.g.
 * `/peru/cusco`); only region slugs extend into `[month]`. Month-as-slug
 * combinations are excluded from `generateStaticParams` and 404 via
 * `dynamicParams = false`.
 */

export const revalidate = 2592000;
export const dynamicParams = false;

export async function generateStaticParams() {
  const out: { country: string; slug: string; month: string }[] = [];
  for (const c of COUNTRIES) {
    const data = await getCountry(c.slug);
    if (!data) continue;
    for (const r of data.regions) {
      const slug = regionSlug(r.name);
      for (const m of MONTH_SLUGS) {
        out.push({ country: c.slug, slug, month: m });
      }
    }
  }
  return out;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string; slug: string; month: string }>;
}): Promise<Metadata> {
  const { country, slug, month } = await params;
  if (!isMonthSlug(month)) return { title: "Month not found" };
  const pair = await getRegion(country, slug);
  if (!pair) return { title: "Region not found" };
  return regionMonthMetadata(pair.country, pair.region, month, MONTH_NAMES[month]);
}

export default async function RegionMonthPage({
  params,
}: {
  params: Promise<{ country: string; slug: string; month: string }>;
}) {
  const { country, slug, month } = await params;
  if (!isMonthSlug(month)) notFound();
  const pair = await getRegion(country, slug);
  if (!pair) notFound();
  const { country: data, region: reg } = pair;

  const idx = monthIndex(month);
  const monthName = MONTH_NAMES[month];
  const score = estimateRegionMonthScore(data, reg, idx);
  const rank = regionMonthRank(data, reg, idx);
  const regionTempMean = reg.tl.reduce((s, v) => s + v, 0) / reg.tl.length;
  const tempDelta = reg.tl[idx] - regionTempMean;
  const bestMonths = regionBestMonthIndices(data, reg, 3)
    .map((i) => MONTH_NAMES[MONTH_SLUGS[i]])
    .join(" · ");

  const narrative = buildNarrative({
    regionName: reg.name,
    countryName: data.name,
    monthName,
    rank,
    tempDelta,
  });

  const months = reg.tl.map((v, i) => ({ month: i, value: v }));

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
            <Link href={`/${data.slug}`} className="hover:text-text">
              {data.name}
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              href={`/${data.slug}/${regionSlug(reg.name)}`}
              className="hover:text-text"
            >
              {reg.name}
            </Link>
            <span aria-hidden="true">·</span>
            <span className="text-text">{monthName}</span>
          </nav>
        </div>

        <RegionMonthHero
          country={data}
          region={reg}
          monthName={monthName}
          score={score}
          rank={rank}
          narrative={narrative}
        />

        <RegionMonthStats
          region={reg}
          monthIdx={idx}
          tempDelta={tempDelta}
          rank={rank}
          bestMonths={bestMonths}
        />

        <section className="border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
            <div className="mb-6">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                12-month temperature · {reg.name}
              </div>
              <h2 className="mt-1 font-display text-[28px] font-medium leading-[1.2] text-text">
                {monthName} in context
              </h2>
            </div>
            <ClimateChart
              kind="temp"
              months={months}
              context={`${reg.name}, ${data.name} — ${monthName}`}
            />
          </div>
        </section>

        <SafetySection advisories={data.advisories} countryName={data.name} />
        <RegionMonthPager country={data} region={reg} month={month} />
        <PlanCta
          headline={`Plan a ${monthName} trip to ${reg.name}.`}
          primaryHref={`/map?country=${data.slug}&month=${idx + 1}`}
        />
      </main>
      <PageFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: regionMonthJsonLd(data, reg, month, monthName),
        }}
      />
    </>
  );
}

function RegionMonthHero({
  country,
  region,
  monthName,
  score,
  rank,
  narrative,
}: {
  country: CountryData;
  region: RegionRow;
  monthName: string;
  score: number;
  rank: number;
  narrative: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-surface">
      <div className="mx-auto grid w-full max-w-[1280px] gap-10 px-6 py-12 md:grid-cols-[1.15fr_1fr] md:px-12 md:py-16">
        <div className="flex flex-col justify-center gap-6">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            {country.name} · {region.name} · {monthName}
          </div>
          <h1 className="font-display text-[56px] font-medium leading-[1.04] tracking-[-0.02em] text-text md:text-[72px]">
            {region.name} in {monthName}
            <span className="block text-[28px] italic text-[#8A4A1E] md:text-[36px]">
              how the month reads
            </span>
          </h1>
          <p className="max-w-[560px] font-display text-[17px] leading-[1.55] text-text-muted">
            {narrative}
          </p>
          <dl className="grid max-w-[520px] grid-cols-2 gap-x-6 gap-y-2 font-mono text-[12px] text-text-muted">
            <div className="flex gap-2">
              <dt className="text-text-subtle">Rank</dt>
              <dd className="text-text">{rank} of 12</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-text-subtle">Score</dt>
              <dd className="text-text">{score}/100</dd>
            </div>
          </dl>
        </div>
        <div className="flex items-start justify-end">
          <div className="flex items-center gap-4 rounded-md border border-border bg-background p-5">
            <ScoreBadge score={score} size="lg" />
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-text-muted">
                {monthName} match
              </div>
              <div className="mt-1 font-display text-[18px] font-medium text-text">
                {score}/100
              </div>
              <p className="mt-1 max-w-[220px] text-[12px] text-text-muted">
                Free-tier default preferences.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RegionMonthStats({
  region,
  monthIdx,
  tempDelta,
  rank,
  bestMonths,
}: {
  region: RegionRow;
  monthIdx: number;
  tempDelta: number;
  rank: number;
  bestMonths: string;
}) {
  const temp = region.tl[monthIdx];
  const deltaStr =
    tempDelta === 0
      ? "same as yearly mean"
      : `${tempDelta > 0 ? "+" : ""}${tempDelta.toFixed(1)}°C vs. yearly mean`;
  const cards: { label: string; value: string; note?: string }[] = [
    { label: "Temperature", value: `${temp.toFixed(0)}°C`, note: deltaStr },
    { label: "Month rank", value: `${rank} of 12`, note: `for ${region.name}` },
    { label: "Best months", value: bestMonths, note: "highest regional score" },
  ];
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
        <ul className="grid gap-4 md:grid-cols-3">
          {cards.map((c) => (
            <li
              key={c.label}
              className="rounded-md border border-border bg-surface p-5"
            >
              <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-text-muted">
                {c.label}
              </div>
              <div className="mt-2 font-display text-[28px] font-medium text-text">
                {c.value}
              </div>
              {c.note && (
                <div className="mt-1 font-mono text-[11px] text-text-muted">
                  {c.note}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function RegionMonthPager({
  country,
  region,
  month,
}: {
  country: CountryData;
  region: RegionRow;
  month: MonthSlug;
}) {
  const prev = previousMonth(month);
  const next = nextMonth(month);
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
        <div className="grid gap-4 md:grid-cols-2">
          <RegionMonthPagerCard
            country={country}
            region={region}
            slug={prev}
            direction="prev"
          />
          <RegionMonthPagerCard
            country={country}
            region={region}
            slug={next}
            direction="next"
          />
        </div>
      </div>
    </section>
  );
}

function RegionMonthPagerCard({
  country,
  region,
  slug,
  direction,
}: {
  country: CountryData;
  region: RegionRow;
  slug: MonthSlug;
  direction: "prev" | "next";
}) {
  const idx = monthIndex(slug);
  const name = MONTH_NAMES[slug];
  const score = estimateRegionMonthScore(country, region, idx);
  const temp = region.tl[idx];
  return (
    <Link
      href={`/${country.slug}/${regionSlug(region.name)}/${slug}`}
      className="flex items-center gap-5 rounded-md border border-border bg-surface p-5 hover:bg-surface-2"
    >
      <div className="flex-1">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          {direction === "prev" ? "← Earlier" : "Later →"}
        </div>
        <div className="mt-1 font-display text-[24px] font-medium text-text">
          {name}
        </div>
        <p className="mt-1 font-mono text-[11px] text-text-muted">
          {temp.toFixed(0)}°C in {MONTH_SHORT[slug]}
        </p>
      </div>
      <ScoreBadge score={score} size="md" />
    </Link>
  );
}

function buildNarrative({
  regionName,
  countryName,
  monthName,
  rank,
  tempDelta,
}: {
  regionName: string;
  countryName: string;
  monthName: string;
  rank: number;
  tempDelta: number;
}): string {
  const rankPhrase =
    rank <= 3
      ? `one of the strongest months for ${regionName}`
      : rank <= 6
        ? `a solid shoulder month for ${regionName}`
        : rank <= 9
          ? `a mixed month — worth planning against specific weeks`
          : `a challenging month for ${regionName} overall`;
  const tempPhrase =
    Math.abs(tempDelta) < 0.5
      ? `average temperatures for the region`
      : tempDelta > 0
        ? `warmer than the yearly mean by ${tempDelta.toFixed(1)}°C`
        : `cooler than the yearly mean by ${Math.abs(tempDelta).toFixed(1)}°C`;
  return `${monthName} is ${rankPhrase} inside ${countryName}, with ${tempPhrase}. The country-level safety bulletins below apply — regional variation in advisories ships with the next pipeline cut.`;
}
