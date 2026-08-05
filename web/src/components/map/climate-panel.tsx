"use client";

/**
 * Climate panel — what a click on the map opens.
 *
 * Before this existed a click either hard-navigated to a country page (for the
 * nine countries the registry knew) or did nothing at all, so the map felt
 * inert. The panel is the visible response: it names what was clicked, scores
 * the selected month, charts the 12-month climatology, and offers the country
 * page as a deliberate next step rather than an ambush.
 *
 * Everything it renders comes from the clicked feature's own tile properties —
 * no fetch, per `web/CLAUDE.md` ("never fetch climate data from the browser").
 * Charts render only where the tier and level actually carry all 12 months.
 */

import Link from "next/link";

import { ClimateChart, type ClimateChartKind, type MonthDatum } from "@/components/charts";
import { ScoreBadge } from "@/components/match";
import { cn } from "@/lib/cn";
import type { CountryRef } from "@/lib/countries";
import {
  readMonthlyBands,
  readMonthlySeries,
  readPreferenceScore,
  type FeatureIdentity,
  type FeatureProperties,
} from "@/lib/feature-climate";
import { MONTH_NAMES, MONTH_SLUGS } from "@/lib/months";
import { scoreLabel } from "@/lib/scoring";

export type ClimatePanelProps = {
  identity: FeatureIdentity;
  properties: FeatureProperties;
  /** 1-indexed month currently selected on the map. */
  month: number;
  /** Registry entry for the feature's ISO-2, when it has one. */
  country: CountryRef | undefined;
  /**
   * Whether `/{country.slug}` is actually built. The registry covers the whole
   * world so the map can name every polygon, but the SSR pages only exist for
   * countries the data path can answer for — offering a button to a 404 is
   * worse than saying the page isn't there yet.
   */
  hasCountryPage?: boolean;
  onClose: () => void;
  className?: string;
};

/**
 * Charts to attempt, in order. `alias` is the short per-month property the map
 * paints from; `variable` is the raw ERA5 code whose p10/p90 triplet becomes
 * the percentile band. Premium-only variables are listed too — they are simply
 * absent from a free feature, and absent charts are skipped.
 */
const CHART_SERIES: readonly {
  kind: ClimateChartKind;
  alias: string;
  variable: string;
}[] = [
  { kind: "temp", alias: "t", variable: "t2m" },
  { kind: "rain", alias: "r", variable: "tp" },
  { kind: "sun", alias: "s", variable: "sun_hours" },
  { kind: "wind", alias: "w", variable: "si10" },
  { kind: "snow", alias: "snow", variable: "sd" },
  { kind: "sst", alias: "sst", variable: "sst" },
  { kind: "humidity", alias: "hum", variable: "rh" },
  { kind: "heat", alias: "heat", variable: "heat" },
];

const LEVEL_NOUN: Record<FeatureIdentity["level"], string> = {
  country: "Country",
  admin1: "Region",
  admin2: "District",
};

export function ClimatePanel({
  identity,
  properties,
  month,
  country,
  hasCountryPage = true,
  onClose,
  className,
}: ClimatePanelProps) {
  const monthSlug = MONTH_SLUGS[month - 1];
  const monthName = MONTH_NAMES[monthSlug];
  const score = readPreferenceScore(properties, month);
  const charts = CHART_SERIES.map((series) => ({
    kind: series.kind,
    months: buildMonths(properties, series.alias, series.variable),
  })).filter((c): c is { kind: ClimateChartKind; months: MonthDatum[] } =>
    c.months !== null,
  );

  const place = identity.name || country?.name || "Selected area";
  const context =
    identity.level === "country"
      ? LEVEL_NOUN.country
      : country
        ? `${LEVEL_NOUN[identity.level]} in ${country.name}`
        : LEVEL_NOUN[identity.level];

  return (
    <aside
      role="dialog"
      aria-label={`Climate detail — ${place}`}
      data-testid="climate-panel"
      data-feature-id={identity.id}
      className={cn(
        "pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex max-h-[70%] flex-col border-t border-border bg-surface shadow-lg",
        "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:border-l md:border-t-0",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-6 py-5">
        <div className="min-w-0">
          <div className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
            Climate · 10-year ERA5 reanalysis
          </div>
          <h2 className="mt-1 truncate font-display text-[24px] font-medium leading-tight text-text">
            {place}
          </h2>
          <p className="mt-1 text-[13px] text-text-muted">{context}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close climate detail"
          className="-mr-2 -mt-1 shrink-0 rounded-sm p-2 text-text-muted outline-none transition hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)]"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="flex items-center gap-3 rounded-md bg-surface-sunken px-4 py-3">
          <div className="flex-1">
            <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-text-muted">
              {monthName} match
            </div>
            <div className="mt-0.5 font-display text-[17px] font-medium text-text">
              {score == null ? "No score for this area" : scoreLabel(score)}
            </div>
          </div>
          {score == null ? null : <ScoreBadge score={score} size="lg" label="number" />}
        </div>

        {charts.length === 0 ? (
          <p className="mt-5 text-[13px] leading-relaxed text-text-muted">
            This polygon carries no climate values in the tiles you are signed
            in for. Zoom out to the country level, or try another area.
          </p>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            {charts.map((chart) => (
              <ClimateChart
                key={chart.kind}
                kind={chart.kind}
                months={chart.months}
                compact
                context={`${place}, ${monthName}`}
              />
            ))}
          </div>
        )}
      </div>

      <footer className="border-t border-border px-6 py-4">
        {country && hasCountryPage ? (
          <div className="flex flex-col gap-2">
            <Link
              href={`/${country.slug}`}
              data-testid="view-country-page"
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              View {country.name} country page
            </Link>
            <Link
              href={`/${country.slug}/${monthSlug}`}
              className="text-center font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted underline-offset-2 hover:text-text hover:underline"
            >
              {country.name} in {monthName}
            </Link>
          </div>
        ) : country ? (
          // Named, but its page is not built yet — the registry covers the
          // whole world while the SSR pages wait on the real data path.
          <p className="text-[12px] leading-relaxed text-text-muted">
            The {country.name} country page is not published yet. The map data
            above is live.
          </p>
        ) : (
          // Somaliland, Northern Cyprus and the Siachen Glacier are painted but
          // carry no ISO-2 code, so there is no country page to send anyone to.
          <p className="text-[12px] leading-relaxed text-text-muted">
            This area has no internationally assigned country code, so it has no
            country page yet.
          </p>
        )}
      </footer>
    </aside>
  );
}

/**
 * 12 `MonthDatum`s for one variable, or `null` when the feature does not carry
 * a complete year — `ClimateChart` requires exactly 12 and a half-drawn line
 * would misrepresent the gap as a value.
 */
function buildMonths(
  properties: FeatureProperties,
  alias: string,
  variable: string,
): MonthDatum[] | null {
  const series = readMonthlySeries(properties, alias);
  if (!series || series.some((v) => v == null)) return null;

  const bands = readMonthlyBands(properties, variable);
  const complete =
    bands != null &&
    bands.p10.every((v) => v != null) &&
    bands.p90.every((v) => v != null);

  return series.map((value, index) => ({
    month: index,
    value: value as number,
    ...(complete
      ? {
          p10: bands.p10[index] as number,
          p90: bands.p90[index] as number,
        }
      : {}),
  }));
}
