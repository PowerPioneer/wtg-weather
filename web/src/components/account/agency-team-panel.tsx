"use client";

/**
 * The team table, with seats and invitations live.
 *
 * Rows are handed in from the server render (`initialTeam` / `initialInvites`)
 * so the section paints in the first response and reads correctly before
 * hydration; what JS adds is inviting, revoking and removing.
 *
 * The seat cap is the interesting part. Running out of seats is not an error —
 * it is the moment the product asks to be paid — so the form does not throw a
 * red toast at it. At the cap the invite control is replaced by the upgrade
 * path (WS-B's `UpgradeButton`, so checkout is the same handoff everywhere),
 * and a 409 that arrives anyway — because a colleague filled the last seat in
 * another tab — renders the same prompt rather than "something went wrong".
 */

import { useState } from "react";

import { UpgradeButton } from "@/components/upgrade";
import {
  ALREADY_INVITED_DETAIL,
  ALREADY_MEMBER_DETAIL,
  ApiError,
  inviteAgent,
  isSeatCapReached,
  isUnauthorized,
  removeMember,
  revokeInvite,
} from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { planLabel } from "@/lib/session-user";
import type { AccountPlan, AccountRole, PendingInvite, TeamMember } from "@/lib/types";

import { nextAgencyPlan } from "./agency-plan";

const ROLE_LABEL: Record<AccountRole, string> = {
  owner: "Owner",
  admin: "Admin",
  agent: "Agent",
  member: "Member",
};

/** Roles an owner may hand out. Ownership is not one of them — there is no
 *  transfer flow yet, and an org with two owners and no way to demote one is a
 *  support ticket rather than a feature. */
const INVITABLE: readonly AccountRole[] = ["admin", "agent", "member"];

