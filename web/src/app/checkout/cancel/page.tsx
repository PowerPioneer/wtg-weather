import type { Metadata } from "next";

import { PageFooter, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { CHECKOUT_RETURN_COPY } from "@/components/upgrade";

export const metadata: Metadata = {
  title: "Checkout cancelled · Atlas Weather",
  robots: { index: false, follow: false },
};

/**
 * Where Paddle returns someone who closed the checkout without paying.
 *
 * Entirely static and zero-JS — there is no state to resolve here, and the one
 * thing this page has to do is say plainly that no money moved. A cancelled
 * checkout that lands on a generic page reads, to the person who just closed a
 * payment form, exactly like a payment that half-happened.
 */
export const revalidate = 2592000;

export default function CheckoutCancelPage() {
  const copy = CHECKOUT_RETURN_COPY.cancel;
  return (
    <>
      <PageHeader />
      <main className="flex-1 bg-background">
        <div className="mx-auto w-full max-w-[720px] px-6 py-16 md:py-24">
          <div className="rounded-lg border border-border bg-surface p-8">
            <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              {copy.eyebrow}
            </div>
            <h1 className="mt-2 font-display text-[32px] font-medium leading-[1.15] tracking-[-0.01em] text-text">
              {copy.title}
            </h1>
            <p className="mt-3 max-w-[560px] text-[14px] leading-[1.6] text-text-muted">
              {copy.body}
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Button as="a" href="/pricing">
                {copy.ctaRetry}
              </Button>
              <Button as="a" href="/map" variant="secondary">
                {copy.ctaMap}
              </Button>
            </div>
          </div>
        </div>
      </main>
      <PageFooter />
    </>
  );
}
