/**
 * The agency dashboard sections, on real data.
 *
 * What is gone since the fixtures: an activity feed, per-agent "trips
 * authored" and "last active" columns, client country / primary-agent / tag
 * columns, and the invoice list. Nothing records any of them. They rendered as
 * confident tables of invented people — a worse failure on an agency's own
 * team page than an empty state, because an empty state is true.
 *
 * What replaced them is what the API can answer for: who is in the
 * organization, who has an invitation outstanding, what that costs in seats,
 * and the client records with their assigned trips.
 *
 * The tables live in client islands (`agency-team-panel`,
 * `agency-clients-panel`) so invite, revoke and create work; they still render
 * their rows during SSR, so the page is readable before hydration.
 */

import Link from "next/link";

import { UpgradeButton } from "@/components/upgrade";
import { cn } from "@/lib/cn";
import { monthYear, planLabel } from "@/lib/session-user";
import type { AgencyAccount, SessionUser } from "@/lib/types";

import { AgencyClientsPanel } from "./agency-clients-panel";
import { nextAgencyPlan } from "./agency-plan";
import { AgencyTeamPanel } from "./agency-team-panel";
import { SectionHead } from "./section-head";

type Props = { session: SessionUser; account: AgencyAccount };

export function SeatMeter({
  used,
  pending,
  cap,
  tone = "dark",
}: {
  used: number;
  pending: number;
  cap: number;
  tone?: "dark" | "light";
}) {
  // A cap of 9,999 (Enterprise) is not a meter anyone wants to look at.
  const cells = Math.min(cap, 12);
  if (cells <= 0) return null;
  return (
    <div className="flex gap-[3px]" aria-hidden="true">
      {Array.from({ length: cells }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-4 w-2.5 rounded-[1px]",
            i < used
              ? tone === "dark"
                ? "bg-primary-foreground"
                : "bg-primary"
              : i < used + pending
                ? tone === "dark"
                  ? "bg-white/50"
                  : "bg-accent"
                : tone === "dark"
                  ? "bg-white/20"
                  : "bg-border",
          )}
        />
      ))}
    </div>
  );
}

