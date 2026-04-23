import type { ReactNode } from "react";

/**
 * Standardised section header — eyebrow + serif title + optional subhead +
 * optional right-aligned action slot. Every account/agency/client tab uses
 * this so a single visual rhythm cascades across the dashboard.
 */
export function SectionHead({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-6 border-b border-border pb-4">
      <div>
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
          {eyebrow}
        </div>
        <h2 className="mt-1.5 font-display text-[28px] font-normal tracking-[-0.012em] text-text md:text-[30px]">
          {title}
        </h2>
        {sub && <div className="mt-1.5 text-[13px] text-text-muted">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  primary,
  primaryHref,
  secondary,
  secondaryHref,
}: {
  title: string;
  body: string;
  primary?: string;
  primaryHref?: string;
  secondary?: string;
  secondaryHref?: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-border-strong bg-[#FCFBF8] px-8 py-14 text-center">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-text-muted">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" />
          <path d="M3 7l9 4 9-4M12 11v10" />
        </svg>
      </div>
      <div className="font-display text-[22px] font-medium tracking-[-0.005em] text-text">
        {title}
      </div>
      <div className="mx-auto mt-2 max-w-[440px] text-[13.5px] leading-[1.55] text-text-muted">
        {body}
      </div>
      {(primary || secondary) && (
        <div className="mt-5 inline-flex gap-2">
          {primary && primaryHref && (
            <a
              href={primaryHref}
              className="rounded-sm bg-primary px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              {primary}
            </a>
          )}
          {secondary && secondaryHref && (
            <a
              href={secondaryHref}
              className="rounded-sm border border-border px-3.5 py-2 text-[12.5px] font-medium text-text hover:bg-surface-2"
            >
              {secondary}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
