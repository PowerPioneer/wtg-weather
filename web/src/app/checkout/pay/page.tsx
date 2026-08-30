import type { Metadata } from "next";

import { PageFooter, PageHeader } from "@/components/layout";
import { PaddlePaymentLink } from "@/components/upgrade/paddle-payment-link";

export const metadata: Metadata = {
  // The root layout's template appends "· Atlas Weather" already.
  title: "Opening checkout",
  robots: { index: false, follow: false },
};

/**
 * Our Paddle **default payment link**.
 *
 * Set in Paddle → Checkout → Checkout settings → Default payment link, and it
 * is not optional: Paddle refuses to create *any* transaction for an account
 * without one. It is reached three ways, only one of which is a purchase:
 *
 *   1. Paddle's own emails to customers, to update a payment method on an
 *      automatically-collected subscription;
 *   2. `management_urls` on a subscription entity, same purpose;
 *   3. the `/upgrade` redirect, for a visitor whose click never reached the
 *      overlay in `use-checkout.ts`.
 *
 * Paddle appends `?_ptxn=<transaction id>`; Paddle.js opens a checkout for it
 * on load without being asked. Nothing on this page reads that parameter — it
 * only has to be a page on an approved domain that has initialised Paddle.js.
 *
 * Not prerendered: it exists to run a script against a per-transaction query
 * parameter, and a cached copy would be a page telling the next customer about
 * the previous one's transaction.
 */
export const dynamic = "force-dynamic";

export default function CheckoutPayPage() {
  return (
    <>
      <PageHeader />
      <main className="mx-auto w-full max-w-lg px-4 py-16">
        <PaddlePaymentLink />
      </main>
      <PageFooter />
    </>
  );
}
