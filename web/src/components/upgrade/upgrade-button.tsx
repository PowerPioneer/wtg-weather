"use client";

/**
 * The upgrade CTA. One component, five call sites.
 *
 * Renders a real `<a href="/upgrade?plan=…">` and intercepts the click once
 * hydrated. With JS the visitor gets a pending state and an inline error; with
 * JS off — or before hydration, which on the pricing page is a real window —
 * the anchor navigates to the route handler, which does the same handoff
 * server-side. Either way nobody meets a button that does nothing, which is
 * the failure this whole workstream is about: the pricing page's Try Premium
 * pointed at `/api/billing/checkout`, a route that has never existed.
 *
 * Copy comes from `./copy.ts` and is not overridable with free text — see
 * `CHECKOUT_COPY` there for why the price lives in one place.
 */

import { cn } from "@/lib/cn";
import { useCheckout } from "@/hooks/use-checkout";
import { checkoutPath, type PaddlePlan } from "@/lib/paddle";
import { CHECKOUT_COPY } from "./copy";

export type UpgradeButtonProps = {
  plan: PaddlePlan;
  /** Agency plans — the org the seats attach to. */
  organizationId?: string;
  /** Analytics `source`: "pricing", "map_popover", "display_mode", … */
  source: string;
  /** Extra analytics properties, e.g. which locked feature prompted this. */
  properties?: Record<string, string | number | boolean>;
  /**
   * CTA label. Defaults to the shared one; pass a tier's own `cta.label`
   * (which also lives in `copy.ts`) for the pricing cards.
   */
  label?: string;
  className?: string;
  /** Where the inline error sits. Defaults to below the button. */
  errorClassName?: string;
};

export function UpgradeButton({
  plan,
  organizationId,
  source,
  properties,
  label = CHECKOUT_COPY.cta,
  className,
  errorClassName,
}: UpgradeButtonProps) {
  const checkout = useCheckout();

  return (
    <>
      <a
        href={checkoutPath(plan, organizationId)}
        data-testid="upgrade-cta"
        data-plan={plan}
        data-status={checkout.status}
        aria-busy={checkout.pending || undefined}
        onClick={(event) => {
          // Let the browser handle modified clicks (new tab, download) and
          // anything that isn't a plain primary click — the anchor target is a
          // working destination, so there is no reason to swallow those.
          if (
            event.defaultPrevented ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
          ) {
            return;
          }
          event.preventDefault();
          void checkout.start({ plan, organizationId, source, properties });
        }}
        className={cn(
          checkout.pending && "pointer-events-none opacity-80",
          className,
        )}
      >
        {checkout.status === "pending"
          ? CHECKOUT_COPY.pending
          : checkout.status === "signin"
            ? CHECKOUT_COPY.signIn
            : label}
      </a>
      {checkout.error ? (
        <p
          role="alert"
          className={cn("mt-2 text-[12px] text-destructive", errorClassName)}
        >
          {CHECKOUT_COPY.error}
        </p>
      ) : null}
    </>
  );
}
