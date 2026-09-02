/**
 * Public and server-only environment. Read here once so every call site has
 * the same defaults and no scattered `process.env` accesses.
 *
 * - `INTERNAL_API_URL` — docker-network hostname the SSR pages call.
 * - `SITE_URL` — canonical URL used by canonical + OG tags.
 */

/**
 * Treat an empty value as absent. `NEXT_PUBLIC_*` are baked into the client
 * bundle at build time from Docker build args, and an arg the builder was not
 * given arrives as `""` rather than undefined — so a plain `??` would hand the
 * app an empty string instead of the default below it. Every default here means
 * "nothing was configured", and "" is the same statement as unset.
 */
const set = (value: string | undefined): string | undefined =>
  value != null && value.trim() !== "" ? value : undefined;

export const SITE_URL =
  set(process.env.NEXT_PUBLIC_SITE_URL)?.replace(/\/$/, "") ??
  "https://v2.wheretogoforgreatweather.com";

export const INTERNAL_API_URL =
  set(process.env.INTERNAL_API_URL)?.replace(/\/$/, "") ??
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
  set(process.env.NEXT_PUBLIC_GLITCHTIP_DSN_WEB) ?? "";
export const GLITCHTIP_DSN_SERVER =
  set(process.env.GLITCHTIP_DSN_WEB) ?? set(process.env.GLITCHTIP_DSN) ?? "";
export const GLITCHTIP_RELEASE =
  set(process.env.NEXT_PUBLIC_GLITCHTIP_RELEASE) ?? "";
export const APP_ENV =
  set(process.env.NEXT_PUBLIC_APP_ENV) ?? set(process.env.NODE_ENV) ?? "development";

// Plausible — self-hosted, pre-login. `DOMAIN` must match what's registered
// in Plausible. `SRC` points at the script, defaulting to the self-host path.
export const PLAUSIBLE_DOMAIN =
  set(process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) ?? "";
export const PLAUSIBLE_SRC =
  set(process.env.NEXT_PUBLIC_PLAUSIBLE_SRC) ?? "/_plausible/js/script.js";

// Paddle.js client-side token. Safe to expose — it is scoped to opening
// checkouts and previewing prices, and is not the API key. Must reach the
// Docker build as a build arg, not only as runtime env: an unset one arrives
// as "" and the Upgrade button fails with `CheckoutUnavailable`.
export const PADDLE_CLIENT_TOKEN =
  set(process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN) ?? "";

// Which Paddle account we are talking to. Deliberately **not** defaulted: a
// wrong guess here does not fail, it quietly transacts against the other
// environment, and the sandbox and production accounts have different prices,
// different customers and different money. `paddleEnvironment()` in
// `lib/paddle.ts` requires this and cross-checks it against the token's own
// `test_` / `live_` prefix, so the two cannot disagree in silence.
export const PADDLE_ENV = set(process.env.NEXT_PUBLIC_PADDLE_ENV) ?? "";

// PostHog — cloud, post-login. Loaded only when the user is signed in.
export const POSTHOG_KEY = set(process.env.NEXT_PUBLIC_POSTHOG_KEY) ?? "";
export const POSTHOG_HOST =
  set(process.env.NEXT_PUBLIC_POSTHOG_HOST) ?? "https://us.i.posthog.com";
