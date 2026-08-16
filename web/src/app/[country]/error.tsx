"use client";

import { ErrorView } from "@/components/errors";
import { PageFooter, PageHeader } from "@/components/layout";

/**
 * Error boundary for the country segment.
 *
 * These pages are the SEO surface and they are the ones with a live
 * dependency: `getCountry` throws on any non-404 answer from the API, so a
 * mount that has gone missing or an API that is down shows up here rather than
 * as a blank page. The wording says so — the visitor has not mistyped
 * anything, and coming back later genuinely is the fix.
 */
export default function CountryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <PageHeader />
      <ErrorView
        error={error}
        reset={reset}
        heading="We couldn't load this country"
        message="The climate data for this page didn't come back. Nothing is wrong with the address you followed — this is our side, it has been reported, and it is usually brief."
      />
      <PageFooter />
    </>
  );
}
