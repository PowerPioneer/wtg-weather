import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Minimal chrome shared by `/login` and `/login/sent`. The design brief calls
 * for a stripped-back wordmark + a footer with the usual legal links. The map
 * `PageHeader` is deliberately not reused — auth screens want the navigation
 * chrome to fade, not compete.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-6 md:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-text">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md bg-primary"
            aria-hidden
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
          <span className="flex flex-col leading-none">
            <span className="font-display text-[15px] font-medium tracking-[-0.005em]">
              Atlas Weather
            </span>
            <span className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-subtle">
              wheretogoforgreatweather
            </span>
          </span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 md:px-8">
        {children}
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-6 py-5 font-mono text-[11px] text-text-subtle md:px-8">
        <div>© 2026 Atlas Weather · v2.0</div>
        <nav className="flex gap-5">
          <Link href="/privacy" className="text-text-muted hover:text-text">
            Privacy
          </Link>
          <Link href="/terms" className="text-text-muted hover:text-text">
            Terms
          </Link>
          <Link href="/status" className="text-text-muted hover:text-text">
            Status
          </Link>
        </nav>
      </footer>
    </div>
  );
}
