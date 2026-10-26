"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { ClimateChart, type ClimateChartKind, type MonthDatum } from "@/components/charts";
import { usePremiumEntitlement } from "@/hooks/use-session";
import { fetchPremiumClimate } from "@/lib/api-client";
import type { Monthly, PremiumClimate } from "@/lib/types";

type PremiumKey = "snow" | "sst" | "humidity" | "heat";

/** The four the Premium tier sells, in the order the map's panel shows them. */
export const PREMIUM_VARIABLES: readonly { kind: ClimateChartKind; key: PremiumKey; title: string }[] = [
  { kind: "snow", key: "snow", title: "Snow depth" },
  { kind: "sst", key: "sst", title: "Sea surface temperature" },
  { kind: "heat", key: "heat", title: "Heat index" },
  { kind: "humidity", key: "humidity", title: "Humidity" },
];

/**
 * The country page's Premium block: four teasers in the static HTML, four
 * charts for a premium visitor.
 *
 * The page is statically generated and served identically to everyone, so the
 * premium numbers cannot be in it — a blurred chart still ships its data in
 * view-source. This component therefore server-renders exactly the teasers
 * the page always had, and only after hydration, and only when `/api/me` says
 * premium, asks `/api/countries/{slug}/premium` for the series. Anyone else,
 * including a reader with scripting off and every crawler, sees the teaser
 * and nothing more; nothing about the static HTML changes.
 *
 * Teaser and chart occupy the same card height, so the swap does not move the
 * page under a premium reader (`web/CLAUDE.md`: CLS < 0.05).
 */
export function PremiumClimateBlock({
  countrySlug,
  countryName,
}: {
  countrySlug: string;
  countryName: string;
}) {
  const { premium, loading } = usePremiumEntitlement();
  const [data, setData] = useState<PremiumClimate | null>(null);

  useEffect(() => {
    if (loading || !premium) return;
    let cancelled = false;
    void fetchPremiumClimate(countrySlug).then((payload) => {
      if (!cancelled) setData(payload);
    });
    return () => {
      cancelled = true;
    };
  }, [premium, loading, countrySlug]);

  return (
    <div className="mt-6" data-premium-state={data ? "unlocked" : "teaser"}>
      <div className="mb-3 flex items-baseline justify-between">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-accent-text">
          Premium · four more variables
        </div>
        {data ? null : (
          <Link href="/pricing" className="font-mono text-[12px] text-text-link hover:underline">
            Unlock Premium →
          </Link>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PREMIUM_VARIABLES.map((variable) => {
          if (!data) {
            return <PremiumTeaser key={variable.kind} kind={variable.kind} title={variable.title} countryName={countryName} />;
          }
          const series = data[variable.key];
          if (!series) {
            return <NotPublished key={variable.kind} kind={variable.kind} title={variable.title} countryName={countryName} />;
          }
          const low = variable.key === "snow" ? data.snowBandLow : variable.key === "sst" ? data.sstBandLow : null;
          const high = variable.key === "snow" ? data.snowBandHigh : variable.key === "sst" ? data.sstBandHigh : null;
          return (
            <ClimateChart
              key={variable.kind}
              kind={variable.kind}
              months={toMonths(series, low, high)}
              context={countryName}
              compact
            />
          );
        })}
      </div>
    </div>
  );
}

function toMonths(values: Monthly, low?: Monthly | null, high?: Monthly | null): MonthDatum[] {
  // Both edges or neither, as the pipeline publishes them.
  const band = low && high ? { low, high } : null;
  return values.map((value, i) => ({
    month: i,
    value,
    p5: band?.low[i],
    p95: band?.high[i],
  }));
}

/**
 * A named, empty slot. No chart, because there is no data to draw and drawing
 * a plausible-looking one would be a lie with a paywall on it.
 */
function PremiumTeaser({
  kind,
  title,
  countryName,
}: {
  kind: ClimateChartKind;
  title: string;
  countryName: string;
}) {
  return (
    <SameSizeAs kind={kind}>
      <div className="flex h-full flex-col justify-between rounded-md border border-dashed border-border bg-surface p-4">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-text-muted">
            Premium
          </div>
          <div className="mt-1 font-display text-[18px] font-medium text-text">{title}</div>
        </div>
        <p className="text-[12px] leading-snug text-text-muted">
          {title} for {countryName} is part of the Premium map and its
          district-level detail.{" "}
          {/*
            Underlined always, not just on hover. Axe (WCAG 1.4.1) flags this
            one: the link colour against the muted body text around it is 1.1:1,
            well under the 3:1 that lets colour alone mark a link. Underlining is
            the fix that does not touch an Atlas colour token.
          */}
          <Link href="/pricing" className="text-text-link underline underline-offset-2">
            See what Premium includes
          </Link>
          .
        </p>
      </div>
    </SameSizeAs>
  );
}

/** A premium visitor, a variable this country has no series for (no coast). */
function NotPublished({
  kind,
  title,
  countryName,
}: {
  kind: ClimateChartKind;
  title: string;
  countryName: string;
}) {
  return (
    <SameSizeAs kind={kind}>
      <div className="flex h-full flex-col justify-between rounded-md border border-border bg-surface p-4">
        <div className="font-display text-[18px] font-medium text-text">{title}</div>
        <p className="text-[12px] leading-snug text-text-muted">
          No {title.toLowerCase()} series is published for {countryName}.
        </p>
      </div>
    </SameSizeAs>
  );
}

const FLAT: MonthDatum[] = Array.from({ length: 12 }, (_, month) => ({ month, value: 0 }));
/** With an envelope, for the two kinds that carry one: its legend row has height too. */
const FLAT_BANDED: MonthDatum[] = FLAT.map((d) => ({ ...d, p5: 0, p95: 0 }));

/**
 * Sizes a card exactly like the chart that may replace it.
 *
 * The chart's height follows its column's width (the SVG keeps its aspect),
 * so no fixed `min-h` matches it at every breakpoint — and a premium reader's
 * page would jump when the teaser became a chart. Stacking the card on an
 * invisible chart in one grid cell makes the cell the chart's size at any
 * width. The hidden chart is a flat line at zero: no premium number, and
 * `aria-hidden` plus `invisible` keep it out of the accessibility tree.
 */
function SameSizeAs({ kind, children }: { kind: ClimateChartKind; children: ReactNode }) {
  return (
    <div className="grid [&>*]:col-start-1 [&>*]:row-start-1">
      <div className="invisible" aria-hidden="true">
        <ClimateChart kind={kind} months={kind === "snow" || kind === "sst" ? FLAT_BANDED : FLAT} compact />
      </div>
      {children}
    </div>
  );
}
