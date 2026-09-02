import Link from "next/link";
import { cn } from "@/lib/cn";

import { HeaderAccountLink } from "./header-account-link";

type NavItem = { href: string; label: string };

const NAV: readonly NavItem[] = [
  { href: "/map", label: "Map" },
  { href: "/", label: "Countries" },
  { href: "/pricing", label: "Pricing" },
];

/**
 * Site navigation bar. Server component — no client JS, on purpose.
 *
 * The mobile menu is a `<details>`/`<summary>` disclosure rather than a
 * state-driven React menu. It is the one pattern that keeps this a Server
 * Component and still works with JS disabled, which `web/CLAUDE.md` requires of
 * every SSR page, and the browser gives it keyboard operation and the right
 * expanded/collapsed semantics for free. The trade is that a tap outside the
 * menu does not close it; tapping the button again, or following any link in
 * it, does.
 *
 * The brand lockup was the actual bug here. At 375px the full name in a
 * fixed-height 56px bar laid out as a 90px-tall block starting 17px *above*
 * the header — it overflowed both edges. Below `sm` it now wraps to two tight
 * lines inside a width it is allowed to occupy, and the nav gets out of its
 * way.
 */
export function PageHeader({ activePath }: { activePath?: string } = {}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6 md:px-12">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 text-text sm:gap-3.5"
        >
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary"
            aria-hidden="true"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4" fill="#E0C98A" />
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="#E0C98A"
                strokeWidth="1.5"
                strokeDasharray="2 3"
              />
            </svg>
          </span>
          {/*
            Two lines of 13px leading-[1.15] is 30px — comfortably inside the
            56px bar — so the name survives on a phone instead of being
            truncated to something that is not the product's name.
          */}
          <span className="max-w-[10.5rem] text-[13px] font-semibold leading-[1.15] tracking-[-0.005em] sm:max-w-none sm:text-[15px] sm:leading-normal">
            Where to Go for Great Weather
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-[13px] text-text-muted md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "hover:text-text",
                activePath === item.href && "font-medium text-text",
              )}
            >
              {item.label}
            </Link>
          ))}
          {/*
            `min-w` is not decoration: the label swaps from "Sign in" to
            "Account" once the session resolves in the browser, and this is the
            last item in a flex row, so an unreserved width would shove every
            nav link sideways on load. Reserving the wider of the two labels
            keeps that inside the CLS < 0.05 budget.
          */}
          <HeaderAccountLink className="inline-flex min-w-[4.75rem] justify-center rounded-md border border-border px-3 py-1.5 text-text hover:bg-surface-2" />
        </nav>

        <details className="group relative shrink-0 md:hidden">
          <summary
            aria-label="Menu"
            className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md border border-border text-text outline-none transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)] [&::-webkit-details-marker]:hidden"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 12h16M4 17h16" className="group-open:hidden" />
              <path d="M6 6l12 12M18 6L6 18" className="hidden group-open:block" />
            </svg>
          </summary>
          <nav
            aria-label="Main"
            className="absolute right-0 top-[calc(100%+0.5rem)] z-50 flex w-56 flex-col rounded-md border border-border bg-surface p-1.5 shadow-lg"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-sm px-3 py-2.5 text-[14px] text-text-muted hover:bg-surface-2 hover:text-text",
                  activePath === item.href && "font-medium text-text",
                )}
              >
                {item.label}
              </Link>
            ))}
            <HeaderAccountLink className="mt-1 block rounded-sm border border-border px-3 py-2.5 text-center text-[14px] font-medium text-text hover:bg-surface-2" />
          </nav>
        </details>
      </div>
    </header>
  );
}
