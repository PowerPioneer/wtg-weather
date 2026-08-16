import Link from "next/link";

import { ScoreBadge } from "@/components/match/score-badge";
import { CHECKOUT_COPY, UpgradeButton } from "@/components/upgrade";
import type { BillingSummary } from "@/lib/billing-server";
import { cn } from "@/lib/cn";
import { firstName, monthYear, planLabel } from "@/lib/session-user";
import type { ConsumerAccount, SessionUser } from "@/lib/types";

import { AlertsList } from "./alerts-list";
import { ManageBillingButton } from "./manage-billing-button";
import { EmptyState, SectionHead } from "./section-head";

type Props = {
  session: SessionUser;
  account: ConsumerAccount;
  /**
   * Present only on the billing section. Null when the API could not be
   * reached — the section then reads as free rather than guessing at a plan,
   * which is the safe direction to be wrong in.
   */
  billing?: BillingSummary | null;
};

export function ConsumerOverview({ session, account }: Props) {
  const isFree = session.plan === "free";
  const activeAlerts = account.alerts.filter((a) => a.active).length;
  const since = monthYear(session.createdAt);

  const stats = [
    { l: "Saved trips", v: String(account.trips.length), cap: isFree ? "/ 3 on Free" : "/ unlimited" },
    { l: "Favourites", v: String(account.favourites.length), cap: "countries & regions" },
    { l: "Active alerts", v: String(activeAlerts), cap: `${account.alerts.length} total` },
    // There is no sign-in history to show: sessions are stateless signed
    // cookies, so the API has no last-seen timestamp to report. Account age is
    // something it does know.
    { l: "Member since", v: since ?? "—", cap: since ? "" : "date unavailable" },
  ];

  return (
    <>
      <SectionHead
        eyebrow="Account"
        title={`Hello, ${firstName(session)}.`}
        sub={[since && `Member since ${since}`, session.email].filter(Boolean).join(" · ")}
      />

      <div
        className={cn(
          "mb-6 flex items-center gap-6 rounded-md p-6",
          isFree ? "border border-border bg-[#FCFBF8] text-text" : "bg-primary text-primary-foreground",
        )}
      >
        <div className="flex-1">
          <div
            className={cn(
              "mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]",
              isFree ? "text-text-subtle" : "text-[#E0C98A]",
            )}
          >
            {isFree ? "Current plan" : "Premium · active"}
          </div>
          <div className="font-display text-[28px] font-normal tracking-[-0.012em]">
            {isFree ? "Free" : "Premium"}
          </div>
          <div
            className={cn(
              "mt-1 font-mono text-[12px]",
              isFree ? "text-text-muted" : "text-white/70",
            )}
          >
            {isFree
              ? "Map · 12 months · 6 free variables · 3 saved trips max"
              : "Billed by Paddle · manage renewal and invoices there"}
          </div>
        </div>
        {isFree ? (
          <Link
            href="/pricing"
            className="rounded-sm bg-primary px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            Upgrade · €2.99/mo →
          </Link>
        ) : (
          <a
            href="https://paddle.com"
            className="rounded-sm border border-white/30 px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-white/10"
          >
            Manage on Paddle ↗
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.l} className="rounded-sm border border-border bg-surface px-4 py-3.5">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-subtle">
              {s.l}
            </div>
            <div className="mt-1 font-display text-[30px] font-normal tracking-[-0.012em] text-text">
              {s.v}
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-text-muted">{s.cap}</div>
          </div>
        ))}
      </div>
      {/*
        The "Recent activity" feed that used to sit here was fixtures: the API
        keeps no event log, so there was nothing to render it from for a real
        user. Bringing it back means a table to write to, which is its own
        decision, not a side-effect of this page.
      */}
    </>
  );
}