export type AgencyTeamPanelProps = {
  orgId: string;
  plan: AccountPlan;
  /** Owner or admin. An agent sees the team and cannot change it. */
  canManage: boolean;
  initialTeam: readonly TeamMember[];
  initialInvites: readonly PendingInvite[];
  seatCap: number;
  seatsUsed: number;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function AgencyTeamPanel({
  orgId,
  plan,
  canManage,
  initialTeam,
  initialInvites,
  seatCap,
  seatsUsed,
}: AgencyTeamPanelProps) {
  const [team, setTeam] = useState<readonly TeamMember[]>(initialTeam);
  const [invites, setInvites] = useState<readonly PendingInvite[]>(initialInvites);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AccountRole>("agent");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [atCap, setAtCap] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const used = team.length || seatsUsed;
  const available = Math.max(seatCap - used - invites.length, 0);
  const capReached = atCap || available <= 0;
  const upgrade = nextAgencyPlan(plan);

  function fail(err: unknown, fallback: string) {
    if (isSeatCapReached(err)) {
      setAtCap(true);
      setError(null);
      return;
    }
    if (isUnauthorized(err)) {
      setError("Your session expired. Sign in again.");
      return;
    }
    if (err instanceof ApiError && err.detail === ALREADY_MEMBER_DETAIL) {
      setError("That address is already on your team.");
      return;
    }
    if (err instanceof ApiError && err.detail === ALREADY_INVITED_DETAIL) {
      setError("There's already an invitation out to that address.");
      return;
    }
    setError(fallback);
  }

  async function submitInvite(event: React.FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    setBusy("invite");
    setError(null);
    setSentTo(null);
    try {
      const invite = await inviteAgent(orgId, { email: address, role });
      setInvites((rows) => [...rows, invite]);
      setEmail("");
      setSentTo(invite.email);
    } catch (err) {
      fail(err, "Couldn't send that invitation. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function revoke(invite: PendingInvite) {
    if (!window.confirm(`Revoke the invitation to ${invite.email}?`)) return;
    setBusy(invite.id);
    setError(null);
    try {
      await revokeInvite(orgId, invite.id);
      setInvites((rows) => rows.filter((r) => r.id !== invite.id));
      // The seat is free again, so the form comes back.
      setAtCap(false);
    } catch (err) {
      fail(err, "Couldn't revoke that invitation. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(member: TeamMember) {
    const who = member.name ?? member.email;
    if (!window.confirm(`Remove ${who} from the organisation?`)) return;
    setBusy(member.id);
    setError(null);
    try {
      await removeMember(orgId, member.id);
      setTeam((rows) => rows.filter((r) => r.id !== member.id));
      setAtCap(false);
    } catch (err) {
      fail(err, "Couldn't remove that member. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {canManage && (
        <div className="mb-5 rounded-md border border-border bg-surface p-4">
          {capReached ? (
            <div data-testid="seat-cap-upgrade">
              <div className="font-display text-[17px] font-medium text-text">
                Every seat on {planLabel(plan)} is spoken for
              </div>
              <p className="mt-1 max-w-[560px] text-[12.5px] leading-[1.55] text-text-muted">
                {invites.length > 0
                  ? `${used} in the team and ${invites.length} invitation${invites.length === 1 ? "" : "s"} outstanding, against ${seatCap} seats. Revoke an invitation to free one up, or move to a bigger plan.`
                  : `${used} of ${seatCap} seats filled. Move to a bigger plan to invite more agents.`}
              </p>
              {upgrade && (
                <div className="mt-3">
                  <UpgradeButton
                    plan={upgrade}
                    organizationId={orgId}
                    source="account_team_seat_cap"
                    properties={{ from: plan, to: upgrade, seats: seatCap }}
                    label={`Move to ${planLabel(upgrade)} →`}
                    className="inline-block rounded-sm bg-primary px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-primary/90"
                  />
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={submitInvite} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <label
                  htmlFor="invite-email"
                  className="mb-1 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-subtle"
                >
                  Invite by email
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  autoComplete="off"
                  placeholder="agent@your-agency.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-sm border border-border bg-white px-3 py-2 text-[12.5px]"
                />
              </div>
              <div>
                <label
                  htmlFor="invite-role"
                  className="mb-1 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-subtle"
                >
                  Role
                </label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as AccountRole)}
                  className="rounded-sm border border-border bg-white px-3 py-2 text-[12.5px]"
                >
                  {INVITABLE.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={busy === "invite"}
                className="rounded-sm bg-primary px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {busy === "invite" ? "Sending…" : "Send invitation"}
              </button>
              <p className="w-full font-mono text-[10.5px] text-text-subtle">
                {available} seat{available === 1 ? "" : "s"} free. The link works
                once and expires in 7 days.
              </p>
            </form>
          )}
        </div>
      )}

      {sentTo && (
        <p role="status" className="mb-3 text-[12.5px] text-text-muted">
          Invitation sent to <span className="font-mono">{sentTo}</span>.
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 font-mono text-[11.5px] text-destructive">
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse overflow-hidden rounded-md border border-border bg-surface text-left">
          <caption className="sr-only">Members of this organisation</caption>
          <thead>
            <tr className="border-b border-border bg-[#FCFBF8] font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-subtle">
              <th scope="col" className="px-4 py-2 font-medium">
                Name
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Email
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Role
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Joined
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {team.map((m) => (
              <tr key={m.id} className="border-b border-border text-[12.5px] last:border-b-0">
                <td className="px-4 py-3 text-text">
                  {m.name ?? "—"}
                  {m.you && (
                    <span className="ml-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-accent">
                      ● you
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-text-muted">{m.email}</td>
                <td className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-text">
                  {ROLE_LABEL[m.role]}
                </td>
                <td className="px-4 py-3 font-mono text-text-muted">
                  {formatDate(m.joinedAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  {canManage && m.role !== "owner" && !m.you && (
                    <button
                      type="button"
                      onClick={() => remove(m)}
                      disabled={busy === m.id}
                      className="rounded-sm border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:bg-surface-2 disabled:opacity-60"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <div className="mb-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
          Pending invitations
        </div>
        {invites.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-strong bg-[#FCFBF8] px-4 py-5 text-[12.5px] text-text-muted">
            Nobody is waiting on a link.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-md border border-border bg-surface">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-[12.5px] last:border-b-0",
                )}
              >
                <span className="font-mono text-text">{invite.email}</span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-subtle">
                  {ROLE_LABEL[invite.role]}
                </span>
                <span className="font-mono text-[11px] text-text-muted">
                  expires {formatDate(invite.expiresAt)}
                </span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => revoke(invite)}
                    disabled={busy === invite.id}
                    aria-label={`Revoke the invitation to ${invite.email}`}
                    className="ml-auto rounded-sm border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:bg-surface-2 disabled:opacity-60"
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
