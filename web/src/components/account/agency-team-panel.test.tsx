/**
 * Seats, invitations, and what happens at the cap.
 *
 * The behaviour under test is WS-C item 4: **running out of seats is not an
 * error**. It is the moment the product asks to be paid, so the panel answers
 * it with the upgrade path rather than a red message — and it has to do so
 * both when it can see the cap coming and when a 409 arrives anyway, because a
 * colleague can fill the last seat in another tab between render and submit.
 *
 * The other boundary here is role: an agent sees the team and cannot change it.
 * That is not the enforcement — the API is, and `test_invites.py` pins it —
 * but a UI that offers controls the server will refuse teaches people to
 * distrust it.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import type { PendingInvite, TeamMember } from "@/lib/types";

import { AgencyTeamPanel } from "./agency-team-panel";

const inviteAgent = vi.fn();
const revokeInvite = vi.fn();
const removeMember = vi.fn();

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    inviteAgent: (...a: unknown[]) => inviteAgent(...a),
    revokeInvite: (...a: unknown[]) => revokeInvite(...a),
    removeMember: (...a: unknown[]) => removeMember(...a),
  };
});

const ORG_ID = "org-1";

const OWNER: TeamMember = {
  id: "m1",
  userId: "u1",
  name: "Ada Owner",
  email: "ada@example.com",
  role: "owner",
  joinedAt: "2026-01-01T00:00:00Z",
  you: true,
};

const AGENT: TeamMember = {
  id: "m2",
  userId: "u2",
  name: null,
  email: "bo@example.com",
  role: "agent",
  joinedAt: "2026-02-01T00:00:00Z",
  you: false,
};

const INVITE: PendingInvite = {
  id: "i1",
  email: "new@example.com",
  role: "agent",
  expiresAt: "2026-08-23T00:00:00Z",
  invitedAt: "2026-08-16T00:00:00Z",
};

function panel(props: Partial<React.ComponentProps<typeof AgencyTeamPanel>> = {}) {
  return (
    <AgencyTeamPanel
      orgId={ORG_ID}
      plan="agency_starter"
      canManage
      initialTeam={[OWNER, AGENT]}
      initialInvites={[]}
      seatCap={3}
      seatsUsed={2}
      {...props}
    />
  );
}

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("with seats free", () => {
  it("invites by email and shows the invitation as pending", async () => {
    inviteAgent.mockResolvedValue(INVITE);
    render(panel());

    await userEvent.type(
      screen.getByLabelText("Invite by email"),
      "new@example.com",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send invitation" }));

    expect(inviteAgent).toHaveBeenCalledWith(ORG_ID, {
      email: "new@example.com",
      role: "agent",
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Revoke the invitation to new@example.com",
        }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Invitation sent to");
    // The token is never shown — it went to the mailbox.
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
  });

  it("says how many seats are free before you spend one", () => {
    render(panel({ initialInvites: [INVITE] }));
    // Two members and one invitation against three seats: none left, so the
    // cap panel is what shows.
    expect(screen.getByTestId("seat-cap-upgrade")).toBeInTheDocument();
  });

  it("corrects a duplicate rather than offering an upgrade", async () => {
    inviteAgent.mockRejectedValue(
      new ApiError(409, "/orgs/x/invites", "already a member"),
    );
    render(panel());

    await userEvent.type(screen.getByLabelText("Invite by email"), "bo@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send invitation" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "already on your team",
      ),
    );
    expect(screen.queryByTestId("seat-cap-upgrade")).not.toBeInTheDocument();
  });
});

describe("at the seat cap", () => {
  it("shows the upgrade path instead of an invite form", () => {
    render(panel({ seatCap: 2, seatsUsed: 2 }));

    expect(screen.getByTestId("seat-cap-upgrade")).toBeInTheDocument();
    expect(screen.queryByLabelText("Invite by email")).not.toBeInTheDocument();
    const cta = screen.getByTestId("upgrade-cta");
    expect(cta).toHaveAttribute("data-plan", "agency_pro");
    expect(cta).toHaveAttribute("href", `/upgrade?plan=agency_pro&org=${ORG_ID}`);
  });

  it("answers a 409 from the API with the same upgrade path, not an error", async () => {
    // The race the render-time check cannot cover: the last seat went while
    // this form was open.
    inviteAgent.mockRejectedValue(
      new ApiError(409, "/orgs/x/invites", "seat cap reached"),
    );
    render(panel({ seatCap: 3, seatsUsed: 2 }));

    await userEvent.type(screen.getByLabelText("Invite by email"), "new@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send invitation" }));

    await waitFor(() =>
      expect(screen.getByTestId("seat-cap-upgrade")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("frees a seat again when an invitation is revoked", async () => {
    vi.stubGlobal("confirm", () => true);
    revokeInvite.mockResolvedValue(undefined);
    render(panel({ seatCap: 3, seatsUsed: 2, initialInvites: [INVITE] }));

    expect(screen.getByTestId("seat-cap-upgrade")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Revoke the invitation to new@example.com",
      }),
    );

    expect(revokeInvite).toHaveBeenCalledWith(ORG_ID, "i1");
    await waitFor(() =>
      expect(screen.getByLabelText("Invite by email")).toBeInTheDocument(),
    );
  });
});

describe("roles", () => {
  it("gives an agent the team list and no controls", () => {
    render(panel({ canManage: false, initialInvites: [INVITE] }));

    expect(screen.getByText("bo@example.com")).toBeInTheDocument();
    expect(screen.queryByLabelText("Invite by email")).not.toBeInTheDocument();
    expect(screen.queryByTestId("seat-cap-upgrade")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Revoke the invitation/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("never offers to remove the owner, or you", () => {
    render(panel());
    // Two rows, one Remove button: the agent's. The owner's row has none, and
    // neither does the caller's own.
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });

  it("removes a member and drops the row", async () => {
    vi.stubGlobal("confirm", () => true);
    removeMember.mockResolvedValue(undefined);
    render(panel());

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(removeMember).toHaveBeenCalledWith(ORG_ID, "m2");
    await waitFor(() =>
      expect(screen.queryByText("bo@example.com")).not.toBeInTheDocument(),
    );
  });
});
