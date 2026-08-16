"use client";

import { ErrorView } from "@/components/errors";
import { PageFooter, PageHeader } from "@/components/layout";

/**
 * Site-wide error boundary. Client component by Next.js's design — it holds
 * `reset` and catches on the client.
 *
 * It renders the site chrome itself because an error boundary replaces the
 * page, not the layout above it: without the header and footer a broken
 * country page would be a headline floating on an empty document, with no way
 * out except the back button.
 */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <PageHeader />
      <ErrorView error={error} reset={reset} />
      <PageFooter />
    </>
  );
}
