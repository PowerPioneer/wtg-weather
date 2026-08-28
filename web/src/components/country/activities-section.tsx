import {
  STATUS_CLASS,
  STATUS_LABEL,
  STATUS_ORDER,
  formatMonthRun,
  itemById,
  lastChecked,
  monthKey,
  rowsForMonth,
  yearShape,
} from "@/lib/activities";
import type { ActivityBlock, ActivityItem, ActivityStatus, CountryData } from "@/lib/types";

/**
 * "What's actually open" — the curated activity block.
 *
 * The house voice for this section is a hybrid: one lede sentence whose shape
 * a person chose, over rows a machine assembled. Both halves come out of the
 * pipeline already written (`processing/activities.py`), from data that
 * carries a citation per item. This component decides layout and nothing else;
 * it never phrases a claim about a place, because a phrase invented here would
 * be a phrase with no source.
 *
 * Three callers, one component:
 *
 * * the country page passes no `monthIdx` and gets the year view — each thing
 *   with its calendar;
 * * a month page passes `monthIdx` and gets that month's statuses;
 * * a region page passes `only` as well, narrowing to the activities that
 *   genuinely name that subdivision.
 *
 * Renders nothing at all when the country is uncurated. Coverage is tiered on
 * purpose and a "no data" placeholder reads as a bug, where an absent section
 * reads as a page about something else.
 *
 * Zero client JS: this is an SEO surface and must stand up with scripting off.
 */
export function ActivitiesSection({
  country,
  monthIdx,
  monthName,
  only,
  heading,
}: {
  country: CountryData;
  /** 0-11. Omit for the country-page year view. */
  monthIdx?: number;
  monthName?: string;
  /** Activity ids to narrow to — the region page's own list. */
  only?: readonly string[];
  heading?: string;
}) {
  const block = country.activities;
  if (!block || block.items.length === 0) return null;

  const scoped =
    only === undefined
      ? block.items
      : block.items.filter((i) => only.includes(i.id));
  if (scoped.length === 0) return null;

  const isMonthView = monthIdx !== undefined;
  const monthRows = isMonthView
    ? rowsForMonth(block, monthIdx, only?.length ? only : undefined)
    : [];
  // A month can legitimately have no rows even though the country has
  // activities — a region whose only entry is a festival, viewed in another
  // month. An empty list under a heading reads as a failure to load.
  if (isMonthView && monthRows.length === 0) return null;

  /*
    Both ledes are generated over the *country's* activities, and every branch
    of them is a count of those rows — "February is the only month Peru closes
    anything — 1 thing below". Printed above a region-scoped list that does not
    contain the closure, the sentence would be describing a different page.
    Arequipa in February would announce a closure and then list an open canyon.

    So a scoped view drops the lede rather than restating it. The heading names
    the region, the status pills carry the same information, and nothing on the
    page claims a count it is not showing. Generating a lede per region is the
    alternative and it costs ~55,000 sentences in the payload to phrase what
    four pills already say.
  */
  const scopedView = only !== undefined;
  const lede = scopedView
    ? ""
    : isMonthView
      ? (block.months[monthKey(monthIdx)]?.lede ?? "")
      : block.lede;

  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
        <div className="mb-6">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            What&rsquo;s open{isMonthView && monthName ? ` · ${monthName}` : " · year round"}
          </div>
          <h2 className="mt-1 font-display text-[28px] font-medium leading-[1.2] text-text">
            {heading ??
              (isMonthView && monthName
                ? `Things to do in ${country.name} in ${monthName}`
                : `Things to do in ${country.name}`)}
          </h2>
          {/*
            The lede. Every branch of the sentence that produced it is driven
            by a count taken from the rows below, so it cannot drift from them.
          */}
          {lede && (
            <p className="mt-3 max-w-[680px] font-display text-[17px] leading-[1.5] text-text">
              {lede}
            </p>
          )}
        </div>

        <ul className="grid gap-3">
          {isMonthView
            ? rowsForMonth(block, monthIdx, only?.length ? only : undefined).map((row) => {
                const item = itemById(block, row.id);
                if (!item) return null;
                return (
                  <ActivityRow
                    key={row.id}
                    item={item}
                    status={row.status}
                    detail={row.reason}
                  />
                );
              })
            : scoped
                .map((item) => ({ item, ...yearHeadline(block, item) }))
                /*
                  Sorted on the *year* status, not the item's default one. The
                  pipeline orders `items` by the status a thing carries in a
                  typical month, which puts a year-round-open sight above a
                  sight that is unusable for five months of it. Here the worst
                  thing the year contains belongs at the top.
                */
                .sort(
                  (a, b) =>
                    STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
                    a.item.name.localeCompare(b.item.name),
                )
                .map(({ item, status, detail }) => (
                  <ActivityRow key={item.id} item={item} status={status} detail={detail} />
                ))}
        </ul>

        <p className="mt-6 max-w-[680px] font-mono text-[11.5px] leading-[1.6] text-text-subtle">
          Opening seasons are checked by hand against the operators and parks
          themselves, not derived from the climate figures on this page. Last
          reviewed {lastChecked(block)}. Dates move — confirm before you book.
        </p>
      </div>
    </section>
  );
}

