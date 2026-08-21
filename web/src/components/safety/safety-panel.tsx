import { cn } from "@/lib/cn";

import {
  ADVISORY_LABEL,
  SafetyBadge,
  type AdvisoryLevel,
} from "./safety-badge";

export type AdvisorySource = {
  /** Government code: "US", "UK", "CA", "AU", "DE". */
  gov: string;
  level: AdvisoryLevel;
  /** Short human summary (one line). */
  summary: string;
  /** ISO date the advisory was last issued/updated. */
  updated: string;
  /**
   * ISO date this government was last read by the scraper. Absent when the
   * published bundle predates the field. Rendered alongside `updated` because
   * the two answer different questions and a reader cannot judge the first
   * without the second: an advisory unchanged since 2019 is ordinary, a
   * government unchecked since 2019 is a broken pipeline.
   */
  checked?: string;
  /** Source URL for the advisory. */
  url: string;
};

export type SafetyPanelProps = {
  /** Most-cautious-wins combined level across all sources. */
  combined: AdvisoryLevel;
  sources: readonly AdvisorySource[];
  /** ISO date — latest of any source's `updated`. */
  lastUpdated: string;
  /**
   * The data says nobody has re-read these governments recently (every
   * source's `checked` is past the threshold — see `lib/advisory-freshness`).
   * Draws the combined badge neutral and says why, rather than presenting an
   * old snapshot in the same colours as a current one.
   */
  stale?: boolean;
  /** Newest `checked` across the sources, shown with the staleness notice. */
  lastChecked?: string;
  /**
   * If true, the per-government grid is rendered open. Defaults to false — the
   * panel uses a native `<details>` element so it works with JavaScript off.
   */
  defaultOpen?: boolean;
  className?: string;
};

/**
 * Combined-advisory summary with an expandable per-government grid.
 *
 * Uses a native `<details>` / `<summary>` to remain functional with JS
 * disabled — the SSR rule for every page. No client JS, no portals.
 */
export function SafetyPanel({
  combined,
  sources,
  lastUpdated,
  stale = false,
  lastChecked,
  defaultOpen = false,
  className,
}: SafetyPanelProps) {
  const combinedLabel = ADVISORY_LABEL[combined];

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-6",
        className,
      )}
    >
      <div className="flex items-start gap-5">
        <SafetyBadge level={combined} size="lg" showLabel={false} muted={stale} />
        <div className="flex-1">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Combined advisory · most-cautious-wins
          </div>
          <div className="mt-1 font-display text-[20px] font-medium leading-tight text-text">
            {combinedLabel}
          </div>
          <div className="mt-1 font-mono text-[11.5px] text-text-muted">
            Highest level across {sources.length} government
            {sources.length === 1 ? "" : "s"} · Advisory last changed{" "}
            <time dateTime={lastUpdated}>{lastUpdated}</time>
          </div>
          {stale ? (
            <p className="mt-2 max-w-[560px] border-l-2 border-border-strong pl-3 text-[12.5px] leading-snug text-text-muted">
              <span className="font-medium text-text">
                This advisory has not been refreshed recently.
              </span>{" "}
              {lastChecked ? (
                <>
                  Every government we track was last checked on{" "}
                  <time dateTime={lastChecked}>{lastChecked}</time>, so the
                  level above may be out of date.
                </>
              ) : (
                <>The level above may be out of date.</>
              )}{" "}
              Check the source links before you rely on it.
            </p>
          ) : null}
        </div>
      </div>

      <details open={defaultOpen} className="group mt-4">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-accent-text focus-visible:outline-focus-ring [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">See breakdown by country</span>
          <span className="hidden group-open:inline">Hide breakdown</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="transition-transform duration-fast ease-standard group-open:rotate-180"
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </summary>

        <div className="mt-4 grid grid-cols-1 gap-2.5 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-5">
          {sources.map((s) => (
            <article
              key={s.gov}
              className="rounded-md border border-border bg-surface-2/40 p-3"
            >
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">
                {s.gov}
              </div>
              <div className="mt-2">
                <SafetyBadge level={s.level} size="sm" showLabel />
              </div>
              <p className="mt-2 text-[12px] leading-snug text-text">
                {s.summary}
              </p>
              <div className="mt-3 border-t border-dashed border-border pt-2 font-mono text-[10.5px] text-text-subtle">
                <span className="block">
                  Changed <time dateTime={s.updated}>{s.updated}</time>
                </span>
                {s.checked ? (
                  <span className="block">
                    Checked <time dateTime={s.checked}>{s.checked}</time>
                  </span>
                ) : null}
                <a
                  href={s.url}
                  rel="nofollow noreferrer"
                  className="mt-1 block truncate text-text-link underline-offset-2 hover:underline"
                >
                  {displayUrl(s.url)}
                </a>
              </div>
            </article>
          ))}
        </div>
      </details>
    </div>
  );
}

function displayUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
