"use client";

/**
 * Where Paddle sends someone after they pay.
 *
 * The subscription is *not* active when this page loads. Paddle takes the
 * payment, redirects the browser, and separately posts a webhook to the API;
 * the plan changes when that webhook lands, and `/api/me` keeps answering with
 * the old plan for up to another 60 seconds after it does because entitlements
 * are cached in Redis for that long (`api/CLAUDE.md`).
 *
 * So this page polls, and — more importantly — says what it is waiting for.
 * The alternative is a spinner that looks broken for a minute immediately
 * after taking someone's money, which is the single worst moment on the site
 * to look broken. It also never becomes a reload loop: the poll stops on
 * success, stops at the deadline, and the "still waiting" state is a real
 * answer with a way forward rather than a retry.
 */

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchMe } from "@/lib/api-client";
import { getEntitlement } from "@/lib/session-user";
import { CHECKOUT_RETURN_COPY } from "./copy";

/** How often to ask. Comfortably inside the 60s entitlement cache window. */
const POLL_INTERVAL_MS = 3_000;
/**
 * When to stop and say so. Webhook delivery plus a 60s cache means ~75s is the
 * realistic worst case; 120s gives that room and then admits defeat rather
 * than polling somebody's browser indefinitely.
 */
const POLL_DEADLINE_MS = 120_000;

type Phase = "waiting" | "active" | "slow";

export type CheckoutSuccessProps = {
  /** True when the session was *already* premium on the server render. */
  initiallyPremium?: boolean;
};

export function CheckoutSuccess({ initiallyPremium = false }: CheckoutSuccessProps) {
  const [phase, setPhase] = useState<Phase>(initiallyPremium ? "active" : "waiting");
  const [elapsed, setElapsed] = useState(0);
  // Stamped inside the effect, not at render: `Date.now()` in a render body is
  // an impure read, and this one only needs to be right relative to the poll.
  const startedAt = useRef(0);

  useEffect(() => {
    if (initiallyPremium) return;
    let cancelled = false;
    let timer: number | undefined;
    startedAt.current = Date.now();

    const tick = async () => {
      if (cancelled) return;
      try {
        const me = await fetchMe();
        if (cancelled) return;
        if (getEntitlement(me).premium) {
          setPhase("active");
          return;
        }
      } catch {
        // A failed poll is not a failed payment. Keep waiting until the
        // deadline; the money is already taken either way and telling the
        // visitor their purchase broke because one fetch did would be a lie.
      }
      if (cancelled) return;
      const waited = Date.now() - startedAt.current;
      setElapsed(waited);
      if (waited >= POLL_DEADLINE_MS) {
        setPhase("slow");
        return;
      }
      timer = window.setTimeout(() => void tick(), POLL_INTERVAL_MS);
    };

    timer = window.setTimeout(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [initiallyPremium]);

  const copy = CHECKOUT_RETURN_COPY.success;

  return (
    <div
      className="rounded-lg border border-border bg-surface p-8"
      data-testid="checkout-success"
      data-phase={phase}
    >
      <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-accent">
        {copy.eyebrow}
      </div>

      {/*
        Announced politely rather than assertively: this region changes once,
        from "waiting" to a result, and a screen-reader user should hear it
        without having whatever they were reading interrupted.
      */}
      <div aria-live="polite" aria-atomic="true">
        <h1 className="mt-2 font-display text-[32px] font-medium leading-[1.15] tracking-[-0.01em] text-text">
          {phase === "active"
            ? copy.doneTitle
            : phase === "slow"
              ? copy.slowTitle
              : copy.waitingTitle}
        </h1>
        <p className="mt-3 max-w-[560px] text-[14px] leading-[1.6] text-text-muted">
          {phase === "active"
            ? copy.doneBody
            : phase === "slow"
              ? copy.slowBody
              : copy.waitingBody}
        </p>
      </div>

      {phase === "waiting" && (
        <div className="mt-5 flex items-center gap-2.5" data-testid="checkout-waiting">
          <span
            aria-hidden="true"
            className="size-2 animate-pulse rounded-full bg-accent"
          />
          <span className="font-mono text-[11.5px] text-text-muted">
            Checking with the payment provider · {Math.round(elapsed / 1000)}s
          </span>
        </div>
      )}

      <div className="mt-7 flex flex-wrap gap-2.5">
        {/*
          A real link, not a router push: the map reads the session server-side,
          and after an upgrade that is exactly the read we want repeated.
        */}
        <Button as="a" href="/map">
          {copy.ctaMap}
        </Button>
        <Button as="a" href="/account?s=billing" variant="secondary">
          {copy.ctaAccount}
        </Button>
      </div>
    </div>
  );
}