export function AgencyOverview({ session, account }: Props) {
  const org = session.org;
  if (!org) return null;

  const since = monthYear(org.createdAt);
  const upgrade = nextAgencyPlan(session.plan);
  const available = Math.max(account.seatCap - account.seatsUsed - account.seatsPending, 0);

  return (
    <>
      <SectionHead
        eyebrow="Organization"
        title={org.name}
        sub={[
          `Seats ${account.seatsUsed}/${account.seatCap}`,
          since && `Created ${since}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      <div className="mb-5 grid gap-7 rounded-md bg-primary p-6 text-primary-foreground md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#E0C98A]">
            Current plan
          </div>
          <div className="mt-1 font-display text-[26px] font-normal tracking-[-0.012em]">
            {planLabel(session.plan)}
          </div>
          {/* No renewal date and no card: both live at Paddle, and the billing
              section links out to the portal for them rather than printing a
              stale copy here. */}
          <div className="mt-1 font-mono text-[12px] text-white/70">
            Billed by Paddle · VAT invoiced
          </div>
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/55">
            Seats
          </div>
          <div className="mb-1.5 flex items-baseline gap-1.5">
            <div className="font-display text-[26px]">{account.seatsUsed}</div>
            <div className="font-mono text-[12px] text-white/60">
              / {account.seatCap} ·{" "}
              {account.seatsPending > 0
                ? `${account.seatsPending} invited · ${available} free`
                : `${available} available`}
            </div>
          </div>
          <SeatMeter
            used={account.seatsUsed}
            pending={account.seatsPending}
            cap={account.seatCap}
          />
        </div>
        <div className="text-right">
          <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/55">
            Plan path
          </div>
          {upgrade ? (
            <UpgradeButton
              plan={upgrade}
              organizationId={org.id}
              source="account_overview_agency"
              properties={{ from: session.plan, to: upgrade }}
              label={`${planLabel(upgrade)} →`}
              className="inline-block rounded-sm bg-[#E0C98A] px-3 py-1.5 text-[12px] font-semibold text-primary"
              errorClassName="text-[#F5C9C9]"
            />
          ) : (
            <a
              href="mailto:hello@wheretogoforgreatweather.com?subject=Agency%20plan"
              className="inline-block rounded-sm border border-white/20 px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/10"
            >
              Talk to us
            </a>
          )}
          <div className="mt-2 font-mono text-[10.5px] text-white/50">
            All changes via Paddle · prorated
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-2 md:grid-cols-3">
        <Kpi
          label="Clients"
          value={account.clients.length}
          cap="records your team plans against"
        />
        <Kpi
          label="Team"
          value={account.team.length}
          cap={`${account.seatCap - account.seatsUsed} seats unfilled`}
        />
        <Kpi
          label="Invitations out"
          value={account.seatsPending}
          cap={
            account.seatsPending > 0
              ? "each holds a seat until accepted"
              : "nobody is waiting on a link"
          }
        />
      </div>

      <div className="grid gap-3.5 md:grid-cols-2">
        <QuickCard
          title="Clients"
          body="Every trip your team builds can be filed against a client record, with the notes that explain it."
          href="/account?s=clients"
          cta="Open clients →"
        />
        <QuickCard
          title="Team"
          body="Invite agents by email. An invitation holds a seat until it is accepted or revoked."
          href="/account?s=team"
          cta="Manage team →"
        />
      </div>
    </>
  );
}

function Kpi({
  label,
  value,
  cap,
}: {
  label: string;
  value: number | string;
  cap: string;
}) {
  return (
    <div className="rounded-sm border border-border bg-surface px-3.5 py-3">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-subtle">
        {label}
      </div>
      <div className="mt-1 font-display text-[22px] font-normal tracking-[-0.012em] text-text">
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[10.5px] text-text-muted">{cap}</div>
    </div>
  );
}

function QuickCard({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <div className="font-display text-[18px] font-medium tracking-[-0.005em] text-text">
        {title}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-[1.55] text-text-muted">{body}</p>
      <Link
        href={href}
        className="mt-3 inline-block font-mono text-[11px] text-accent hover:underline"
      >
        {cta}
      </Link>
    </div>
  );
}

export function AgencyClients({ session, account }: Props) {
  const org = session.org;
  if (!org) return null;
  return (
    <>
      <SectionHead
        eyebrow="Clients"
        title={
          account.clients.length === 1
            ? "1 client"
            : `${account.clients.length} clients`
        }
        sub="Clients are the people you build trips for. Each trip can link back to a client record."
      />
      <AgencyClientsPanel orgId={org.id} initial={account.clients} />
    </>
  );
}

export function AgencyTeam({ session, account }: Props) {
  const org = session.org;
  if (!org) return null;
  const canManage = session.role === "owner" || session.role === "admin";

  return (
    <>
      <SectionHead
        eyebrow="Team"
        title={`${account.seatsUsed} of ${account.seatCap} seats used`}
        sub={
          account.seatsPending > 0
            ? `${account.seatsPending} invitation${account.seatsPending === 1 ? "" : "s"} outstanding — each one holds a seat until it is accepted or revoked.`
            : "Invite agents by email. They get a one-time link that signs them in."
        }
      />
      <AgencyTeamPanel
        orgId={org.id}
        plan={session.plan}
        canManage={canManage}
        initialTeam={account.team}
        initialInvites={account.invites}
        seatCap={account.seatCap}
        seatsUsed={account.seatsUsed}
      />
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
          <span>
            Want early access? We&apos;ll email a short preview in Q2 and open the
            waitlist first.
          </span>
        </div>
      </div>
    </>
  );
}
