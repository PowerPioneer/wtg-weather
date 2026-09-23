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

import { useDragDismiss } from "@/hooks/use-drag-dismiss";

import { ClimateChart, type ClimateChartKind, type MonthDatum } from "@/components/charts";
import { FavouriteButton } from "@/components/favourite/favourite-button";
import { ScoreBadge } from "@/components/match";
import { SafetyBadge } from "@/components/safety";
import { SaveTripButton } from "@/components/trip";
import { cn } from "@/lib/cn";
import type { CountryRef } from "@/lib/countries";
import {
  readAdvisoryLevel,
  readMonthlyBand,
  readMonthlySeries,
  readPreferenceScore,
  type FeatureIdentity,
  type FeatureProperties,
} from "@/lib/feature-climate";
import { MONTH_NAMES, MONTH_SLUGS } from "@/lib/months";
import {
  DEFAULT_PREFERENCES,
  SAFETY_LIMIT_LABEL,
  failsSafetyLimit,
  isDefaultPreferenceSet,
  type WeatherPreferences,
} from "@/lib/scoring";

export type ClimatePanelProps = {
  identity: FeatureIdentity;
  properties: FeatureProperties;
  /** 1-indexed month currently selected on the map. */
  month: number;
  /**
   * The preferences the map is painting with. Passing them keeps the score in
   * this panel the same number that chose the polygon's colour; omitting them
   * falls back to the pipeline's baked default score.
   */
  preferences?: WeatherPreferences;
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
 * paints from and the chart's line. `lowAlias` adds a second line. `band` names
 * the two property prefixes whose series shade the envelope behind them.
 * Premium-only variables are listed too — they are simply absent from a free
 * feature, and absent charts are skipped.
 *
 * The band keys are spelled out rather than derived from a variable name
 * because the two halves of the temperature envelope come from different
 * variables, and because the daily and monthly aggregates label their
 * statistics differently (p5/p95 against p10/p90). Deriving them is what made
 * every band here silently disappear across the daily rebuild.
 */
const CHART_SERIES: readonly {
  kind: ClimateChartKind;
  alias: string;
  lowAlias?: string;
  band?: readonly [low: string, high: string];
}[] = [
  // Two lines — mean daily maximum over mean daily minimum — with the
  // within-month spread behind them, the same pair the country page draws.
  {
    kind: "temp",
    alias: "t",
    lowAlias: "tmin",
    band: ["t2m_min_p5", "t2m_max_p95"],
  },
  { kind: "rain", alias: "r", band: ["tp_p5", "tp_p95"] },
  { kind: "sun", alias: "s", band: ["sun_hours_p5", "sun_hours_p95"] },
  // Still standing in from the monthly aggregate, hence p10/p90 and a band
  // that is an interannual spread rather than a within-month one. It goes to
  // p5/p95 when `si10_mean` lands at day resolution.
  { kind: "wind", alias: "w", band: ["si10_p10", "si10_p90"] },
  { kind: "snow", alias: "snow", band: ["sd_p10", "sd_p90"] },
  { kind: "sst", alias: "sst", band: ["sst_p10", "sst_p90"] },
  // Derived per-month from other variables, so there is no spread to show.
  { kind: "humidity", alias: "hum" },
  { kind: "heat", alias: "heat" },
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
  preferences,
  country,
  hasCountryPage = true,
  onClose,
  className,
}: ClimatePanelProps) {
  const monthSlug = MONTH_SLUGS[month - 1];
  const monthName = MONTH_NAMES[monthSlug];
  const score = readPreferenceScore(properties, month, preferences);
  const advisory = readAdvisoryLevel(properties);
  const custom = preferences != null && !isDefaultPreferenceSet(preferences);
  const safetyLimit = (preferences ?? DEFAULT_PREFERENCES).safetyMax;
  const vetoed =
    advisory != null && failsSafetyLimit(advisory, preferences ?? DEFAULT_PREFERENCES);
  const charts = CHART_SERIES.map((series) => ({
    kind: series.kind,
    months: buildMonths(properties, series),
  })).filter((c): c is { kind: ClimateChartKind; months: MonthDatum[] } =>
    c.months !== null,
  );

  const drag = useDragDismiss({ onDismiss: onClose });

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
      style={{
        // Only ever moves on touch: `handleProps` live on the grab handle,
        // which is `md:hidden`. On desktop the panel is a side rail and this
        // stays at 0.
        transform: drag.offset ? `translateY(${drag.offset}px)` : undefined,
        transition: drag.dragging ? "none" : "transform 180ms ease-out",
      }}
      className={cn(
        // 88% rather than 70%: on a phone this is the country's whole
        // readout — match, advisory, temperature, the CTA — and at 70% of a
        // short viewport the footer button sat below the fold with nothing to
        // indicate it was there. The remaining strip is deliberate: it shows
        // the map still behind, and it is where you tap to dismiss.
        "pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex max-h-[88%] flex-col rounded-t-xl border-t border-border bg-surface shadow-lg",
        "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:rounded-none md:border-l md:border-t-0",
        className,
      )}
    >
      {/*
        Grab handle. Phones only — a mouse has the close button and the Escape
        key, and a side rail has nowhere to be dragged to. It is a real button
        rather than a decorative bar so that the affordance is not touch-only:
        tab to it and press Enter and the panel closes, which is the same
        outcome the drag has.
      */}
      <button
        type="button"
        onClick={() => {
          // A drag that sprang back still ends in a click; only a genuine tap
          // should close.
          if (!drag.didDrag()) onClose();
        }}
        aria-label="Drag down to close"
        data-testid="climate-panel-handle"
        className="flex w-full shrink-0 touch-none items-center justify-center py-3 outline-none md:hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--color-focus-ring)]"
        {...drag.handleProps}
      >
        <span
          aria-hidden="true"
          className="h-1 w-10 rounded-full bg-border-strong"
        />
      </button>

      <header className="flex items-start justify-between gap-3 border-b border-border px-6 pb-5 pt-1 md:pt-5">
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
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-text-muted">
              {monthName} match · {custom ? "your preferences" : "default preferences"}
            </div>
            {/*
              The verdict is the badge to the right and nowhere else. Printing
              the same four words twice, once in display type and once inside
              the colour chip, was what removing the number left behind — the
              chip used to carry a number and the line carried the word.
            */}
            {score == null ? (
              <div className="mt-0.5 font-display text-[17px] font-medium text-text">
                No match for this area
              </div>
            ) : null}
            {/*
              When the advisory is what decided the verdict, say so. Otherwise
              a place with excellent weather reads "Avoid" for no visible
              reason — the colour is right and the explanation is missing.
            */}
            {vetoed ? (
              <div className="mt-1 text-[12px] leading-snug text-text-muted">
                Advisory level {advisory} is above your limit (
                {SAFETY_LIMIT_LABEL[safetyLimit].toLowerCase()}), so this reads
                Avoid whatever the weather does.
              </div>
            ) : null}
          </div>
          {score == null ? null : <ScoreBadge score={score} size="lg" />}
        </div>

        {/*
          Only country and admin-1 can be favourited: those are the two levels
          the API's `region_code` addresses and the two the account page can
          resolve back to a name and a page. A district has neither.
        */}
        {country && identity.level !== "admin2" && (
          <div className="mt-3 flex flex-wrap items-start gap-2">
            <FavouriteButton
              countryIso2={country.iso2}
              regionCode={identity.level === "admin1" ? identity.id : null}
              name={place}
            />
            {/*
              Saving from here captures exactly what is on screen: this
              polygon, the month the map is set to, and the preferences that
              chose its colour. That is the whole trip — the ranking is
              recomputed on the trip page from whatever the pipeline published
              last, so nothing is frozen at save time.
            */}
            <SaveTripButton
              countryIso2={country.iso2}
              regionCode={identity.level === "admin1" ? identity.id : null}
              placeName={place}
              month={month}
              monthSlug={monthSlug}
              monthName={monthName}
              preferences={preferences ?? DEFAULT_PREFERENCES}
            />
          </div>
        )}

        {/* The advisory the Safety mode paints. Month-less, and absent for a
            country no government lists — which the map renders grey, so the
            panel says nothing rather than implying "level 1". */}
        {advisory == null ? null : (
          <div
            className="mt-3 rounded-md border border-border px-4 py-3"
            data-testid="panel-advisory"
          >
            <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-text-muted">
              Travel advisory · highest of 6 sources
            </div>
            <SafetyBadge level={advisory} size="sm" className="mt-2" />
          </div>
        )}

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
            {/* An admin-1 click leads to that region's own page. The href goes
                through the resolver because the tiles carry the polygon id and
                the name, never the de-duplicated slug the page is filed under.
                Districts (admin-2) have no page of their own, so they keep the
                country as their destination. */}
            {identity.level === "admin1" ? (
              <Link
                href={regionResolverHref(country.slug, identity)}
                prefetch={false}
                data-testid="view-region-page"
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                View {identity.name || "region"} region page
              </Link>
            ) : null}
            <Link
              href={`/${country.slug}`}
              data-testid="view-country-page"
              className={cn(
                "inline-flex h-10 w-full items-center justify-center rounded-md px-4 text-[14px] font-medium transition-colors",
                identity.level === "admin1"
                  ? "border border-border-strong bg-surface text-text hover:bg-surface-2"
                  : "bg-primary text-primary-foreground hover:bg-primary-hover",
              )}
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
 * Link to the region resolver (`app/region/[country]/[code]/route.ts`), which
 * turns the clicked polygon's id into that region's canonical URL. The name
 * rides along so the resolver can still find the region in a bundle published
 * before region rows carried their code.
 */
function regionResolverHref(countrySlug: string, identity: FeatureIdentity): string {
  const base = `/region/${countrySlug}/${encodeURIComponent(identity.id)}`;
  return identity.name
    ? `${base}?name=${encodeURIComponent(identity.name)}`
    : base;
}

/**
 * 12 `MonthDatum`s for one variable, or `null` when the feature does not carry
 * a complete year — `ClimateChart` requires exactly 12 and a half-drawn line
 * would misrepresent the gap as a value.
 */
function buildMonths(
  properties: FeatureProperties,
  series: (typeof CHART_SERIES)[number],
): MonthDatum[] | null {
  const values = readMonthlySeries(properties, series.alias);
  if (!values || values.some((v) => v == null)) return null;

  const lows = series.lowAlias
    ? readMonthlySeries(properties, series.lowAlias)
    : null;
  const hasLow = lows != null && lows.every((v) => v != null);

  // `p5`/`p95` are what `MonthDatum` calls the envelope edges; the band itself
  // may be an interannual p10/p90 for a variable still on the monthly shape.
  const band = series.band
    ? readMonthlyBand(properties, series.band[0], series.band[1])
    : null;
  // Both edges, every month, or none: a half-drawn envelope reads as data.
  const hasBand =
    band != null &&
    band.low.every((v) => v != null) &&
    band.high.every((v) => v != null);

  return values.map((value, index) => ({
    month: index,
    value: value as number,
    ...(hasLow ? { low: lows[index] as number } : {}),
    ...(hasBand
      ? {
          p5: band.low[index] as number,
          p95: band.high[index] as number,
        }
      : {}),
  }));
}
