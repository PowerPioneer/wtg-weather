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
        <SafetyBadge level={combined} size="lg" showLabel={false} />
        <div className="flex-1">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Combined advisory · most-cautious-wins
          </div>
          <div className="mt-1 font-display text-[20px] font-medium leading-tight text-text">
            {combinedLabel}
          </div>
          <div className="mt-1 font-mono text-[11.5px] text-text-muted">
            Highest level across {sources.length} government
            {sources.length === 1 ? "" : "s"} · Updated{" "}
            <time dateTime={lastUpdated}>{lastUpdated}</time>
          </div>
        </div>
      </div>

      <details open={defaultOpen} className="group mt-4">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-accent focus-visible:outline-focus-ring [&::-webkit-details-marker]:hidden">
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
                <time dateTime={s.updated}>{s.updated}</time>
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
