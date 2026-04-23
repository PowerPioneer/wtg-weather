import Link from "next/link";
import { ClimateChart, type ClimateChartKind, type MonthDatum } from "@/components/charts";
import type { CountryData, Monthly } from "@/lib/types";

/**
 * "Climate at a glance" — 4 free charts + 4 Premium-locked charts.
 * Reads directly off `CountryData.climate` so no intermediate reshape is
 * needed at the page level.
 */
export function ClimateGrid({ country }: { country: CountryData }) {
  const c = country.climate;
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
        <div className="mb-6">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Climate at a glance · 10-year ERA5
          </div>
          <h2 className="mt-1 font-display text-[28px] font-medium leading-[1.2] text-text">
            A decade of weather, in one page
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ChartFromMonthly kind="temp" values={c.t} bands={{ p10: c.tMin, p90: c.tMax }} context={country.name} />
          <ChartFromMonthly kind="rain" values={c.r} context={country.name} />
          <ChartFromMonthly kind="sun" values={c.s} context={country.name} />
          <ChartFromMonthly kind="wind" values={c.w} context={country.name} />
        </div>
        <div className="mt-6">
          <div className="mb-3 flex items-baseline justify-between">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-accent">
              Premium · four more variables
            </div>
            <Link href="/pricing" className="font-mono text-[12px] text-text-link hover:underline">
              Unlock Premium →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ChartFromMonthly kind="snow" values={c.snow} locked context={country.name} />
            <ChartFromMonthly kind="sst" values={c.sst} locked context={country.name} />
            <ChartFromMonthly kind="heat" values={c.heat} locked context={country.name} />
            <ChartFromMonthly kind="humidity" values={c.hum} locked context={country.name} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ChartFromMonthly({
  kind,
  values,
  bands,
  locked,
  context,
}: {
  kind: ClimateChartKind;
  values: Monthly;
  bands?: { p10: Monthly; p90: Monthly };
  locked?: boolean;
  context: string;
}) {
  const months: MonthDatum[] = values.map((value, i) => ({
    month: i,
    value,
    p10: bands?.p10[i],
    p90: bands?.p90[i],
  }));
  return <ClimateChart kind={kind} months={months} locked={locked} context={context} compact />;
}
