import Link from "next/link";

import { ScoreBadge } from "@/components/match/score-badge";
import { cn } from "@/lib/cn";
import type { ConsumerAccount, SessionUser } from "@/lib/types";

import { EmptyState, SectionHead } from "./section-head";

type Props = { session: SessionUser; account: ConsumerAccount };

export function ConsumerOverview({ session, account }: Props) {
  const isFree = session.plan === "free";
  const firstName = session.name.split(" ")[0] ?? session.name;
  const activeAlerts = account.alerts.filter((a) => a.on).length;

  const stats = [
    { l: "Saved trips", v: String(account.trips.length), cap: isFree ? "/ 3 on Free" : "/ unlimited" },
    { l: "Favourites", v: String(account.favourites.length), cap: "countries & regions" },
    { l: "Active alerts", v: String(activeAlerts), cap: `${account.alerts.length} total` },
    { l: "Last sign-in", v: "Today", cap: session.signedInAt.replace(/^Today · /, "") },
  ];

  return (
    <>
      <SectionHead
        eyebrow="Account"
        title={`Hello, ${firstName}.`}
        sub={`Member since ${session.memberSince} · ${session.email}`}
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
              : `Renews ${account.renewsAt ?? "—"} · ${account.price ?? "—"} · billed by Paddle`}
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

      <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4">
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

      <div className="rounded-md border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-text-subtle">
          <span>Recent activity</span>
          <span className="normal-case tracking-normal">last 30 days</span>
        </div>
        {account.activity.map((row, i) => (
          <div
            key={`${row.date}-${i}`}
            className="grid grid-cols-[80px_60px_1fr] items-center gap-4 border-b border-border px-5 py-3 text-[13px] last:border-b-0"
          >
            <div className="font-mono text-[11.5px] text-text-subtle">{row.date}</div>
            <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-accent">
              {row.tag}
            </div>
            <div className="text-text">{row.text}</div>
          </div>
        ))}
      </div>
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
          secondary="See an example trip"
          secondaryHref="/trip/trp_8h2k9p?view=public"
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
                  {t.country.slice(0, 3).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[17px] font-medium leading-[1.2] tracking-[-0.005em] text-text">
                    {t.title}
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] text-text-muted">
                    {t.country} · {t.months}
                  </div>
                </div>
                <ScoreBadge score={t.score} size="sm" />
              </div>
              <div className="mt-3 flex justify-between border-t border-border pt-2.5 font-mono text-[11px] text-text-subtle">
                <span>{t.regions} regions match</span>
                <span>updated {t.updated}</span>
              </div>
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
          {account.favourites.map((f) => (
            <Link
              key={f.slug}
              href={`/${f.slug}`}
              className="flex items-center gap-3.5 rounded-sm border border-border bg-surface px-4 py-3.5 no-underline"
            >
              <div className="h-[22px] w-8 rounded-sm border border-border bg-surface-2" aria-hidden="true" />
              <div className="flex-1">
                <div className="font-display text-[17px] font-medium tracking-[-0.005em] text-text">
                  {f.name}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-text-muted">{f.sub}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-subtle">
                  Best
                </div>
                <div className="mt-0.5 font-mono text-[11.5px] text-text">{f.best}</div>
              </div>
            </Link>
          ))}
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
        sub="Alerts run on every data refresh. Email by default; SMS available on Premium."
        action={
          <button
            type="button"
            className="rounded-sm bg-primary px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Create alert
          </button>
        }
      />
      {account.alerts.length === 0 ? (
        <EmptyState
          title="You don't have any alerts."
          body="Alerts are useful when you have a window in mind but the trip is months away. Set conditions, then forget about it."
          primary="Create your first alert"
          primaryHref="#"
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          {account.alerts.map((a) => (
            <div
              key={a.id}
              className={cn(
                "grid grid-cols-[1fr_110px_60px] items-center gap-4 border-b border-border px-5 py-4 last:border-b-0",
                a.on ? "" : "opacity-55",
              )}
            >
              <div>
                <div className="text-[13.5px] font-medium leading-[1.4] tracking-[-0.002em] text-text">
                  {a.label}
                </div>
                <div className="mt-1 font-mono text-[11px] text-text-subtle">{a.last}</div>
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">
                {a.cadence}
              </div>
              <div
                className={cn(
                  "relative h-[18px] w-8 rounded-full",
                  a.on ? "bg-score-perfect" : "bg-[#D9D6CD]",
                )}
                aria-label={a.on ? "Alert on" : "Alert off"}
                role="img"
              >
                <div
                  className={cn(
                    "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow",
                    a.on ? "left-4" : "left-0.5",
                  )}
                />
              </div>
            </div>
          ))}
        </div>
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

export function ConsumerBilling({ session, account }: Props) {
  const isFree = session.plan === "free";
  return (
    <>
      <SectionHead
        eyebrow="Billing"
        title={isFree ? "You're on Free." : "Premium · €2.99 / month"}
        sub={
          isFree
            ? "Upgrade for unlimited trips, four extra climate variables, and SMS alerts."
            : `Renews ${account.renewsAt ?? "—"}. All payment & invoice management lives in Paddle, our payment processor.`
        }
      />

      <div className="mb-6 grid gap-3.5 md:grid-cols-2">
        <BillingCard
          eyebrow="Current plan"
          title={isFree ? "Free · Consumer" : "Premium · Consumer"}
          sub={isFree ? "€0 · forever" : `€2.99 / month · since ${session.memberSince}`}
        />
        <BillingCard
          eyebrow={isFree ? "Status" : "Next renewal"}
          title={isFree ? "No active subscription" : account.renewsAt ?? "—"}
          sub={isFree ? "—" : "Auto-renew · card ending 4471"}
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
              Paddle handles billing for Atlas Weather. The portal opens in a new tab where you can:
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
            <div className="mt-4 flex gap-2.5">
              <a
                href="https://paddle.com"
                className="rounded-sm bg-primary px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-primary/90"
              >
                {isFree ? "Subscribe on Paddle ↗" : "Manage subscription on Paddle ↗"}
              </a>
            </div>
          </div>
        </div>
      </div>

      {!isFree && account.invoices.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-text-subtle">
            Recent invoices · cached from Paddle
          </div>
          <div className="overflow-hidden rounded-md border border-border bg-surface">
            {account.invoices.map((inv) => (
              <div
                key={inv.id}
                className="grid grid-cols-[110px_1fr_80px_80px_80px] items-center gap-3 border-b border-border px-5 py-2.5 text-[12px] last:border-b-0"
              >
                <div className="font-mono text-text-muted">{inv.date}</div>
                <div className="font-mono text-text">{inv.id}</div>
                <div className="text-right font-mono text-text">{inv.amount}</div>
                <div className="text-right font-mono text-[10.5px] uppercase tracking-[0.1em] text-score-perfect">
                  ● {inv.status.toUpperCase()}
                </div>
                <div className="text-right">
                  <a href="#" className="text-[11.5px] text-accent hover:underline">
                    PDF ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
