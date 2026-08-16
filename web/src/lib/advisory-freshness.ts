import type { AdvisorySummary } from "@/lib/types";

/**
 * Past this many days with no government re-read, the combined advisory badge
 * is drawn neutral instead of at its level colour.
 *
 * `web/design/HANDOFF.md` § Risks: "Stale data (>14d) should downgrade the
 * badge to `--color-border-strong` neutral." The scrape is weekly, so 14 days
 * is one missed run — early enough to be a real signal, late enough that a
 * single failed Sunday does not grey out every country on the site.
 */
export const ADVISORY_STALE_AFTER_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export type AdvisoryFreshness = {
  /**
   * True only when the payload positively says the data is old: every source
   * carries a `checked` date and the newest is past the threshold. A payload
   * that carries no `checked` at all is *unknown*, not stale — the honest
   * reading of a bundle published before the field existed.
   */
  stale: boolean;
  /** The newest `checked` date across sources, when any source has one. */
  lastChecked?: string;
  /** Whole days since `lastChecked`. */
  ageDays?: number;
};

/**
 * How fresh a country's advisory data is, judged from the payload itself.
 *
 * Deliberately reads `checked` (when we last read the government) and not
 * `date` / `lastUpdated` (when the government last moved). Most countries'
 * advisories sit unchanged for years — a rule built on `date` would paint
 * every quiet country stale and say nothing at all about a dead scraper,
 * which is the exact failure this is meant to surface.
 *
 * `now` is injected so the rule is testable, and because the caller is a
 * statically generated page: the answer is baked into the HTML at render
 * time and refreshes when the page's ISR window turns over, so treat it as
 * "was stale when this page was built", which is the strongest claim a
 * pre-rendered page can make.
 */
export function advisoryFreshness(
  advisories: Pick<AdvisorySummary, "sources"> | undefined,
  now: Date = new Date(),
): AdvisoryFreshness {
  const checked = (advisories?.sources ?? [])
    .map((source) => parseChecked(source.checked))
    .filter((value): value is { iso: string; time: number } => value !== null);

  if (checked.length === 0) return { stale: false };

  const newest = checked.reduce((a, b) => (b.time > a.time ? b : a));
  const ageDays = Math.floor((now.getTime() - newest.time) / MS_PER_DAY);

  return {
    stale: ageDays > ADVISORY_STALE_AFTER_DAYS,
    lastChecked: newest.iso,
    // A clock skewed behind the publish date reads as a negative age; report
    // it as zero rather than as a future check, and never as stale.
    ageDays: Math.max(ageDays, 0),
  };
}

function parseChecked(value: string | undefined): { iso: string; time: number } | null {
  if (!value) return null;
  // The bundle publishes date-only strings. `new Date("2026-08-14")` is UTC
  // midnight but `new Date("2026-08-14T00:00:00")` is *local* midnight, so the
  // suffix is spelled out rather than left to the runtime's parsing rules —
  // a server in UTC+13 would otherwise read a day older than it should.
  const time = Date.parse(DATE_ONLY.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isNaN(time) ? null : { iso: value, time };
}
