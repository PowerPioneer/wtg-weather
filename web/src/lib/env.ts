/**
 * Public and server-only environment. Read here once so every call site has
 * the same defaults and no scattered `process.env` accesses.
 *
 * - `INTERNAL_API_URL` — docker-network hostname the SSR pages call.
 * - `SITE_URL` — canonical URL used by canonical + OG tags.
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://v2.wheretogoforgreatweather.com";

export const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL?.replace(/\/$/, "") ??
  "http://api:8000";

// Opt-*in* flag, and the direction matters. It used to default on, so the
// production build had to remember to switch it off — and until WS-5 there was
// nothing to switch it on to, which is how a site backed by three fixture
// countries reached production with every visitor treated as premium
// (`session.ts`). Real data is now the default; the fixtures are for tests and
// for a `pnpm dev` with no API running.
export const USE_MOCK_DATA = process.env.WTG_USE_MOCK_DATA === "1";

// ─── Observability & analytics ───────────────────────────────────────
//
// GlitchTip DSN (Sentry-protocol compatible). Two DSNs — web (client-side,
// must be NEXT_PUBLIC_) and server (node runtime). Empty string disables.
export const GLITCHTIP_DSN_CLIENT =
  process.env.NEXT_PUBLIC_GLITCHTIP_DSN_WEB ?? "";
export const GLITCHTIP_DSN_SERVER =
  process.env.GLITCHTIP_DSN_WEB ?? process.env.GLITCHTIP_DSN ?? "";
export const GLITCHTIP_RELEASE =
  process.env.NEXT_PUBLIC_GLITCHTIP_RELEASE ?? "";
export const APP_ENV =
  process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? "development";

// Plausible — self-hosted, pre-login. `DOMAIN` must match what's registered
// in Plausible. `SRC` points at the script, defaulting to the self-host path.
export const PLAUSIBLE_DOMAIN =
  process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? "";
export const PLAUSIBLE_SRC =
  process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ?? "/_plausible/js/script.js";

// PostHog — cloud, post-login. Loaded only when the user is signed in.
export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
export const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
