"use client";

import Link from "next/link";

import { useSession } from "@/hooks/use-session";

/**
 * The header's account CTA, resolved in the browser.
 *
 * `PageHeader` is a Server Component rendered on the ~2,800 statically
 * generated country pages, so it cannot read the session itself: `cookies()`
 * anywhere in that path opts every one of them out of static generation, which
 * `web/CLAUDE.md` forbids. Same constraint `AnalyticsSwitch` works around, and
 * the same answer — one client-side `/api/me`, which `useSession` already
 * makes on any page carrying a session-aware control.
 *
 * Unlike `AnalyticsSwitch`, this renders *something* while loading rather than
 * nothing, and what it renders is the signed-out label. Two reasons: it is the
 * server-rendered output, so hydration matches and there is no flash; and a
 * visitor with JS disabled keeps a working control instead of a hole in the
 * nav. Following it while already signed in lands on `/login`, which redirects
 * to `/` — the no-JS path is imperfect but never broken, which is what
 * progressive enhancement asks for here.
 */
export function HeaderAccountLink({ className }: { className?: string }) {
  const { session, loading } = useSession();
  const signedIn = !loading && session !== null;

  return (
    <Link href={signedIn ? "/account" : "/login"} className={className}>
      {signedIn ? "Account" : "Sign in"}
    </Link>
  );
}
