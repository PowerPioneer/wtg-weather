import Link from "next/link";

import { cn } from "@/lib/cn";
import type { AgencyAccount, AgencyActivityRow, SessionUser } from "@/lib/types";

import { SectionHead } from "./section-head";

type Props = { session: SessionUser; account: AgencyAccount };

const KIND_CHIP: Record<AgencyActivityRow["kind"], string> = {
  SHARE: "text-accent",
  EDIT: "text-text-muted",
  CREATE: "text-score-perfect",
  EXPORT: "text-score-good",
  TEAM: "text-[#6B4FAE]",
  CLIENT: "text-text-muted",
  ALERT: "text-accent",
  BILLING: "text-text",
};

const PLAN_META: Record<
  string,
  { name: string; seatsCap: number; price: number; mrrLabel: string; prev?: string; next?: string }
> = {
  agency_starter: { name: "Agency Starter", seatsCap: 3, price: 49, mrrLabel: "€49 / mo", next: "Agency Pro" },
  agency_pro: {
    name: "Agency Pro",
    seatsCap: 10,
    price: 149,
    mrrLabel: "€149 / mo",
    prev: "Agency Starter",
    next: "Agency Enterprise",
  },
  agency_enterprise: {
    name: "Agency Enterprise",
    seatsCap: 50,
    price: 499,
    mrrLabel: "€499 / mo",
    prev: "Agency Pro",
  },
};

function planFor(session: SessionUser) {
  return PLAN_META[session.plan] ?? PLAN_META.agency_pro!;
}

function SeatMeter({ used, cap }: { used: number; cap: number }) {
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: cap }).map((_, i) => (
        <div
          key={i}
          className={cn("h-4 w-2.5 rounded-[1px]", i < used ? "bg-primary-foreground" : "bg-white/20")}
        />
      ))}
    </div>
  );
}

