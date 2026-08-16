import type { Metadata } from "next";

import { PageFooter, PageHeader } from "@/components/layout";
import { CheckoutSuccess } from "@/components/upgrade/checkout-success";
import { getEntitlement, getSessionServer } from "@/lib/session";

export const metadata: Metadata = {
  title: "Subscription activating · Atlas Weather",
  robots: { index: false, follow: false },
};

/**
 * Paddle's return URL after a completed checkout.
 *
 * Per-user and mid-transaction, so nothing here may be cached or prerendered:
 * a stored copy of this page would tell the next buyer about the last buyer's
 * subscription.
 */
export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage() {
  // Read the session once on the server so a subscription whose webhook has
  // *already* landed (fast Paddle, slow browser) renders as active on first
  // paint instead of showing a "waiting" state that resolves a beat later.
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
