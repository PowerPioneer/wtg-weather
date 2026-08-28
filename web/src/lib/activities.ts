import { MONTH_NAMES, MONTH_SHORT, MONTH_SLUGS } from "@/lib/months";
import type {
  ActivityBlock,
  ActivityItem,
  ActivityMonthRow,
  ActivityStatus,
} from "@/lib/types";

/**
 * Presentation helpers over the pipeline's curated activity block.
 *
 * The hard line: nothing here composes a *claim*. Statuses, reasons and both
 * ledes are generated in `processing/activities.py` from cited data, and this
 * module only rearranges what arrived — turning the twelve per-month rows the
 * payload carries into the calendar shape a year view wants. If a sentence
 * here asserted something about a place, it would be a sentence with no
 * source, which is the thing the whole dataset exists to prevent.
 */

/** The three-letter keys the payload uses for months — same as `monthNotes`. */
export const MONTH_KEYS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Worst first, matching the pipeline's own ordering. */
export const STATUS_ORDER: readonly ActivityStatus[] = [
  "closed",
  "limited",
  "best",
  "open",
];

export const STATUS_LABEL: Record<ActivityStatus, string> = {
  closed: "Closed",
  limited: "Limited",
  best: "At its best",
  open: "Open",
};

/**
 * Colour is spent only on what is news. "Open" is the baseline and stays
 * neutral, so a page of open things does not read as a page of alerts and the
 * one closure keeps its weight.
 */
export const STATUS_CLASS: Record<ActivityStatus, string> = {
  closed: "border-score-avoid/30 bg-score-avoid-subtle text-score-avoid",
  limited: "border-score-acceptable/30 bg-score-acceptable-subtle text-score-acceptable-text",
  best: "border-score-perfect/30 bg-score-perfect-subtle text-score-perfect",
  open: "border-border bg-surface-2 text-text-muted",
};

export function monthKey(monthIdx: number): string {
  return MONTH_KEYS[monthIdx] ?? MONTH_KEYS[0];
}

/** The item behind a month row, or `undefined` for a payload that disagrees with itself. */
export function itemById(
  block: ActivityBlock,
  id: string,
): ActivityItem | undefined {
  return block.items.find((i) => i.id === id);
}

/**
 * `[{status, months}]` for one activity across the whole year.
 *
 * Read back out of `block.months` rather than from the windows, because the
 * months map is what the month pages render — deriving the year view from the
 * same source is what stops the two disagreeing.
 */
export function yearShape(
  block: ActivityBlock,
  id: string,
): { status: ActivityStatus; months: number[] }[] {
  const byStatus = new Map<ActivityStatus, number[]>();
  MONTH_KEYS.forEach((key, index) => {
    const row = block.months[key]?.rows.find((r) => r.id === id);
    if (!row) return; // a dated event outside its months is listed nowhere
    const months = byStatus.get(row.status) ?? [];
    months.push(index + 1);
    byStatus.set(row.status, months);
  });
  return STATUS_ORDER.filter((s) => byStatus.has(s)).map((status) => ({
    status,
    months: byStatus.get(status) ?? [],
  }));
}

/**
 * "February", "May–September", "November–March" — contiguous runs, wrapping
 * across the year boundary.
 *
 * The wrap matters: a southern-hemisphere dry season written as
 * "January, February, March, November, December" is the same fact as
 * "November–March" and reads as four separate ones.
 */
export function formatMonthRun(months: readonly number[], long = true): string {
  const present = new Set(months);
  if (present.size === 0) return "";
  if (present.size === 12) return "all year";

  const name = (m: number) =>
    long ? MONTH_NAMES[MONTH_SLUGS[m - 1]] : MONTH_SHORT[MONTH_SLUGS[m - 1]];

  // Start at a month whose predecessor is absent, so a run that wraps is
  // walked as one run rather than split at January.
  let start = 1;
  for (let m = 1; m <= 12; m += 1) {
    const previous = m === 1 ? 12 : m - 1;
    if (present.has(m) && !present.has(previous)) {
      start = m;
      break;
    }
  }

  const runs: number[][] = [];
  let current: number[] = [];
  for (let step = 0; step < 12; step += 1) {
    const m = ((start - 1 + step) % 12) + 1;
    if (present.has(m)) {
      current.push(m);
    } else if (current.length) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length) runs.push(current);

  return runs
    .map((run) =>
      run.length === 1
        ? name(run[0])
        : `${name(run[0])}–${name(run[run.length - 1])}`,
    )
    .join(", ");
}

/** The month rows for one month, optionally narrowed to a region's activities. */
export function rowsForMonth(
  block: ActivityBlock,
  monthIdx: number,
  only?: readonly string[],
): readonly ActivityMonthRow[] {
  const rows = block.months[monthKey(monthIdx)]?.rows ?? [];
  if (!only) return rows;
  const wanted = new Set(only);
  return rows.filter((r) => wanted.has(r.id));
}

/**
 * The most recent `checked` date across every source in the block — what a
 * "last reviewed" line should print.
 *
 * Falls back to `reviewed` because that is the date a human last read the
 * whole file, which is the honest answer when the sources have not moved.
 */
export function lastChecked(block: ActivityBlock): string {
  const dates = block.items
    .flatMap((i) => i.sources.map((s) => s.checked))
    .filter(Boolean)
    .sort();
  return dates[dates.length - 1] ?? block.reviewed;
}
