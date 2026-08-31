"use client";

/**
 * Initialises Paddle.js on the default payment link page.
 *
 * Paddle.js opens a checkout by itself when `?_ptxn=` is present — there is
 * nothing to call and nothing to pass. All this component has to do is get
 * Paddle.js initialised and then say something useful for the seconds before
 * the overlay paints, or forever if it cannot.
 *
 * The three states are deliberate rather than one spinner. This page is where
 * Paddle sends a customer whose card is about to expire, so a blank page with
 * a spinner is a subscription quietly lapsing.
 */

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { PADDLE_CLIENT_TOKEN } from "@/lib/env";
import { getPaddle } from "@/lib/paddle";

type Phase = "opening" | "no-transaction" | "unavailable";

export function PaddlePaymentLink() {
  // The token is inlined at build time, so whether we can open anything at all
  // is knowable at first render — no effect, and no flash of "opening…" on a
  // build that was never given one.
  const [phase, setPhase] = useState<Phase>(
    PADDLE_CLIENT_TOKEN ? "opening" : "unavailable",
  );

  useEffect(() => {
    if (!PADDLE_CLIENT_TOKEN) return;
    // Read here rather than with `useSearchParams` so the page needs no
    // Suspense boundary: this component is client-only and the parameter is
    // never present at prerender time.
    const hasTransaction = new URLSearchParams(window.location.search).has(
      "_ptxn",
    );

    let cancelled = false;
    void getPaddle()
      .then(() => {
        if (cancelled) return;
        // Paddle.js takes it from here when `_ptxn` is present. When it is
        // not, somebody reached this URL directly and there is nothing to
        // open.
        if (!hasTransaction) setPhase("no-transaction");
      })
      .catch(() => {
        if (!cancelled) setPhase("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "unavailable") {
    return (
      <Content
        heading="Checkout is unavailable"
        body="We couldn't load our payment provider. This is on our side, not yours — nothing has been charged. Please try again shortly, or contact us if it persists."
        href="/contact"
        cta="Contact support"
      />
    );
  }

  if (phase === "no-transaction") {
    return (
      <Content
        heading="Nothing to pay for here"
        body="This page opens a checkout that was started somewhere else. If you came here to change a plan or a payment method, your account page has both."
        href="/account"
        cta="Go to your account"
      />
    );
  }

  return (
    <Content
      heading="Opening checkout…"
      body="This takes a moment. If nothing appears, your browser may be blocking the payment window — allow pop-ups for this site and reload."
    />
  );
}

function Content({
  heading,
  body,
  href,
  cta,
}: {
  heading: string;
  body: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
      <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
      {href && cta ? (
        <Button as="a" href={href}>
          {cta}
        </Button>
      ) : null}
    </div>
  );
}
