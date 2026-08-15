"use client";

import { useSession } from "@/hooks/use-session";

import { PlausibleScript } from "./plausible-script";
import { PostHogProvider } from "./posthog-provider";

/**
 * Plausible for anonymous traffic, PostHog for identified — the split
 * `REBUILD_PLAN` §1 asks for, decided in the browser rather than in the root
 * layout.
 *
 * It used to be decided server-side, which meant the root layout called
 * `getSessionServer()` and therefore `cookies()`. A dynamic API in the root
 * layout opts **every route in the app** out of static generation: the ~2,800
 * country and country/month pages that `web/CLAUDE.md` specifies as "static at
 * build time, `revalidate: 60*60*24*30`" were being server-rendered per
 * request, each one making an `/api/me` round trip before it could render a
 * page that does not depend on who is asking. `generateStaticParams` ran and
 * its output went unused.
 *
 * Deciding here costs one client-side `/api/me` — which `useSession` already
 * makes on any page with a session-aware control — and costs nothing at all
 * for content: analytics are JavaScript either way, so a visitor with JS
 * disabled sees exactly the same page as before, which is the SSR rule.
 *
 * Neither tag mounts until the session resolves. Rendering Plausible
 * optimistically and swapping it out would double-count every signed-in
 * visitor's first pageview across two analytics products.
 */
export function AnalyticsSwitch() {
  const { session, loading } = useSession();

  if (loading) return null;
  if (!session) return <PlausibleScript />;

  return (
    <PostHogProvider
      user={{
        id: session.id,
        plan: session.plan,
        role: session.role,
        orgId: session.org?.id ?? undefined,
      }}
    />
  );
}
