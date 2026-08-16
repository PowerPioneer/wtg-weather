import { PageFooter, PageHeader } from "@/components/layout";

/**
 * Chrome for the legal / support set. A route group rather than a path segment
 * so the URLs stay `/privacy`, `/terms`, `/refunds` and `/contact` — Paddle's
 * checkout links to them by those names, and a legal document that moved is a
 * legal document nobody can find.
 *
 * Static: no `cookies()`, no `headers()`, nothing per-request.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader />
      {children}
      <PageFooter />
    </>
  );
}
