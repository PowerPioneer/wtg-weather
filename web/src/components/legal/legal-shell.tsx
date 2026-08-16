import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Shared chrome for the four legal / support pages (`/privacy`, `/terms`,
 * `/refunds`, `/contact`).
 *
 * Server components throughout — these are the pages Paddle's checkout links
 * to and the ones a regulator reads, so they must render with JavaScript
 * disabled. The only interactivity is anchor links, which is the browser's.
 *
 * The pages share a shell rather than a stylesheet because the four are read
 * as a set: a refund clause in `/terms` that looks different from the same
 * clause in `/refunds` invites the question of which one governs.
 */

/** Every page in the set, in the order the footer and the cross-links list them. */
export const LEGAL_PAGES: readonly { href: string; label: string }[] = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refunds", label: "Refund Policy" },
  { href: "/contact", label: "Contact & Support" },
];

export type TocEntry = { id: string; label: string };

export function LegalPage({
  title,
  intro,
  updated,
  toc,
  children,
}: {
  title: string;
  intro: string;
  /** Human-readable "last reviewed" line. Not a legal effective date — see {@link DraftNotice}. */
  updated: string;
  toc: readonly TocEntry[];
  children: ReactNode;
}) {
  return (
    <main className="flex-1">
      <section className="border-b border-border bg-surface">
        <div className="mx-auto w-full max-w-[1280px] px-6 py-14 md:px-12 md:py-16">
          <div className="max-w-[760px]">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              Legal
            </div>
            <h1 className="mt-2 font-display text-[44px] font-medium leading-[1.08] tracking-[-0.01em] text-text md:text-[56px]">
              {title}
            </h1>
            <p className="mt-5 text-[17px] leading-[1.6] text-text-muted">{intro}</p>
            <p className="mt-4 font-mono text-[11.5px] text-text-subtle">
              Last reviewed {updated}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
        <DraftNotice />
        <div className="mt-10 gap-12 md:flex md:items-start">
          <nav
            aria-label="On this page"
            className="mb-10 shrink-0 md:sticky md:top-20 md:mb-0 md:w-[220px]"
          >
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              On this page
            </div>
            <ul className="mt-3 space-y-1.5">
              {toc.map((entry) => (
                <li key={entry.id}>
                  <a
                    href={`#${entry.id}`}
                    className="text-[13px] leading-[1.45] text-text-muted hover:text-text"
                  >
                    {entry.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-border pt-4">
              <ul className="space-y-1.5">
                {LEGAL_PAGES.map((page) => (
                  <li key={page.href}>
                    <Link
                      href={page.href}
                      className="text-[13px] leading-[1.45] text-text-muted hover:text-text"
                    >
                      {page.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
          <div className="min-w-0 max-w-[760px] flex-1">{children}</div>
        </div>
      </div>
    </main>
  );
}

export function LegalSection({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-border pt-8 first:border-t-0 first:pt-0 [&+section]:mt-10">
      <h2 className="font-display text-[26px] font-medium leading-[1.2] text-text">
        {heading}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-[14.5px] leading-[1.65] text-text-muted">{children}</p>;
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="pt-2 text-[15px] font-semibold leading-[1.4] text-text">{children}</h3>
  );
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="ml-5 list-disc space-y-2 text-[14.5px] leading-[1.65] text-text-muted marker:text-border-strong">
      {children}
    </ul>
  );
}

/** A definition-style table. Used for the cookie inventory and the processor list. */
export function LegalTable({
  columns,
  rows,
  caption,
}: {
  columns: readonly string[];
  rows: readonly (readonly ReactNode[])[];
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="bg-surface-2">
            {columns.map((c) => (
              <th
                key={c}
                scope="col"
                className="border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="bg-surface [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={
                    "px-4 py-3 align-top leading-[1.5] " +
                    (j === 0 ? "font-mono text-[12px] text-text" : "text-text-muted")
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A fact the repository cannot supply.
 *
 * Registered entity, address, governing law and the contact addresses are
 * decisions, not code — inventing one and setting it in a page that Paddle
 * links to from checkout would be asserting something untrue about who the
 * counterparty is. Each one renders visibly, in the flow of the sentence it
 * belongs to, so the gaps are impossible to miss on the rendered page rather
 * than only in the source.
 *
 * Grep for `OwnerPlaceholder` — or for the literal `[OWNER:` in the rendered
 * HTML — to enumerate what is still outstanding before cutover.
 */
export function OwnerPlaceholder({ children }: { children: string }) {
  return (
    <mark className="rounded-sm bg-accent-subtle px-1 py-0.5 font-mono text-[12.5px] font-medium text-text">
      [OWNER: {children}]
    </mark>
  );
}

/**
 * Ships on every page in the set until the owner signs them off.
 *
 * These drafts are grounded in what the software actually does — every
 * processor, cookie and data flow named in them was read out of this
 * repository — but "accurate about the system" is not the same as "reviewed
 * as a binding contract", and only one of those is the owner's to assert.
 * `robots.txt` disallows everything until cutover (WS-G), so nothing here is
 * indexed while the notice stands.
 *
 * Removing it is a deliberate act: delete this component and its four call
 * sites, fill every {@link OwnerPlaceholder}, and set real effective dates.
 */
export function DraftNotice() {
  return (
    <aside
      role="note"
      className="rounded-md border border-border-strong bg-accent-subtle px-5 py-4"
    >
      <div className="text-[13px] font-semibold text-text">
        Draft — pending owner review. Not yet in force.
      </div>
      <p className="mt-1.5 max-w-[760px] text-[13px] leading-[1.55] text-text-muted">
        This document describes what the service actually does, but it has not
        been reviewed or approved as a binding legal document. Highlighted{" "}
        <span className="font-mono text-[12px]">[OWNER: …]</span> items are
        facts only the operator can supply. Do not rely on it, and do not take
        the site live for paid customers, until it has been completed and
        approved.
      </p>
    </aside>
  );
}
