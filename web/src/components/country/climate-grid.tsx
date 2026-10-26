import { ClimateChart, type ClimateChartKind, type MonthDatum } from "@/components/charts";
import type { CountryData, Monthly } from "@/lib/types";

import { PremiumClimateBlock } from "./premium-climate";

/**
 * "Climate at a glance" — 4 free charts, plus the Premium four as an offer.
 *
 * The Premium block used to render real series behind a blur. That worked when
 * the page ran on fixtures and stopped working the moment it ran on the API:
 * country pages are statically generated, so one HTML document serves every
 * visitor and a blurred chart still ships its numbers in view-source. The API
 * no longer sends them (see `ClimateSeries`), so this is now a genuine lock
 * rather than a CSS one. A premium visitor's browser fetches the real series
 * after hydration — see `PremiumClimateBlock`.
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
          {/*
            Two lines and an envelope behind them. tMin/tMax used to be piped
            in *as* the band, which is what made the chart look like it was
            shading a daily range while actually shading ten annual means.
            They are the mean daily maximum and minimum now, and the envelope
            is a separate, wider thing: the day-to-day spread within the month.
          */}
          <ChartFromMonthly
            kind="temp"
            values={c.tMax}
            low={c.tMin}
            bands={
              c.tBandLow && c.tBandHigh
                ? { p5: c.tBandLow, p95: c.tBandHigh }
                : undefined
            }
            context={country.name}
          />
          <ChartFromMonthly kind="rain" values={c.r} context={country.name} />
          <ChartFromMonthly kind="sun" values={c.s} context={country.name} />
          {c.w ? (
            <ChartFromMonthly
              kind="wind"
              values={c.w}
              bands={
                c.wBandLow && c.wBandHigh
                  ? { p5: c.wBandLow, p95: c.wBandHigh }
                  : undefined
              }
              context={country.name}
            />
          ) : null}
        </div>
        <PremiumClimateBlock countrySlug={country.slug} countryName={country.name} />
      </div>
    </section>
  );
}

export function ChartFromMonthly({
  kind,
  values,
  low,
  bands,
  locked,
  context,
}: {
  kind: ClimateChartKind;
  values: Monthly;
  /** A second line on the same axis — temperature's overnight low. */
  low?: Monthly;
  /** The premium envelope, once it has been fetched. */
  bands?: { p5: Monthly; p95: Monthly };
  locked?: boolean;
  context: string;
}) {
  const months: MonthDatum[] = values.map((value, i) => ({
    month: i,
    value,
    low: low?.[i],
    p5: bands?.p5[i],
    p95: bands?.p95[i],
  }));
  return <ClimateChart kind={kind} months={months} locked={locked} context={context} compact />;
}