/**
 * The status and one-line calendar an item gets in the year view.
 *
 * Picks the worst status the year contains, because that is the one a reader
 * planning around needs to see; the calendar line then says when. An item with
 * one status all year gets "All year" and no month list.
 */
function yearHeadline(
  block: ActivityBlock,
  item: ActivityItem,
): { status: ActivityStatus; detail: string } {
  const shape = yearShape(block, item.id);
  if (shape.length === 0) return { status: "open", detail: "" };

  // Dated events say when they are on rather than what they are not.
  if (item.datedEvent) {
    return {
      status: shape[0].status,
      detail: `On in ${formatMonthRun(item.onMonths)}`,
    };
  }

  /*
    Name only the months that are exceptional. "Open March–April,
    October–January" is the remainder of the two clauses before it — it adds a
    third phrase to a line and no information, and it is the phrase a reader
    skims past on the way to the closure. A thing that is open all year has no
    other clause, so it keeps its one.
  */
  const notable = shape.filter((s) => s.status !== "open");
  const spoken = notable.length > 0 ? notable : shape;

  const parts = spoken.map(({ status, months }) =>
    months.length === 12
      ? `${STATUS_LABEL[status].toLowerCase()} all year`
      : `${STATUS_LABEL[status].toLowerCase()} ${formatMonthRun(months)}`,
  );
  return {
    status: shape[0].status,
    detail: parts.join(" · ").replace(/^./, (c) => c.toUpperCase()),
  };
}

function ActivityRow({
  item,
  status,
  detail,
}: {
  item: ActivityItem;
  status: ActivityStatus;
  detail: string;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4 sm:flex-row sm:items-start sm:gap-4">
      <span
        className={`inline-flex shrink-0 items-center self-start rounded-sm border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] ${STATUS_CLASS[status]}`}
      >
        {STATUS_LABEL[status]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-[16px] font-medium leading-[1.3] text-text">
          {item.name}
        </div>
        {detail && (
          <p className="mt-1 text-[14px] leading-[1.55] text-text-muted">{detail}</p>
        )}
        {item.sources.length > 0 && (
          <p className="mt-2 font-mono text-[11px] text-text-subtle">
            {/*
              The citation, in the markup rather than a tooltip: this is the
              part a reader uses to decide whether to believe the row, and a
              page with JS off must still carry it.
            */}
            Source
            {item.sources.length === 1 ? "" : "s"}:{" "}
            {item.sources.map((source, index) => (
              <span key={source.url}>
                {index > 0 && ", "}
                <a
                  href={source.url}
                  className="underline decoration-border underline-offset-2 hover:text-text"
                  rel="nofollow noopener noreferrer"
                  target="_blank"
                >
                  {hostOf(source.url)}
                </a>
              </span>
            ))}
          </p>
        )}
      </div>
    </li>
  );
}

/** `www.` stripped — the reader wants the publication, not the hostname. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
