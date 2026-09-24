import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { ChartFromMonthly } from "@/components/country";
import { COUNTRY_DATALIST_ID, PageFooter, PageHeader } from "@/components/layout";
import { ScoreBadge } from "@/components/match";
import { RainfallMonthly, TemperatureRange, Wind } from "@/components/units";
import { getCountry } from "@/lib/api-client";
import { parseCompareParams } from "@/lib/compare";
import { estimateMonthScore } from "@/lib/country-derive";
import { routableCountries } from "@/lib/country-routes";
import { MONTH_NAMES, MONTH_SLUGS } from "@/lib/months";
import { getEntitlement, getSessionServer } from "@/lib/session";
import type { CountryData } from "@/lib/types";

export const metadata: Metadata = {
  title: "Compare destinations",
  // Per-session and per-query: nothing here is a page a search engine should hold.
  robots: { index: false, follow: false },
};

type Params = { a?: string | string[]; b?: string | string[]; month?: string | string[] };

/**
 * Two destinations side by side for one month. A Premium feature.
 *
 * **The tier boundary is the view, not the data.** Everything drawn here is a
 * free-tier series from the same `/v1/countries` payload the public country
 * pages render statically, so nothing premium can leak into this HTML. The
 * page is dynamic (it reads the session), so a Premium visitor and a free one
 * never share a document. Premium variables are deliberately absent: they are
 * not in that payload, and adding them would make this the one per-request
 * page that has to guard premium numbers.
 *
 * It works with JS off: the picker is a GET form and the charts are
 * server-rendered SVG.
 */
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const entitlement = getEntitlement(await getSessionServer());
  const params = await searchParams;

  if (!entitlement.premium) {
    return (
      <Shell>
        <Hero />
        <section className="bg-background">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
            <div className="max-w-[560px] rounded-md border border-border bg-surface p-6">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-accent-text">
                Premium
              </div>
              <p className="mt-2 text-[15px] leading-[1.6] text-text">
                Put two destinations side by side for the month you are
                travelling: the match, day and night temperatures, rain,
                sunshine, wind and the travel advisory, with the whole year
                charted underneath.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/upgrade"
                  className="rounded-md bg-primary px-4 py-2 text-[14px] font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Get Premium
                </Link>
                <Link
                  href={`/login?next=${encodeURIComponent(compareHref(params))}`}
                  className="rounded-md border border-border px-4 py-2 text-[14px] text-text hover:bg-surface-2"
                >
                  Already Premium? Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </Shell>
    );
  }

  const p = parseCompareParams(params, await routableCountries());
  const [a, b] = await Promise.all([
    p.a ? getCountry(p.a.slug).catch(() => null) : null,
    p.b ? getCountry(p.b.slug).catch(() => null) : null,
  ]);
  const unmatched = [!a && p.aQuery, !b && p.bQuery].filter(
    (q): q is string => Boolean(q),
  );

  return (
    <Shell>
      <Hero>
        <form
          action="/compare"
          method="get"
          className="mt-6 grid max-w-[760px] gap-3 sm:grid-cols-[1fr_1fr_auto_auto]"
        >
          <CountryInput name="a" label="First destination" value={a?.name ?? p.aQuery} />
          <CountryInput name="b" label="Second destination" value={b?.name ?? p.bQuery} />
          <select
            name="month"
            defaultValue={p.month}
            aria-label="Month"
            className="h-10 rounded-md border border-border bg-surface px-3 text-[14px] text-text"
          >
            {MONTH_SLUGS.map((slug) => (
              <option key={slug} value={slug}>
                {MONTH_NAMES[slug]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-10 rounded-md bg-primary px-4 text-[14px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            Compare
          </button>
        </form>
        {unmatched.length > 0 ? (
          <p className="mt-3 text-[14px] text-text-muted">
            {unmatched.map((q) => `“${q}”`).join(" and ")} did not match
            exactly one country with a climate page. Try the full name.
          </p>
        ) : null}
      </Hero>

      {a && b ? (
        <>
          <section className="border-b border-border bg-background">
            <div className="mx-auto w-full max-w-[1280px] px-6 py-10 md:px-12">
              <h2 className="mb-4 font-display text-[24px] font-medium leading-[1.2] text-text">
                {MONTH_NAMES[p.month]}: {a.name} or {b.name}?
              </h2>
              <CompareTable a={a} b={b} monthIdx={p.monthIdx} month={p.month} />
            </div>
          </section>
          <section className="border-b border-border bg-background">
            <div className="mx-auto w-full max-w-[1280px] px-6 py-10 md:px-12">
              <h2 className="mb-4 font-display text-[24px] font-medium leading-[1.2] text-text">
                The whole year
              </h2>
              <div className="flex flex-col gap-6">
                {CHART_KINDS.map((kind) => (
                  <div key={kind} className="grid gap-4 md:grid-cols-2">
                    <CountryChart country={a} kind={kind} />
                    <CountryChart country={b} kind={kind} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </Shell>
  );
}

const CHART_KINDS = ["temp", "rain", "sun", "wind"] as const;
type ChartKind = (typeof CHART_KINDS)[number];

/** Where a signed-out visitor comes back to after `/login`. */
function compareHref(params: Params): string {
  const qs = new URLSearchParams();
  for (const key of ["a", "b", "month"] as const) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `/compare?${query}` : "/compare";
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader />
      <main className="flex-1">{children}</main>
      <PageFooter />
    </>
  );
}

function Hero({ children }: { children?: ReactNode }) {
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
          Compare · 10-year ERA5
        </div>
        <h1 className="mt-1 font-display text-[36px] font-medium leading-[1.1] tracking-[-0.01em] text-text md:text-[44px]">
          Two places, one month.
        </h1>
        {children}
      </div>
    </section>
  );
}

function CountryInput({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <input
      type="search"
      name={name}
      list={COUNTRY_DATALIST_ID}
      defaultValue={value}
      aria-label={label}
      placeholder={label}
      autoComplete="off"
      className="h-10 min-w-0 rounded-md border border-border bg-surface px-3 text-[14px] text-text placeholder:text-text-subtle"
    />
  );
}

function CompareTable({
  a,
  b,
  monthIdx,
  month,
}: {
  a: CountryData;
  b: CountryData;
  monthIdx: number;
  month: string;
}) {
  const rows: { label: string; cell: (c: CountryData) => ReactNode }[] = [
    {
      label: "Match",
      cell: (c) => <ScoreBadge score={estimateMonthScore(c, monthIdx)} size="sm" label="full" />,
    },
    {
      label: "Day / night",
      cell: (c) => (
        <TemperatureRange low={c.climate.tMin[monthIdx]} high={c.climate.tMax[monthIdx]} />
      ),
    },
    { label: "Rainfall", cell: (c) => <RainfallMonthly value={c.climate.r[monthIdx]} /> },
    {
      label: "Rainy days",
      cell: (c) =>
        c.climate.wetDays ? `${Math.round(c.climate.wetDays[monthIdx])} days` : "—",
    },
    { label: "Sunshine", cell: (c) => `${c.climate.s[monthIdx].toFixed(1)} hr / day` },
    {
      label: "Wind",
      cell: (c) => (c.climate.w ? <Wind value={c.climate.w[monthIdx]} /> : "—"),
    },
    {
      label: "Travel advisory",
      cell: (c) => c.advisories?.combined.label ?? "No advisory data",
    },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-border">
            <td className="w-40 py-2 pr-4" />
            {[a, b].map((c) => (
              <th
                key={c.slug}
                scope="col"
                className="py-2 pr-4 font-display text-[18px] font-medium text-text"
              >
                <Link
                  href={`/${c.slug}/${month}`}
                  className="underline-offset-2 hover:text-text-link hover:underline"
                >
                  {c.name}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border">
              <th
                scope="row"
                className="py-3 pr-4 font-mono text-[11.5px] font-normal uppercase tracking-[0.12em] text-text-muted"
              >
                {row.label}
              </th>
              <td className="py-3 pr-4 text-text">{row.cell(a)}</td>
              <td className="py-3 pr-4 text-text">{row.cell(b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CountryChart({ country, kind }: { country: CountryData; kind: ChartKind }) {
  const c = country.climate;
  if (kind === "temp") {
    return (
      <ChartFromMonthly
        kind="temp"
        values={c.tMax}
        low={c.tMin}
        bands={c.tBandLow && c.tBandHigh ? { p5: c.tBandLow, p95: c.tBandHigh } : undefined}
        context={country.name}
      />
    );
  }
  if (kind === "wind") {
    if (!c.w) return <div />;
    return (
      <ChartFromMonthly
        kind="wind"
        values={c.w}
        bands={c.wBandLow && c.wBandHigh ? { p5: c.wBandLow, p95: c.wBandHigh } : undefined}
        context={country.name}
      />
    );
  }
  return (
    <ChartFromMonthly kind={kind} values={kind === "rain" ? c.r : c.s} context={country.name} />
  );
}
