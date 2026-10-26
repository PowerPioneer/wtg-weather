import Link from "next/link";

import { cn } from "@/lib/cn";
import { MONTH_NAMES, MONTH_SHORT, MONTH_SLUGS } from "@/lib/months";
import { regionHref } from "@/lib/regions";
import { BUCKET_SCORES, SCORE_BG_CLASS, scoreBin, scoreLabel } from "@/lib/scoring";
import type { CountryData, RegionRow } from "@/lib/types";

/** Best first, as the legend reads. */
const LEGEND = [...BUCKET_SCORES].reverse();

/**
 * Region × month table: one row per admin-1 region, one cell per month,
 * coloured by the match word for that month.
 *
 * It replaced a grid of cards, each with a badge, a sparkline and a
 * temperature range. The badge was the region's *best* month, so in a tropical
 * country nearly every card said "Perfect" and the grid answered nothing; the
 * sparklines were eighteen small charts saying "it is warm". The question a
 * traveller brings to this section is where *and when*, and a row of twelve
 * cells answers it at a glance.
 *
 * No numerals anywhere (see `score-badge.tsx`): a cell is a colour, and its
 * word is in the legend, the cell's title and its screen-reader text. A plain
 * `<table>` with row and column headers, so it reads correctly with scripting
 * off and to a screen reader walking the grid.
 */
export function RegionMonthTable({
  country,
  currentMonthIdx,
}: {
  country: CountryData;
  /** 0–11 — highlights that column and points the row links at that month. */
  currentMonthIdx?: number;
}) {
  if (country.regions.length === 0) {
    return (
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[1280px] px-6 py-12 md:px-12">
          <div className="rounded-md border border-dashed border-border bg-background p-6 text-[13px] text-text-muted">
            Regional climatology for {country.name} is not yet available.
          </div>
        </div>
      </section>
    );
  }

  const regions = country.regions;
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
        <div className="mb-6 flex flex-col gap-4">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              {regions.length} regions · month by month
            </div>
            <h2 className="mt-1 font-display text-[28px] font-medium leading-[1.2] text-text">
              {country.name}, taken apart
            </h2>
            <p className="mt-2 max-w-[560px] text-[14px] leading-[1.5] text-text-muted">
              How each region matches the default preferences in every month.
              Pick a region for its own climate page.
            </p>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Legend">
            {LEGEND.map((score) => (
              <li key={score} className="flex items-center gap-1.5">
                <span
                  className={cn("h-3 w-3 rounded-[3px]", SCORE_BG_CLASS[scoreBin(score)])}
                  aria-hidden="true"
                />
                <span className="font-mono text-[11px] text-text">{scoreLabel(score)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] table-fixed border-separate border-spacing-0">
            <caption className="sr-only">
              Match by region and month for {country.name}
            </caption>
            <colgroup>
              <col className="w-[38%] sm:w-[30%] lg:w-[22%]" />
              {MONTH_SLUGS.map((slug) => (
                <col key={slug} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="sr-only">
                  Region
                </th>
                {MONTH_SLUGS.map((slug, i) => (
                  <th
                    key={slug}
                    scope="col"
                    className={cn(
                      "pb-2 text-center font-mono text-[10.5px] font-normal uppercase tracking-[0.08em] text-text-muted",
                      i === currentMonthIdx && "font-semibold text-text",
                    )}
                  >
                    <abbr title={MONTH_NAMES[slug]} className="no-underline">
                      <span className="sm:hidden">{MONTH_SHORT[slug].charAt(0)}</span>
                      <span className="hidden sm:inline">{MONTH_SHORT[slug]}</span>
                    </abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regions.map((region) => (
                <RegionRowCells
                  key={region.slug ?? region.name}
                  countrySlug={country.slug}
                  region={region}
                  currentMonthIdx={currentMonthIdx}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function RegionRowCells({
  countrySlug,
  region,
  currentMonthIdx,
}: {
  countrySlug: string;
  region: RegionRow;
  currentMonthIdx?: number;
}) {
  const slug = regionHref(region);
  const href =
    currentMonthIdx != null
      ? `/${countrySlug}/${slug}/${MONTH_SLUGS[currentMonthIdx]}`
      : `/${countrySlug}/${slug}`;
  return (
    <tr className="group">
      <th
        scope="row"
        className="border-t border-border py-1.5 pr-3 text-left align-middle font-normal"
      >
        <Link
          href={href}
          className="text-[13px] font-medium text-text underline-offset-2 group-hover:underline"
        >
          {region.name}
        </Link>
        {region.advisory ? (
          <span className="block font-mono text-[10.5px] text-text-muted">
            Advisory in parts: {region.advisory.label}
          </span>
        ) : null}
      </th>
      {MONTH_SLUGS.map((monthSlug, i) => {
        const score = region.scores?.[i];
        const label = score == null ? "No data" : scoreLabel(score);
        return (
          <td
            key={monthSlug}
            className={cn(
              "border-t border-border px-px py-1.5 align-middle sm:px-0.5",
              i === currentMonthIdx && "bg-surface-2",
            )}
          >
            <span
              className={cn(
                "block h-4 rounded-[3px]",
                score == null ? "bg-surface-2" : SCORE_BG_CLASS[scoreBin(score)],
              )}
              title={`${region.name}, ${MONTH_NAMES[monthSlug]}: ${label}`}
            >
              <span className="sr-only">{label}</span>
            </span>
          </td>
        );
      })}
    </tr>
  );
}
