"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthCard } from "./auth-card";
import { Button } from "@/components/ui/button";
import { fetchMe, postMagicLink } from "@/lib/api-client";

const RESEND_SECONDS = 45;
const POLL_MS = 3000;

export type MagicLinkSentProps = {
  /** Email the link was sent to. Rendered back to the user; also scoped resends. */
  email: string;
  /** Where to send the user once the cookie shows up. Defaults to `/`. */
  next?: string;
};

/**
 * "Check your inbox" card. Polls `/api/me` every 3s so the user is redirected
 * automatically once the cookie lands in this tab — the magic-link target
 * sets the cookie server-side and this page's fetch shares the same jar.
 *
 * The resend button is rate-limited on the client (45s cooldown) to mirror
 * the API's throttle. Not security — ergonomics; the API is still the gate.
 */
export function MagicLinkSent({ email, next = "/" }: MagicLinkSentProps) {
  const router = useRouter();
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  // Poll /api/me — the moment FastAPI sees the session cookie, bounce to `next`.
  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const me = await fetchMe();
        if (me && active) {
          router.replace(next);
          router.refresh();
        }
      } catch {
        // Swallow — next tick will retry. Errors here are expected while the
        // link hasn't been clicked yet.
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    void tick();
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [router, next]);

  // Resend cooldown timer.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  async function onResend() {
    if (cooldown > 0 || resendState === "sending") return;
    setResendState("sending");
    const result = await postMagicLink(email);
    if (result === "ok") {
      setResendState("sent");
      setCooldown(RESEND_SECONDS);
    } else {
      setResendState("error");
    }
  }

  const resendDisabled = cooldown > 0 || resendState === "sending";

  return (
    <AuthCard
      header={
        <div
          className="mb-5 flex h-12 w-12 items-center justify-center rounded-md border border-accent bg-accent-subtle"
          aria-hidden
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-accent">
            <path d="M3 6h18v12H3z" />
            <path d="M3 6l9 7 9-7" />
          </svg>
        </div>
      }
      title="Check your inbox"
      subtitle={
        <>
          We sent a sign-in link to{" "}
          <strong className="font-mono text-[12.5px] font-medium text-text">{email}</strong>.
          Click it from the same browser to finish signing in. The link expires in 15 minutes.
        </>
      }
    >
      <div
        className="rounded-md border border-border bg-surface-2/60 px-4 py-3.5"
        aria-live="polite"
      >
        <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
          Waiting for you to click
        </div>
        <div className="mt-2.5 flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent"
          />
          <span className="text-body-sm text-text">Listening for sign-in…</span>
        </div>
        <p className="mt-2.5 font-mono text-[11px] text-text-subtle">
          This page will continue automatically once you click the link.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5">
        <Link href="/login" className="text-[12.5px] text-text-muted hover:text-text">
          ← Wrong email? Go back
        </Link>
        <div className="inline-flex items-center gap-2.5">
          <span className="font-mono text-[11.5px] text-text-subtle">
            {resendState === "sent"
              ? "Sent — check again"
              : cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Ready to resend"}
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onResend}
            disabled={resendDisabled}
            loading={resendState === "sending"}
          >
            Resend link
          </Button>
        </div>
      </div>

      {resendState === "error" ? (
        <p role="alert" className="mt-2 text-[12px] text-destructive">
          Couldn&apos;t resend just now. Try again in a moment.
        </p>
      ) : null}
    </AuthCard>
  );
}