export function AgencyOverview({ session, account }: Props) {
  const plan = planFor(session);
  const org = session.org;
  if (!org) return null;
  const max = Math.max(...account.team.map((m) => m.trips));

  return (
    <>
      <SectionHead
        eyebrow="Organization"
        title={org.name}
        sub={`Owner: ${org.ownerName} · Member since ${org.memberSince} · atlasweather.io/o/${org.slug}`}
        action={
          <Link
            href="/account?s=settings"
            className="rounded-sm border border-border bg-white px-3 py-2 text-[12px] font-medium text-text hover:bg-surface-2"
          >
            Org settings
          </Link>
        }
      />

      <div className="mb-5 grid gap-7 rounded-md bg-primary p-6 text-primary-foreground md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#E0C98A]">
            Current plan
          </div>
          <div className="mt-1 font-display text-[26px] font-normal tracking-[-0.012em]">
            {plan.name}
          </div>
          <div className="mt-1 font-mono text-[12px] text-white/70">
            {plan.mrrLabel} · renews May 14 · VAT invoiced
          </div>
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/55">
            Seats
          </div>
          <div className="mb-1.5 flex items-baseline gap-1.5">
            <div className="font-display text-[26px]">{org.seatsUsed}</div>
            <div className="font-mono text-[12px] text-white/60">
              / {plan.seatsCap} · {plan.seatsCap - org.seatsUsed} available
            </div>
          </div>
          <SeatMeter used={org.seatsUsed} cap={plan.seatsCap} />
        </div>
        <div className="text-right">
          <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/55">
            Plan path
          </div>
          <div className="flex justify-end gap-2">
            {plan.prev && (
              <button
                type="button"
                className="rounded-sm border border-white/20 px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/10"
              >
                ← {plan.prev}
              </button>
            )}
            {plan.next && (
              <button
                type="button"
                className="rounded-sm bg-[#E0C98A] px-3 py-1.5 text-[12px] font-semibold text-primary"
              >
                {plan.next} →
              </button>
            )}
          </div>
          <div className="mt-2 font-mono text-[10.5px] text-white/50">
            All changes via Paddle · prorated
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-2 md:grid-cols-5">
        {[
          { l: "Active clients", v: account.clients.length, cap: `${account.archivedThisMonth} archived this month` },
          { l: "Trips YTD", v: account.tripsYTD, cap: "+28 vs. prior 110d" },
          { l: "Active trips", v: account.activeTrips, cap: "shared in last 30d" },
          { l: "Avg turnaround", v: "2.3d", cap: "client request → share" },
          { l: "MRR commit", v: plan.mrrLabel.replace(" / mo", ""), cap: `${plan.seatsCap} seats` },
        ].map((k) => (
          <div key={k.l} className="rounded-sm border border-border bg-surface px-3.5 py-3">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-subtle">
              {k.l}
            </div>
            <div className="mt-1 font-display text-[22px] font-normal tracking-[-0.012em] text-text">
              {k.v}
            </div>
            <div className="mt-0.5 font-mono text-[10.5px] text-text-muted">{k.cap}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3.5 md:grid-cols-2">
        <div className="rounded-md border border-border bg-surface">
          <div className="flex justify-between border-b border-border px-4 py-2.5">
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
              Top agents · last 30d
            </span>
            <span className="font-mono text-[10.5px] text-text-subtle">by trips authored</span>
          </div>
          {account.team
            .filter((m) => m.status === "active")
            .slice(0, 5)
            .map((m, i) => (
              <div
                key={m.id}
                className="grid grid-cols-[20px_1fr_120px_40px] items-center gap-3 border-b border-border px-4 py-2 text-[12.5px] last:border-b-0"
              >
                <div className="font-mono text-[10.5px] text-text-subtle">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>{m.name}</div>
                <div className="h-1 overflow-hidden rounded-sm bg-surface-2">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${(m.trips / max) * 100}%` }}
                  />
                </div>
                <div className="text-right font-mono text-text">{m.trips}</div>
              </div>
            ))}
        </div>

        <div className="rounded-md border border-border bg-surface">
          <div className="flex justify-between border-b border-border px-4 py-2.5">
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
              Activity · latest
            </span>
            <Link
              href="/account?s=activity"
              className="font-mono text-[11px] text-accent hover:underline"
            >
              View feed →
            </Link>
          </div>
          {account.activity.slice(0, 5).map((a, i) => (
            <div
              key={i}
              className="grid grid-cols-[70px_56px_1fr] items-baseline gap-2.5 border-b border-border px-4 py-2 text-[12.5px] last:border-b-0"
            >
              <div className="font-mono text-[10.5px] text-text-subtle">{a.t}</div>
              <div
                className={cn(
                  "inline-block w-fit rounded-sm border border-border bg-[#FCFBF8] px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-[0.1em]",
                  KIND_CHIP[a.kind],
                )}
              >
                {a.kind}
              </div>
              <div className="leading-[1.4]">
                <span className="font-medium text-text">{a.who}</span>{" "}
                <span className="text-text-muted">{a.act}</span>{" "}
                <span className="text-text">{a.obj}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function AgencyClients({ account }: Props) {
  return (
    <>
      <SectionHead
        eyebrow="Clients"
        title={`${account.clients.length} clients`}
        sub="Clients are the people you build trips for. Each trip links back to a client record."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-sm border border-border bg-white px-3 py-2 text-[12px] font-medium text-text hover:bg-surface-2"
            >
              Import CSV
            </button>
            <button
              type="button"
              className="rounded-sm bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              + New client
            </button>
          </div>
        }
      />

      <div className="mb-3 flex gap-2">
        <input
          placeholder="Search clients, trips, countries…"
          className="w-80 rounded-sm border border-border bg-white px-3 py-2 text-[12.5px]"
        />
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <div
          className="grid items-center gap-3 border-b border-border bg-[#FCFBF8] px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-subtle"
          style={{ gridTemplateColumns: "1.4fr 1fr 0.6fr 0.8fr 1fr 1fr 60px" }}
        >
          <div>Client</div>
          <div>Country</div>
          <div>Trips</div>
          <div>Last active</div>
          <div>Primary agent</div>
          <div>Tag</div>
          <div />
        </div>
        {account.clients.map((c) => (
          <div
            key={c.id}
            className="grid items-center gap-3 border-b border-border px-4 py-3 text-[12.5px] last:border-b-0"
            style={{ gridTemplateColumns: "1.4fr 1fr 0.6fr 0.8fr 1fr 1fr 60px" }}
          >
            <div>
              <Link
                href={`/account/clients/${c.id}`}
                className="font-display text-[16px] font-medium text-text hover:underline"
              >
                {c.name}
              </Link>
            </div>
            <div className="font-mono text-text-muted">{c.country}</div>
            <div className="font-mono text-text">{c.trips}</div>
            <div className="font-mono text-text-muted">{c.last}</div>
            <div>{c.agent}</div>
            <div>
              <span className="inline-block rounded-sm border border-border bg-[#FCFBF8] px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
                {c.tag}
              </span>
            </div>
            <div className="text-right">
              <Link
                href={`/account/clients/${c.id}`}
                className="font-mono text-[11px] text-accent hover:underline"
              >
                Open →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function AgencyTeam({ session, account }: Props) {
  const plan = planFor(session);
  const org = session.org;
  if (!org) return null;

  return (
    <>
      <SectionHead
        eyebrow="Team"
        title={`${org.seatsUsed} of ${plan.seatsCap} seats used`}
        sub="Invite agents and admins. Viewers see shared trips but can't edit."
        action={
          <button
            type="button"
            className="rounded-sm bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary/90"
            disabled={org.seatsUsed >= plan.seatsCap}
          >
            + Invite member
          </button>
        }
      />

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <div
          className="grid items-center gap-3 border-b border-border bg-[#FCFBF8] px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-subtle"
          style={{ gridTemplateColumns: "1.4fr 1.4fr 80px 0.8fr 60px 90px 60px" }}
        >
          <div>Name</div>
          <div>Email</div>
          <div>Role</div>
          <div>Last active</div>
          <div>Trips</div>
          <div>Status</div>
          <div />
        </div>
        {account.team.map((m) => (
          <div
            key={m.id}
            className="grid items-center gap-3 border-b border-border px-4 py-3 text-[12.5px] last:border-b-0"
            style={{ gridTemplateColumns: "1.4fr 1.4fr 80px 0.8fr 60px 90px 60px" }}
          >
            <div>
              <span className="text-text">{m.name}</span>
              {m.you && (
                <span className="ml-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-accent">
                  ● you
                </span>
              )}
            </div>
            <div className="font-mono text-text-muted">{m.email}</div>
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-text">
              {m.role}
            </div>
            <div className="font-mono text-text-muted">{m.last}</div>
            <div className="font-mono text-text">{m.trips}</div>
            <div
              className={cn(
                "font-mono text-[10.5px] uppercase tracking-[0.1em]",
                m.status === "active" ? "text-score-perfect" : "text-accent",
              )}
            >
              ● {m.status}
            </div>
            <div className="text-right text-text-subtle">⋯</div>
          </div>
        ))}
      </div>
    </>
  );
}

export function AgencyActivity({ account }: Props) {
  return (
    <>
      <SectionHead
        eyebrow="Activity"
        title="Team feed"
        sub="Everything that happened across clients, trips, and team — newest first."
      />
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        {account.activity.map((a, i) => (
          <div
            key={i}
            className="grid items-baseline gap-3 border-b border-border px-5 py-3 text-[13px] last:border-b-0"
            style={{ gridTemplateColumns: "90px 70px 1fr" }}
          >
            <div className="font-mono text-[11px] text-text-subtle">{a.t}</div>
            <div
              className={cn(
                "inline-block w-fit rounded-sm border border-border bg-[#FCFBF8] px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-[0.1em]",
                KIND_CHIP[a.kind],
              )}
            >
              {a.kind}
            </div>
            <div className="leading-[1.4]">
              <span className="font-medium text-text">{a.who}</span>{" "}
              <span className="text-text-muted">{a.act}</span>{" "}
              <span className="text-text">{a.obj}</span>
              {a.ctx && <span className="text-text-subtle"> · {a.ctx}</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function AgencyBranding() {
  return (
    <>
      <SectionHead
        eyebrow="Branding"
        title="White-label trip PDFs and share pages"
        sub="Upload your logo, set a trip-footer colour, map a custom domain. Currently in private beta."
      />
      <div className="relative overflow-hidden rounded-md border border-border bg-surface p-8">
        <div className="absolute right-5 top-5 rounded-sm bg-primary px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#E0C98A]">
          Coming · 2026 Q3
        </div>
        <fieldset disabled className="pointer-events-none opacity-60">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-text-subtle">
                Agency logo
              </div>
              <div className="flex h-20 items-center justify-center rounded-sm border border-dashed border-border bg-[#FCFBF8] text-[12px] text-text-muted">
                Drop SVG or PNG (max 1 MB)
              </div>
            </div>
            <div>
              <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-text-subtle">
                Accent colour
              </div>
              <input
                type="text"
                defaultValue="#B8763E"
                className="w-full rounded-sm border border-border bg-white px-3 py-2 font-mono text-[12px]"
              />
            </div>
            <div className="md:col-span-2">
              <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-text-subtle">
                Custom domain
              </div>
              <input
                type="text"
                placeholder="trips.your-agency.com"
                className="w-full rounded-sm border border-border bg-white px-3 py-2 font-mono text-[12px]"
              />
            </div>
          </div>
        </fieldset>
        <div className="mt-5 flex items-center gap-3 rounded-sm border border-accent bg-[#FBF3DC] px-3.5 py-3 text-[12.5px] text-text">
          <span>Want early access? We&apos;ll email a short preview in Q2 and open the waitlist first.</span>
          <button
            type="button"
            className="ml-auto rounded-sm bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground"
          >
            Join the waitlist
          </button>
        </div>
      </div>
    </>
  );
}

export function AgencyBilling({ session, account }: Props) {
  const plan = planFor(session);
  return (
    <>
      <SectionHead
        eyebrow="Billing"
        title={`${plan.name} · ${plan.mrrLabel}`}
        sub="Billed monthly by Paddle. VAT invoiced. Upgrades prorated to next renewal."
      />

      <div className="mb-5 grid gap-3.5 md:grid-cols-3">
        {[
          { l: "Monthly commit", v: plan.mrrLabel, cap: `${plan.seatsCap} seats cap` },
          { l: "Per-seat", v: `€${Math.round(plan.price / plan.seatsCap)}`, cap: "at plan cap" },
          { l: "Next renewal", v: "May 14, 2026", cap: "auto · card ending 4471" },
        ].map((k) => (
          <div key={k.l} className="rounded-md border border-border bg-surface p-4">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-subtle">
              {k.l}
            </div>
            <div className="mt-1 font-display text-[24px] tracking-[-0.012em] text-text">
              {k.v}
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-text-muted">{k.cap}</div>
          </div>
        ))}
      </div>

      <div className="mb-5 overflow-hidden rounded-md border border-border bg-surface">
        {Object.entries(PLAN_META).map(([key, p], i, arr) => {
          const current = key === session.plan;
          return (
            <div
              key={key}
              className={cn(
                "grid items-center gap-4 px-5 py-4",
                i !== arr.length - 1 && "border-b border-border",
                current ? "bg-[#FCFBF8]" : "",
              )}
              style={{ gridTemplateColumns: "1fr 100px 100px 120px" }}
            >
              <div>
                <div className="font-display text-[18px] font-medium text-text">{p.name}</div>
                <div className="mt-0.5 font-mono text-[11px] text-text-muted">
                  Up to {p.seatsCap} seats
                </div>
              </div>
              <div className="font-mono text-[13px] text-text">{p.mrrLabel}</div>
              <div className="font-mono text-[11px] text-text-muted">
                €{Math.round(p.price / p.seatsCap)} / seat
              </div>
              <div className="text-right">
                {current ? (
                  <span className="inline-block rounded-sm bg-primary px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#E0C98A]">
                    Current
                  </span>
                ) : (
                  <button
                    type="button"
                    className="rounded-sm border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-text hover:bg-surface-2"
                  >
                    {p.price > plan.price ? "Upgrade →" : "Downgrade"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
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
                style={{ gridTemplateColumns: "110px 1fr 80px 100px 80px" }}
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
        </>
      )}
    </>
  );
}
