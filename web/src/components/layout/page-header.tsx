import Link from "next/link";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string };

const NAV: readonly NavItem[] = [
  { href: "/map", label: "Map" },
  { href: "/", label: "Countries" },
  { href: "/pricing", label: "Pricing" },
];

/**
 * Site navigation bar. Server component — no client JS. The "current" page
 * is highlighted by matching the `activePath` prop that each route layout
 * passes in. Zero interactivity beyond the browser's default link behaviour.
 */
export function PageHeader({ activePath }: { activePath?: string } = {}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center justify-between px-6 md:px-12">
        <Link href="/" className="flex items-center gap-3.5 text-text">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md bg-primary"
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
          <span className="text-[15px] font-semibold tracking-[-0.005em]">
            Where to Go for Great Weather
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-[13px] text-text-muted">
          {NAV.map((item) => {
            const active = activePath === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "hover:text-text",
                  active && "font-medium text-text",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/login"
            className="rounded-md border border-border px-3 py-1.5 text-text hover:bg-surface-2"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
