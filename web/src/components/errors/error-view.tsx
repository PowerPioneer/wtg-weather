"use client";

import { useEffect } from "react";
import Link from "next/link";

import { GLITCHTIP_DSN_CLIENT } from "@/lib/env";

/**
 * The shared error-boundary body.
 *
 * A client component, and unavoidably so: Next.js's `error.tsx` convention
 * requires one — the boundary has to catch on the client and hold the `reset`
 * callback. That is the framework's design and not a violation of the zero-JS
 * rule, which governs the pages crawlers and no-JS visitors read. A page that
 * has already thrown is neither.
 *
 * It reports to GlitchTip explicitly. A React error boundary *catches* the
 * error, which means the browser's `onerror` never fires and the global
 * handler `GlitchTipClient` installs never sees it — the errors that break a
 * page for a real visitor would have been the ones we heard least about.
 */
export function ErrorView({
  error,
  reset,
  heading = "Something went wrong on our side",
  message = "This page failed to render. The failure has been reported. Trying again often works — the usual cause is a service that was briefly unavailable.",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  heading?: string;
  message?: string;
}) {
  useEffect(() => {
    if (!GLITCHTIP_DSN_CLIENT) return;
    let cancelled = false;
    import("@sentry/browser")
      .then((Sentry) => {
        if (cancelled) return;
        // `digest` is the only handle on a server-side error: Next replaces
        // the real message with it in production, and it is what ties this
        // report to the one the server logged.
        Sentry.captureException(error, {
          tags: { boundary: "app-error", digest: error.digest ?? "none" },
        });
      })
      .catch(() => {
        /* reporting must never make a broken page worse */
      });
    return () => {
      cancelled = true;
    };
  }, [error]);

  return (
    <main className="flex-1">
      <section className="border-b border-border bg-surface">
        <div className="mx-auto w-full max-w-[1280px] px-6 py-20 md:px-12 md:py-28">
          <div className="max-w-[680px]">
            <div className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-text-muted">
              Error
            </div>
            <h1 className="mt-3 font-display text-[40px] font-medium leading-[1.1] tracking-[-0.01em] text-text md:text-[52px]">
              {heading}
            </h1>
            <p className="mt-5 text-[17px] leading-[1.6] text-text-muted">{message}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-md bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground hover:bg-primary-hover"
              >
                Try again
              </button>
              <Link
                href="/map"
                className="rounded-md border border-border bg-surface px-5 py-2.5 text-[14px] font-medium text-text hover:bg-surface-2"
              >
                Open the map
              </Link>
              <Link
                href="/"
                className="rounded-md border border-border bg-surface px-5 py-2.5 text-[14px] font-medium text-text hover:bg-surface-2"
              >
                Browse countries
              </Link>
            </div>

            {error.digest && (
              <p className="mt-8 font-mono text-[11.5px] text-text-subtle">
                Reference: {error.digest} — quote this if you{" "}
                <Link href="/contact" className="underline underline-offset-2">
                  get in touch
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
