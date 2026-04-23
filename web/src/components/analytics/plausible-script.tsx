import Script from "next/script";

import { PLAUSIBLE_DOMAIN, PLAUSIBLE_SRC } from "@/lib/env";

/**
 * Plausible tag — loaded only when a visitor is NOT signed in. Post-login
 * traffic is routed to PostHog instead (see posthog-provider.tsx). This split
 * matches REBUILD_PLAN §1: Plausible for anonymous, PostHog for identified.
 *
 * We also install a `window.plausible` queue shim so `trackEvent()` calls
 * made before the async script finishes loading are not dropped.
 */
export function PlausibleScript() {
  if (!PLAUSIBLE_DOMAIN) return null;

  return (
    <>
      <Script
        id="plausible-loader"
        strategy="afterInteractive"
        src={PLAUSIBLE_SRC}
        data-domain={PLAUSIBLE_DOMAIN}
        defer
      />
      <Script id="plausible-queue" strategy="afterInteractive">
        {`window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}`}
      </Script>
    </>
  );
}
