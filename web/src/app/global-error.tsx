"use client";

import { ErrorView } from "@/components/errors";
import { PageFooter, PageHeader } from "@/components/layout";

import "./globals.css";

/**
 * The outermost error boundary: it catches what `error.tsx` cannot, namely a
 * failure in the root layout itself. It replaces that layout entirely — hence
 * its own `<html>`, `<body>` and stylesheet import, and the explicit chrome.
 *
 * ── What none of these boundaries covers ─────────────────────────────────
 *
 * Measured against `next start`, not assumed. A country page made to throw in
 * its RSC render answered `500 Internal Server Error` with a twenty-one byte
 * plain-text body: the segment `error.tsx` was never invoked, and neither was
 * this file. React can only swap in an error boundary's UI if the shell has
 * already flushed, and these pages have no Suspense boundary inside them, so
 * the whole document is the shell and there is nothing to stream a
 * replacement into.
 *
 * That matters because it is the shape a real outage takes here: `getCountry`
 * throws on any non-404 answer, so an unmounted data bundle or an API that is
 * down fails on the *first* render of every country page, for visitors
 * arriving cold from search — exactly the case that reaches a bare 500.
 *
 * These boundaries are still worth having: they cover a failed client-side
 * navigation (the visitor already on the site who clicks into a country whose
 * fetch then fails) and a root-layout failure. But a styled first-render 500
 * is not something the app can deliver, and pretending otherwise would leave
 * the ugliest failure unowned. The fix belongs one layer out — a Caddy
 * `handle_errors` block serving a static styled 500 — and is noted for WS-G.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <PageHeader />
        <ErrorView
          error={error}
          reset={reset}
          heading="Something went wrong on our side"
          message="This page didn't render. The failure has been reported. It is usually a service that was briefly unavailable, so trying again often works."
        />
        <PageFooter />
      </body>
    </html>
  );
}
