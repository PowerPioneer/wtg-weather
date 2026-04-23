import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { MagicLinkSent } from "@/components/auth/magic-link-sent";

export const metadata: Metadata = {
  title: "Check your inbox",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ email?: string | string[]; next?: string | string[] }>;

/**
 * `/login/sent` — reached after the magic-link form POSTs successfully. The
 * email came in via a query param (not a cookie) because that keeps the page
 * idempotent on refresh and shareable in a support ticket without leaking a
 * session. If the param is missing we bounce back to `/login` — there's
 * nothing to show.
 */
export default async function LoginSentPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawEmail = Array.isArray(params.email) ? params.email[0] : params.email;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;

  if (!rawEmail || typeof rawEmail !== "string") redirect("/login");

  const next = isSafeNext(rawNext) ? rawNext : "/";

  return <MagicLinkSent email={rawEmail} next={next} />;
}

/**
 * Only allow `next` values that resolve to a path on this origin. Anything
 * else (absolute URL, protocol-relative, backslash tricks) is dropped.
 */
function isSafeNext(value: string | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//") || value.startsWith("/\\")) return false;
  return true;
}
