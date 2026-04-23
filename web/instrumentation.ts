/**
 * Next.js server-side instrumentation hook. Runs once at process startup
 * on the Node runtime. We use it to bootstrap `@sentry/node` against the
 * GlitchTip DSN (Sentry-protocol compatible) so server-rendered errors
 * and API-route exceptions reach GlitchTip alongside browser ones.
 *
 * The Edge runtime is skipped — we have no Edge routes.
 */

import { APP_ENV, GLITCHTIP_DSN_SERVER, GLITCHTIP_RELEASE } from "@/lib/env";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!GLITCHTIP_DSN_SERVER) return;
  const Sentry = await import("@sentry/node");
  Sentry.init({
    dsn: GLITCHTIP_DSN_SERVER,
    environment: APP_ENV,
    release: GLITCHTIP_RELEASE || undefined,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, unknown>;
        delete h["cookie"];
        delete h["authorization"];
        delete h["x-forwarded-for"];
      }
      return event;
    },
  });
}

export async function onRequestError(
  err: unknown,
  request: { path?: string; method?: string; headers?: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string },
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!GLITCHTIP_DSN_SERVER) return;
  const Sentry = await import("@sentry/node");
  Sentry.captureException(err, {
    contexts: { nextjs: { ...context, path: request.path, method: request.method } },
  });
}
