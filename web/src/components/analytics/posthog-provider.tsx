"use client";

import { useEffect } from "react";

import { APP_ENV, POSTHOG_HOST, POSTHOG_KEY } from "@/lib/env";

export type PostHogUser = {
  id: string;
  plan: string;
  /** Membership role, or null for a user with no organization. */
  role: string | null;
  orgId?: string;
};

/**
 * PostHog loader for signed-in visitors. Mounted only when the RSC layout
 * has already resolved a session, so we skip the "is the user logged in"
 * dance on the client. Calls `identify()` with the session user id on mount
 * and resets the identity when the component unmounts (logout).
 */
export function PostHogProvider({ user }: { user: PostHogUser }) {
  useEffect(() => {
    if (!POSTHOG_KEY) return;
    let cancelled = false;
    let loadedPosthog: typeof import("posthog-js").default | null = null;
    import("posthog-js")
      .then(({ default: posthog }) => {
        if (cancelled) return;
        loadedPosthog = posthog;
        posthog.init(POSTHOG_KEY, {
          api_host: POSTHOG_HOST,
          capture_pageview: true,
          capture_pageleave: true,
          person_profiles: "identified_only",
          // Off here, not just off in the PostHog project settings.
          //
          // Session replay is remotely configurable: posthog-js asks the
          // server whether to record, so a toggle flipped in the dashboard
          // starts recording signed-in users' screens with no code change and
          // no review. `/privacy` tells users replay is off, and a claim in a
          // privacy policy should be enforced by the software rather than by
          // somebody remembering. Replay of an authenticated session — which
          // here means account pages, email addresses and saved trips —
          // is a consent question, so turning it on is a deliberate change to
          // this line plus a change to `/privacy`, not a dashboard toggle.
          disable_session_recording: true,
          loaded: (p) => {
            if (APP_ENV !== "prod") p.debug(false);
          },
        });
        window.posthog = posthog as unknown as Window["posthog"];
        posthog.identify(user.id, {
          plan: user.plan,
          role: user.role,
          orgId: user.orgId,
        });
      })
      .catch(() => {
        /* network/adblock — analytics must not break the app */
      });
    return () => {
      cancelled = true;
      try {
        loadedPosthog?.reset();
      } catch {
        /* swallow */
      }
    };
    // Identity keyed on user.id only — plan/role changes don't re-identify.
  }, [user.id, user.plan, user.role, user.orgId]);

  return null;
}
