"use client";

/**
 * "Manage subscription on Paddle".
 *
 * Asks the API to mint a customer-portal session and follows the URL it
 * returns. The browser never constructs a Paddle URL — that is `lib/paddle.ts`'s
 * stated contract, and here it is load-bearing rather than tidy: a portal
 * session is a bearer capability over saved payment methods and invoice
 * history, so the customer id it is minted against has to come from the
 * caller's own resolved organization on the server, never from anything this
 * component could put in a request.
 *
 * What sat here before was `<a href="https://paddle.com">` — the company
 * homepage, for every subscriber, labelled "Manage subscription".
 */

import { useState } from "react";

import { Button } from "@/components/ui/button";

type State = "idle" | "pending" | "error" | "unavailable";

export type ManageBillingButtonProps = {
  label: string;
  /**
   * False when the API says no portal can be minted — no Paddle customer on
   * file, or an environment with no API key. The button is not rendered at
   * all in that case; the caller shows the checkout path instead.
   */
  available: boolean;
  variant?: "primary" | "secondary";
};

export function ManageBillingButton({
  label,
  available,
  variant = "primary",
}: ManageBillingButtonProps) {
  const [state, setState] = useState<State>("idle");

  if (!available) return null;

  async function open() {
    setState("pending");
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (res.status === 404) {
        // Nothing to manage. Distinct from a failure — the account simply has
        // no subscription at Paddle, which is a fact, not an error.
        setState("unavailable");
        return;
      }
      if (!res.ok) {
        setState("error");
        return;
      }
      const body = (await res.json()) as { portal_url?: unknown };
      if (typeof body.portal_url !== "string") {
        setState("error");
        return;
      }
      window.location.assign(body.portal_url);
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant={variant}
        loading={state === "pending"}
        disabled={state === "pending"}
        onClick={() => void open()}
        data-testid="manage-billing"
        data-state={state}
      >
        {state === "pending" ? "Opening Paddle…" : label}
      </Button>
      {state === "error" && (
        <p role="alert" className="text-[12px] text-destructive">
          Couldn&rsquo;t open the billing portal just now. Your subscription is
          unaffected — try again in a moment.
        </p>
      )}
      {state === "unavailable" && (
        <p role="alert" className="text-[12px] text-text-muted">
          There&rsquo;s no subscription on file for this account yet.
        </p>
      )}
    </div>
  );
}
