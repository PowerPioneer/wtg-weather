"use client";

import { useEffect } from "react";

import { APP_ENV, GLITCHTIP_DSN_CLIENT, GLITCHTIP_RELEASE, SITE_URL } from "@/lib/env";

/**
 * Browser-side GlitchTip init. GlitchTip speaks the Sentry protocol, so we
 * point `@sentry/browser` at the GlitchTip DSN and configure it defensively:
 * no tracing (we only want errors), no replay, and a before-send hook that
 * strips anything PII-shaped on its way out.
 */
export function GlitchTipClient() {
  useEffect(() => {
    if (!GLITCHTIP_DSN_CLIENT) return;
    let cancelled = false;
    import("@sentry/browser")
      .then((Sentry) => {
        if (cancelled) return;
        Sentry.init({
          dsn: GLITCHTIP_DSN_CLIENT,
          environment: APP_ENV,
          release: GLITCHTIP_RELEASE || undefined,
          tracesSampleRate: 0,
          sendDefaultPii: false,
          integrations: [Sentry.browserTracingIntegration({ enableInp: false })],
          allowUrls: [SITE_URL, /localhost/],
          beforeSend(event) {
            if (event.user) {
              delete event.user.email;
              delete event.user.ip_address;
            }
            if (event.request?.cookies) delete event.request.cookies;
            if (event.request?.headers) {
              delete (event.request.headers as Record<string, unknown>)["cookie"];
              delete (event.request.headers as Record<string, unknown>)["authorization"];
            }
            return event;
          },
        });
      })
      .catch(() => {
        /* swallow — error reporting must never block rendering */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
