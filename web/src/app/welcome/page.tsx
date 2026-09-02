import type { Metadata } from "next";

import { PageFooter, PageHeader } from "@/components/layout";
import { CheckoutSuccess } from "@/components/upgrade/checkout-success";
import { getEntitlement, getSessionServer } from "@/lib/session";

export const metadata: Metadata = {
  title: "Welcome",
  robots: { index: false, follow: false },
};

/**
 * Where Paddle returns the buyer after a completed checkout.
 *
 * Set as `successUrl` in `Paddle.Initialize()` (`lib/paddle.ts`) — opening a
 * checkout by `transactionId` accepts no per-call settings, so it has to be
 * configured there.
 *
 * It reuses `CheckoutSuccess` rather than saying "welcome!" and stopping,
 * because **the subscription is not active when this page loads**. Paddle
 * takes the payment, redirects the browser, and posts the webhook separately;
 * the plan changes when that webhook lands, and `/api/me` keeps answering with
 * the old plan for up to another 60 seconds after it does, because
 * entitlements are cached in Redis for that long (`api/CLAUDE.md`). A plain
 * welcome page would therefore greet a paying customer as a free user, at the
 * single worst moment on the site to look broken. That component polls, says
 * what it is waiting for, and stops rather than looping.
 *
 * Per-user and mid-transaction, so nothing here may be cached or prerendered:
 * a stored copy would tell the next buyer about the last buyer's subscription.
 */
export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  // Read on the server so a webhook that has *already* landed (fast Paddle,
  // slow browser) renders as active on first paint rather than flashing a
  // waiting state that resolves a beat later.
  const session = await getSessionServer();
  const premium = getEntitlement(session).premium;

  return (
    <>
      <PageHeader />
      <main className="flex-1 bg-background">
        <div className="mx-auto w-full max-w-[720px] px-6 py-16 md:py-24">
          <CheckoutSuccess initiallyPremium={premium} />
        </div>
      </main>
      <PageFooter />
    </>
  );
}
