"use client";

/**
 * Initialises Paddle.js on the default payment link page.
 *
 * Paddle.js opens a checkout by itself when `?_ptxn=` is present — there is
 * nothing to call and nothing to pass. All this component has to do is get
 * Paddle.js initialised, then say something useful for the seconds before the
 * overlay paints, and something honest if it never does.
 *
 * The states are deliberate rather than one spinner. This page is where Paddle
 * sends a customer whose card is about to expire, so a blank page with a
 * spinner is a subscription quietly lapsing.
 */

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { PADDLE_CLIENT_TOKEN } from "@/lib/env";
import { PADDLE_EVENT, getPaddle } from "@/lib/paddle";

type Phase = "opening" | "no-transaction" | "unavailable" | "stalled";

/**
 * How long to wait for Paddle before admitting it is not coming.
 *
 * Generous, because the overlay legitimately takes a few seconds on a cold
 * load and interrupting a checkout that was about to appear would be worse
 * than a slow one. But finite: this used to wait forever, so a transaction
 * Paddle accepted and then failed to render left the page reading "Opening
 * checkout…" indefinitely, with no error and no way onward — on the page
 * customers reach from a card-expiry email.
 */
const OPEN_TIMEOUT_MS = 15_000;

export function PaddlePaymentLink() {
  // The token is inlined at build time, so whether we can open anything at all
  // is knowable at first render — no effect, and no flash of "opening…" on a
  // build that was never given one.
  const [phase, setPhase] = useState<Phase>(
    PADDLE_CLIENT_TOKEN ? "opening" : "unavailable",
  );
  // Read in a timer callback, so it has to be a ref rather than state.
  const opened = useRef(false);

  useEffect(() => {
    if (!PADDLE_CLIENT_TOKEN) return;
    // Read here rather than with `useSearchParams` so the page needs no
    // Suspense boundary: this component is client-only and the parameter is
    // never present at prerender time.
    const hasTransaction = new URLSearchParams(window.location.search).has(
      "_ptxn",
    );

    let cancelled = false;
    let timer: number | undefined;

    // Any checkout event at all means Paddle got far enough to talk to us, so
    // the overlay is either up or on its way and the timeout must not fire.
    const onPaddleEvent = (event: Event) => {
      const name = (event as CustomEvent<string>).detail ?? "";
      if (name.startsWith("checkout.")) opened.current = true;
    };
    window.addEventListener(PADDLE_EVENT, onPaddleEvent);

    void getPaddle()
      .then(() => {
        if (cancelled) return;
        // Paddle.js takes it from here when `_ptxn` is present. When it is
        // not, somebody reached this URL directly and there is nothing to
        // open.
        if (!hasTransaction) {
          setPhase("no-transaction");
          return;
        }
        timer = window.setTimeout(() => {
          if (!cancelled && !opened.current) setPhase("stalled");
        }, OPEN_TIMEOUT_MS);
      })
      .catch(() => {
        if (!cancelled) setPhase("unavailable");
      });

    return () => {
      cancelled = true;
      window.removeEventListener(PADDLE_EVENT, onPaddleEvent);
      if (timer !== undefined) window.clearTimeout(timer);
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

  if (phase === "stalled") {
    return (
      <Content
        heading="The payment window didn't open"
        body="Our payment provider didn't respond. Nothing has been charged. Reloading often fixes it; if you were updating a card, your account page can start it again."
        href="/account"
        cta="Go to your account"
        secondary={{ href: "/contact", label: "Contact support" }}
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
  secondary,
}: {
  heading: string;
  body: string;
  href?: string;
  cta?: string;
  secondary?: { href: string; label: string };
}) {
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
      <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {href && cta ? (
          <Button as="a" href={href}>
            {cta}
          </Button>
        ) : null}
        {secondary ? (
          <Button as="a" href={secondary.href} variant="secondary">
            {secondary.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