export function ConsumerTrips({ session, account }: Props) {
  const isFree = session.plan === "free";
  return (
    <>
      <SectionHead
        eyebrow="Saved trips"
        title="Your trips"
        sub={
          isFree
            ? "Free plan · save up to 3 trips. They keep updating as climate data refreshes."
            : "Trips re-score whenever ERA5 or advisory data updates."
        }
        action={
          <Link
            href="/map"
            className="rounded-sm bg-primary px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            + New trip from map
          </Link>
        }
      />
      {account.trips.length === 0 ? (
        <EmptyState
          title="No saved trips yet."
          body="A trip is a saved combination of country, months, and what kind of weather you want. Open the map, set your preferences, hit Save."
          primary="Open the map"
          primaryHref="/map"
        />
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {account.trips.map((t) => (
            <Link
              key={t.id}
              href={`/trip/${t.id}`}
              className="block rounded-md border border-border bg-surface p-4 no-underline"
            >
              <div className="flex items-start gap-3.5">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-sm bg-surface-2 font-mono text-[11px] text-text-muted">
                  {(t.countryName ?? t.title).slice(0, 3).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[17px] font-medium leading-[1.2] tracking-[-0.005em] text-text">
                    {t.title}
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] text-text-muted">
                    {[t.countryName, t.monthName ?? "Year-round"].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {t.score !== null && <ScoreBadge score={t.score} size="sm" />}
              </div>
              {t.matchingRegions !== null && (
                <div className="mt-3 border-t border-border pt-2.5 font-mono text-[11px] text-text-subtle">
                  {t.matchingRegions} {t.matchingRegions === 1 ? "region" : "regions"} match
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export function ConsumerFavourites({ account }: Props) {
  return (
    <>
      <SectionHead
        eyebrow="Favourites"
        title="Pinned for quick access"
        sub="Star countries and regions on their pages. They appear here and feed your default alert scope."
      />
      {account.favourites.length === 0 ? (
        <EmptyState
          title="No favourites yet."
          body="Tap the star on any country or region page to pin it here. Useful when you have a shortlist of places you keep watching."
          primary="Browse countries"
          primaryHref="/"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {account.favourites.map((f) => {
            const body = (
              <>
                <div className="h-[22px] w-8 rounded-sm border border-border bg-surface-2" aria-hidden="true" />
                <div className="flex-1">
                  <div className="font-display text-[17px] font-medium tracking-[-0.005em] text-text">
                    {f.name}
                  </div>
                  {f.sub && (
                    <div className="mt-0.5 font-mono text-[11px] text-text-muted">{f.sub}</div>
                  )}
                </div>
                {f.best && (
                  <div className="text-right">
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-subtle">
                      Best
                    </div>
                    <div className="mt-0.5 font-mono text-[11.5px] text-text">{f.best}</div>
                  </div>
                )}
              </>
            );
            const className =
              "flex items-center gap-3.5 rounded-sm border border-border bg-surface px-4 py-3.5 no-underline";
            // A favourite whose country the registry cannot resolve still
            // lists — it is the user's row — but it has no page to link to.
            return f.href ? (
              <Link key={f.id} href={f.href} className={className}>
                {body}
              </Link>
            ) : (
              <div key={f.id} className={className}>
                {body}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export function ConsumerAlerts({ account }: Props) {
  return (
    <>
      <SectionHead
        eyebrow="Alerts"
        title="Tell me when conditions change."
        // Weekly because that is the cadence that exists: `weekly-alerts.sh`
        // runs the matcher Mondays at 04:00 UTC. The three cadences this page
        // used to offer were fixture labels with no job behind them.
        sub="Checked weekly against the latest climate and advisory data. One email per change."
      />
      {account.alerts.length === 0 ? (
        <EmptyState
          title="You don't have any alerts."
          body="Alerts are useful when you have a window in mind but the trip is months away. Set one from any country's month page, then forget about it."
          primary="Browse countries"
          primaryHref="/"
        />
      ) : (
        <AlertsList initial={account.alerts} />
      )}
    </>
  );
}

export function ConsumerSettings({ session }: Props) {
  const isFree = session.plan === "free";
  return (
    <>
      <SectionHead
        eyebrow="Settings"
        title="Account preferences"
        sub="Authentication is magic-link only. We never store passwords."
      />
      <div className="rounded-md border border-border bg-surface px-6">
        <SetRow label="Email" hint="Magic-link sign-in goes here. Changing it requires confirming on both addresses.">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={session.email}
              className="flex-1 rounded-sm border border-border bg-[#FCFBF8] px-3 py-2 font-mono text-[12px] text-text"
            />
            <button
              type="button"
              className="rounded-sm border border-border px-3.5 py-2 text-[12.5px] font-medium text-text hover:bg-surface-2"
            >
              Change email
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1.5 font-mono text-[11.5px] text-score-perfect">
            ● Verified · Last magic link sent today
          </div>
        </SetRow>

        <SetRow
          label="Google sign-in"
          hint="Optional. Lets you sign in with Google instead of waiting for a magic link."
        >
          <div className="flex items-center justify-between gap-3 rounded-sm border border-border bg-[#FCFBF8] px-3.5 py-2.5 text-[12.5px] text-text">
            <span>{isFree ? "Not connected" : `Connected as ${session.email}`}</span>
            <button
              type="button"
              className="rounded-sm border border-border bg-white px-3 py-1.5 font-medium hover:bg-surface-2"
            >
              {isFree ? "Connect Google" : "Disconnect"}
            </button>
          </div>
        </SetRow>

        <SetRow label="Language" hint="Affects copy in product, alerts, and email.">
          <select
            defaultValue="en"
            className="min-w-[220px] rounded-sm border border-border bg-white px-3 py-2 text-[12.5px]"
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="es">Español</option>
            <option value="de">Deutsch</option>
          </select>
        </SetRow>

        <SetRow label="Units" hint="Used everywhere temperatures, distances, and rainfall appear.">
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { l: "Temperature", opts: ["°C", "°F"], val: "°C" },
              { l: "Distance", opts: ["km", "mi"], val: "km" },
              { l: "Rainfall", opts: ["mm", "in"], val: "mm" },
            ].map((u) => (
              <div key={u.l}>
                <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-subtle">
                  {u.l}
                </div>
                <div className="flex overflow-hidden rounded-sm border border-border">
                  {u.opts.map((o) => (
                    <div
                      key={o}
                      className={cn(
                        "flex-1 py-1.5 text-center font-mono text-[12px]",
                        o === u.val ? "bg-primary text-primary-foreground" : "bg-white text-text-muted",
                      )}
                    >
                      {o}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SetRow>

        <SetRow
          label="Delete account"
          danger
          hint="Permanently deletes trips, favourites, alerts, and sessions. Active subscriptions are cancelled at end of period via Paddle."
        >
          <button
            type="button"
            className="rounded-sm border border-border px-3.5 py-2 text-[12.5px] font-medium text-destructive hover:bg-surface-2"
          >
            Delete my account
          </button>
        </SetRow>
      </div>
    </>
  );
}

/**
 * Billing. Three facts and two actions, and nothing invented.
 *
 * What is *not* here matters as much as what is. Renewal date, payment method
 * and invoice history all live at Paddle and reach us only through a portal
 * session, so this section links out for them rather than printing a copy. The
 * version it replaces printed "Next renewal: May 14, 2026 · card ending 4471"
 * from a fixture, to every subscriber, and its "Manage subscription" button
 * was an anchor to `https://paddle.com` — the company's homepage.
 */
export function ConsumerBilling({ session, billing }: Props) {
  // The summary is authoritative when we have it, because it is resolved from
  // the same organization the tile gate resolves from. When we don't — the API
  // blipped — fall back to the session rather than to "free": telling a paying
  // subscriber they are on the free plan because one fetch failed is the worse
  // of the two ways to be wrong here.
  const plan = billing?.plan ?? session.plan;
  const isFree = plan === "free";
  // A *known* absence of a Paddle subscription, which is different from not
  // knowing. Only the former justifies saying there is nothing to renew.
  const knownNoSubscription = billing != null && !billing.hasSubscription;
  const since = monthYear(session.createdAt);

  return (
    <>
      <SectionHead
        eyebrow="Billing"
        title={isFree ? "You're on Free." : "Premium · €2.99 / month"}
        sub={
          isFree
            ? "Upgrade for unlimited trips, four extra climate variables, and email alerts."
            : "All payment and invoice management lives in Paddle, our payment processor."
        }
      />

      <div className="mb-6 grid gap-3.5 md:grid-cols-2">
        <BillingCard
          eyebrow="Current plan"
          title={isFree ? "Free · Consumer" : `${planLabel(plan)} · Consumer`}
          sub={
            isFree
              ? "€0 · forever"
              : ["€2.99 / month", since && `since ${since}`].filter(Boolean).join(" · ")
          }
        />
        <BillingCard
          eyebrow="Status"
          title={
            isFree
              ? "No active subscription"
              : knownNoSubscription
                ? "Active · granted directly"
                : "Active"
          }
          sub={
            isFree
              ? "—"
              : knownNoSubscription
                ? // Premium with no Paddle subscription id is a comped or
                  // manually-granted plan. Saying so beats printing a renewal
                  // date that does not exist.
                  "Nothing to renew"
                : "Renewal date and invoices are on Paddle"
          }
        />
      </div>

      <div className="rounded-md border border-border bg-surface p-6">
        <div className="flex gap-6">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary font-sans text-[13px] font-bold text-primary-foreground">
            P
          </div>
          <div className="flex-1">
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-subtle">
              Paddle · payment processor
            </div>
            <div className="mt-1 font-display text-[22px] font-medium tracking-[-0.005em] text-text">
              {isFree ? "Subscribe through Paddle" : "Manage your subscription on Paddle"}
            </div>
            <p className="mt-2 max-w-[580px] text-[13px] leading-[1.55] text-text-muted">
              Paddle is our Merchant of Record and handles billing for Atlas
              Weather. From the customer portal you can:
            </p>
            <ul className="mt-2.5 list-disc space-y-1 pl-5 text-[12.5px] leading-[1.7] text-text">
              <li>Update payment method (card, PayPal, Apple Pay, SEPA)</li>
              <li>Download VAT invoices and the receipt history</li>
              <li>Switch between monthly and annual billing</li>
              <li>
                {isFree
                  ? "Start a Premium subscription"
                  : "Cancel · refund within 14 days · pause for up to 3 months"}
              </li>
            </ul>
            <div className="mt-4 flex flex-wrap items-start gap-2.5">
              {isFree ? (
                <UpgradeButton
                  plan="consumer_premium"
                  source="account_billing"
                  className="inline-flex items-center justify-center rounded-sm bg-primary px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-primary-hover"
                />
              ) : (
                <ManageBillingButton
                  label="Manage subscription on Paddle"
                  available={billing?.portalAvailable ?? false}
                />
              )}
            </div>
            {/*
              The portal is unreachable when no Paddle customer exists for the
              account, or when the environment has no API key. Saying which is
              not useful to the reader; saying that cancellation still works,
              and how, is.
            */}
            {!isFree && billing != null && !billing.portalAvailable && (
              <p className="mt-3 max-w-[580px] text-[12.5px] leading-[1.5] text-text-muted">
                The billing portal isn&rsquo;t available for this account right
                now. To cancel or change your plan, reply to your Paddle receipt
                email or get in touch and we&rsquo;ll do it for you.
              </p>
            )}
            {billing?.sandbox && (
              <p className="mt-3 font-mono text-[10.5px] text-text-subtle">
                {CHECKOUT_COPY.sandboxNote}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function SetRow({
  label,
  hint,
  children,
  danger,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="grid gap-6 border-b border-border py-5 last:border-b-0 md:grid-cols-[240px_1fr] md:gap-8">
      <div>
        <div
          className={cn("text-[13px] font-medium", danger ? "text-destructive" : "text-text")}
        >
          {label}
        </div>
        {hint && <div className="mt-1 text-[12px] leading-[1.45] text-text-muted">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function BillingCard({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-6 py-5">
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-subtle">
        {eyebrow}
      </div>
      <div className="mt-1.5 font-display text-[26px] font-normal tracking-[-0.012em] text-text">
        {title}
      </div>
      <div className="mt-1.5 font-mono text-[12px] text-text-muted">{sub}</div>
    </div>
  );
}
