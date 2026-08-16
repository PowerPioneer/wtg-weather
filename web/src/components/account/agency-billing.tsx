/**
 * Agency billing. Lifted out of `agency-sections.tsx` because it is the one
 * agency surface WS-B owns — the rest of that file is WS-C's real-data work
 * and is deliberately left alone here.
 *
 * Three fabrications are gone with the move:
 *
 *   - "Next renewal: May 14, 2026 · auto · card ending 4471", printed to every
 *     agency from a literal. The renewal date and the card live at Paddle and
 *     reach us only through a portal session.
 *   - The plan ladder's Upgrade / Downgrade buttons, which had no handler at
 *     all — a `<button type="button">` with no `onClick`, so clicking the plan
 *     you wanted to move to did nothing, silently.
 *   - Prices of €49 and €149, against the pricing page's €39 and €99. The
 *     ladder now reads the same tier data the pricing page does, so there is
 *     one place a price can be wrong instead of two.
 *
 * The invoice list stays fixture-backed via `account.invoices` and is only
 * rendered when there is something in it — WS-C owns the agency data path, and
 * with `WTG_USE_MOCK_DATA` off that array is empty, so nothing fabricated
 * renders in production.
 */

import { allTiers } from "@/components/upgrade";
import { UpgradeButton } from "@/components/upgrade";
import type { BillingSummary } from "@/lib/billing-server";
import { cn } from "@/lib/cn";
import { planLabel } from "@/lib/session-user";
import type { AccountPlan, AgencyAccount, SessionUser, Tier } from "@/lib/types";

import { ManageBillingButton } from "./manage-billing-button";
import { SectionHead } from "./section-head";

export type AgencyBillingProps = {
  session: SessionUser;
  account: AgencyAccount;
  billing?: BillingSummary | null;
};

/** The agency ladder, in order, from the same tier table as `/pricing`. */
const LADDER: readonly { plan: AccountPlan; tierId: Tier["id"]; seats: number }[] = [
  { plan: "agency_starter", tierId: "starter", seats: 3 },
  { plan: "agency_pro", tierId: "pro", seats: 10 },
  { plan: "agency_enterprise", tierId: "enterprise", seats: 0 },
];

function tierFor(tierId: Tier["id"]): Tier | undefined {
  return allTiers().find((t) => t.id === tierId);
}

function priceLabel(tier: Tier | undefined): string {
  if (!tier) return "—";
  if (tier.price.monthly == null) return tier.priceDisplay ?? "Custom";
  return `€${tier.price.monthly} / mo`;
}

export function AgencyBilling({ session, account, billing }: AgencyBillingProps) {
  const currentPlan = billing?.plan ?? session.plan;
  const current = LADDER.find((row) => row.plan === currentPlan);
  const currentTier = current ? tierFor(current.tierId) : undefined;
  // Seat cap comes from the org record, which the webhook sets from the plan —
  // not from a table in this file that could disagree with it.
  const seatCap = billing?.seatCap ?? session.org?.seatCap ?? current?.seats ?? 0;

  return (
    <>
      <SectionHead
        eyebrow="Billing"
        title={`${planLabel(currentPlan)} · ${priceLabel(currentTier)}`}
        sub="Billed monthly by Paddle, VAT invoiced. Renewal date, payment method and invoices live in the Paddle customer portal."
      />

      <div className="mb-5 grid gap-3.5 md:grid-cols-3">
        <Kpi
          label="Monthly commit"
          value={priceLabel(currentTier)}
          cap={`${seatCap} seat cap`}
        />
        <Kpi
          label="Seats used"
          value={`${account.team.length} / ${seatCap || "—"}`}
          cap={
            seatCap > 0 && account.team.length >= seatCap
              ? "at cap — upgrade to add more"
              : "across your organisation"
          }
        />
        <Kpi
          label="Subscription"
          value={billing?.hasSubscription ? "Active" : "None on file"}
          cap={
            billing?.hasSubscription
              ? "renewal date is on Paddle"
              : "granted directly — nothing to renew"
          }
        />
      </div>

      <div className="mb-5 overflow-hidden rounded-md border border-border bg-surface">
        {LADDER.map((row, i) => {
          const tier = tierFor(row.tierId);
          const isCurrent = row.plan === currentPlan;
          return (
            <div
              key={row.plan}
              className={cn(
                "grid items-center gap-4 px-5 py-4",
                i !== LADDER.length - 1 && "border-b border-border",
                isCurrent && "bg-[#FCFBF8]",
              )}
              style={{ gridTemplateColumns: "1fr 110px 200px" }}
            >
              <div>
                <div className="font-display text-[18px] font-medium text-text">
                  {planLabel(row.plan)}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-text-muted">
                  {row.seats > 0 ? `Up to ${row.seats} seats` : "Unlimited seats"}
                </div>
              </div>
              <div className="font-mono text-[13px] text-text">{priceLabel(tier)}</div>
              <div className="flex justify-end text-right">
                {isCurrent ? (
                  <span className="inline-block rounded-sm bg-primary px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#E0C98A]">
                    Current
                  </span>
                ) : row.plan === "agency_enterprise" ? (
                  // No self-serve plan behind Enterprise — it is a
                  // conversation, and a button that opened a checkout for it
                  // would be a checkout for a price nobody has agreed.
                  <a
                    href="mailto:hello@wheretogoforgreatweather.com?subject=Agency%20Enterprise"
                    className="rounded-sm border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-text hover:bg-surface-2"
                  >
                    Contact sales
                  </a>
                ) : (
                  <UpgradeButton
                    plan={row.plan === "agency_pro" ? "agency_pro" : "agency_starter"}
                    organizationId={session.org?.id}
                    source="account_billing_agency"
                    properties={{ from: currentPlan, to: row.plan }}
                    label="Change plan →"
                    className="rounded-sm border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-text hover:bg-surface-2"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-5">
        <ManageBillingButton
          label="Manage subscription on Paddle"
          available={billing?.portalAvailable ?? false}
          variant="secondary"
        />
        {billing && !billing.portalAvailable && (
          <p className="mt-2 max-w-[580px] text-[12.5px] leading-[1.5] text-text-muted">
            The billing portal isn&rsquo;t available for this organisation right
            now. To cancel or change payment details, reply to your Paddle
            receipt or get in touch.
          </p>
        )}
      </div>

      {account.invoices.length > 0 && (
        <>
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-text-subtle">
            Invoice history · cached from Paddle
          </div>
          <div className="overflow-hidden rounded-md border border-border bg-surface">
            {account.invoices.map((inv) => (
              <div
                key={inv.id}
                className="grid items-center gap-3 border-b border-border px-5 py-2.5 text-[12px] last:border-b-0"
                style={{ gridTemplateColumns: "110px 1fr 80px 100px" }}
              >
                <div className="font-mono text-text-muted">{inv.date}</div>
                <div className="font-mono text-text">{inv.id}</div>
                <div className="text-right font-mono text-text">{inv.amount}</div>
                <div className="text-right font-mono text-[10.5px] uppercase tracking-[0.1em] text-score-perfect">
                  ● {inv.status.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
          {/*
            The per-row "PDF ↗" link used to point at `#`. Invoice PDFs are
            Paddle-hosted behind a portal session, so there is no URL to put
            here — the portal button above is the way to them.
          */}
        </>
      )}
    </>
  );
}

function Kpi({ label, value, cap }: { label: string; value: string; cap: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-subtle">
        {label}
      </div>
      <div className="mt-1 font-display text-[24px] tracking-[-0.012em] text-text">
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-text-muted">{cap}</div>
    </div>
  );
}
