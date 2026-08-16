"""Agency seat invitations, failure paths first.

Accepting an invitation issues a session, which makes this an auth surface and
puts it under the "must have a failure-path test" rule in `api/CLAUDE.md`. The
boundaries pinned here are the ones where getting it wrong hands somebody a
seat, an account, or another agency's data:

  reuse · expiry · revocation · forgery · the seat cap on both sides of accept.

Email never leaves the process: the `outbox` fixture replaces the provider.
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from tests.conftest import login
from wtg_api.models import Invitation, Membership, Organization, Role, User

TOKEN_RE = re.compile(r"/invite\?token=([\w\-.]+)")


def token_from(outbox: list) -> str:
    """Pull the token out of the mail, rather than minting one in the test.

    That way the assertion covers the link an invitee actually receives — a
    token the tests generate themselves would keep passing if the email
    carried the wrong one, or none.
    """
    assert outbox, "no invitation email was sent"
    match = TOKEN_RE.search(outbox[-1].text)
    assert match, f"no invite link in: {outbox[-1].text!r}"
    return match.group(1)


async def invite(
    client: AsyncClient, org_id, email: str, role: str = "agent"
) -> "object":
    return await client.post(
        f"/api/orgs/{org_id}/invites", json={"email": email, "role": role}
    )


# --- Sending ---


@pytest.mark.asyncio
async def test_invite_creates_a_pending_invitation_and_no_account(
    client: AsyncClient, sessionmaker, agency, outbox
) -> None:
    owner, org = agency
    login(client, owner)

    r = await invite(client, org.id, "Agent@Example.com")
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "agent@example.com"  # lower-cased on the way in
    assert body["role"] == "agent"

    # The old behaviour: a `User` row and a membership, conjured for an address
    # that had agreed to nothing. Neither exists until the token is opened.
    async with sessionmaker() as session:
        members = (
            await session.execute(
                select(Membership).where(Membership.organization_id == org.id)
            )
        ).scalars().all()
        assert len(members) == 1  # the owner's, and only the owner's
        assert (
            await session.execute(
                select(User).where(User.email == "agent@example.com")
            )
        ).scalar_one_or_none() is None

    assert len(outbox) == 1
    assert outbox[0].to == "agent@example.com"


@pytest.mark.asyncio
async def test_invite_response_never_carries_the_token(
    client: AsyncClient, agency, outbox
) -> None:
    """The token is a bearer credential for a mailbox; it belongs in the mailbox.

    An owner who could read it from the API response could take the seat
    themselves, or hand the link to somebody the invitation was not addressed
    to — which is precisely the check the token exists to perform.
    """
    owner, org = agency
    login(client, owner)
    r = await invite(client, org.id, "agent@example.com")
    assert token_from(outbox) not in r.text
    assert "token" not in r.json()


@pytest.mark.asyncio
async def test_invite_email_is_redacted_in_logs(
    client: AsyncClient, agency, outbox, caplog
) -> None:
    owner, org = agency
    login(client, owner)
    with caplog.at_level(logging.INFO):
        await invite(client, org.id, "private.person@example.com")
    logged = "\n".join(record.getMessage() for record in caplog.records)
    assert "private.person@example.com" not in logged
    assert "@example.com" in logged  # the domain survives; the local part does not


# --- The seat cap ---


@pytest.mark.asyncio
async def test_pending_invitations_count_against_the_cap(
    client: AsyncClient, agency, outbox
) -> None:
    """Three seats: the owner, plus two invitations, and the third is refused.

    Counting memberships alone would let a Starter agency invite ten people and
    end up with ten members — the cap would exist only until somebody tested it.
    """
    owner, org = agency
    login(client, owner)

    assert (await invite(client, org.id, "one@example.com")).status_code == 201
    assert (await invite(client, org.id, "two@example.com")).status_code == 201

    r = await invite(client, org.id, "three@example.com")
    assert r.status_code == 409
    assert r.json()["detail"] == "seat cap reached"
    # Refused before the mail went out.
    assert [m.to for m in outbox] == ["one@example.com", "two@example.com"]


@pytest.mark.asyncio
async def test_revoking_an_invitation_frees_its_seat(
    client: AsyncClient, agency, outbox
) -> None:
    owner, org = agency
    login(client, owner)
    first = (await invite(client, org.id, "one@example.com")).json()
    await invite(client, org.id, "two@example.com")
    assert (await invite(client, org.id, "three@example.com")).status_code == 409

    r = await client.delete(f"/api/orgs/{org.id}/invites/{first['id']}")
    assert r.status_code == 204
    assert (await invite(client, org.id, "three@example.com")).status_code == 201


@pytest.mark.asyncio
async def test_cannot_invite_the_same_address_twice(
    client: AsyncClient, agency, outbox
) -> None:
    owner, org = agency
    login(client, owner)
    assert (await invite(client, org.id, "one@example.com")).status_code == 201
    r = await invite(client, org.id, "ONE@example.com")
    assert r.status_code == 409
    assert r.json()["detail"] == "invitation already pending"


@pytest.mark.asyncio
async def test_cannot_invite_an_existing_member(
    client: AsyncClient, agency, outbox
) -> None:
    owner, org = agency
    login(client, owner)
    r = await invite(client, org.id, owner.email)
    assert r.status_code == 409
    assert r.json()["detail"] == "already a member"


@pytest.mark.asyncio
async def test_agent_cannot_invite_or_revoke(
    client: AsyncClient, sessionmaker, agency, outbox
) -> None:
    owner, org = agency
    login(client, owner)
    pending = (await invite(client, org.id, "one@example.com")).json()

    async with sessionmaker() as session:
        agent = User(email="worker@example.com")
        session.add(agent)
        await session.flush()
        session.add(
            Membership(user_id=agent.id, organization_id=org.id, role=Role.agent)
        )
        await session.commit()
        await session.refresh(agent)

    client.cookies.clear()
    login(client, agent)
    assert (await invite(client, org.id, "two@example.com")).status_code == 403
    r = await client.delete(f"/api/orgs/{org.id}/invites/{pending['id']}")
    assert r.status_code == 403
    # They can still see the team they are on.
    assert (await client.get(f"/api/orgs/{org.id}/invites")).status_code == 200


@pytest.mark.asyncio
async def test_non_member_cannot_list_another_orgs_invites(
    client: AsyncClient, sessionmaker, agency, outbox
) -> None:
    owner, org = agency
    login(client, owner)
    await invite(client, org.id, "one@example.com")

    async with sessionmaker() as session:
        outsider = User(email="outsider@example.com")
        session.add(outsider)
        await session.commit()
        await session.refresh(outsider)

    client.cookies.clear()
    login(client, outsider)
    assert (await client.get(f"/api/orgs/{org.id}/invites")).status_code == 404


# --- Accepting ---


@pytest.mark.asyncio
async def test_accept_creates_the_membership_and_signs_the_invitee_in(
    client: AsyncClient, agency, outbox
) -> None:
    owner, org = agency
    login(client, owner)
    await invite(client, org.id, "agent@example.com")
    token = token_from(outbox)

    client.cookies.clear()
    r = await client.post("/api/invites/accept", json={"token": token})
    assert r.status_code == 200
    assert r.json()["organization_name"] == "Cordillera Travel"
    assert r.json()["role"] == "agent"

    # The response set a session cookie, so the very next call is authenticated
    # as the invitee — no second sign-in step between the link and the app.
    me = await client.get("/api/me")
    assert me.status_code == 200
    assert me.json()["email"] == "agent@example.com"
    assert me.json()["organization"]["id"] == str(org.id)
    assert me.json()["organization"]["seats_used"] == 2
    assert me.json()["role"] == "agent"
    assert me.json()["is_agency"] is True


@pytest.mark.asyncio
async def test_a_token_works_once(client: AsyncClient, agency, outbox) -> None:
    owner, org = agency
    login(client, owner)
    await invite(client, org.id, "agent@example.com")
    token = token_from(outbox)

    client.cookies.clear()
    assert (await client.post("/api/invites/accept", json={"token": token})).status_code == 200

    client.cookies.clear()
    r = await client.post("/api/invites/accept", json={"token": token})
    assert r.status_code == 409
    assert r.json()["detail"] == "invitation already accepted"


@pytest.mark.asyncio
async def test_an_expired_invitation_is_refused(
    client: AsyncClient, sessionmaker, agency, outbox
) -> None:
    """Expiry is the row's, not only the signature's.

    Backdating `expires_at` leaves a perfectly valid signature, which is the
    case that matters: it is how shortening the TTL reaches links already sent.
    """
    owner, org = agency
    login(client, owner)
    invitation_id = (await invite(client, org.id, "agent@example.com")).json()["id"]
    token = token_from(outbox)

    async with sessionmaker() as session:
        row = await session.get(Invitation, uuid.UUID(invitation_id))
        row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        await session.commit()

    client.cookies.clear()
    r = await client.post("/api/invites/accept", json={"token": token})
    assert r.status_code == 400
    assert r.json()["detail"] == "invitation expired"


@pytest.mark.asyncio
async def test_a_stale_signature_is_refused(
    client: AsyncClient, agency, outbox, monkeypatch
) -> None:
    """The other half of expiry: the signature aging out on its own."""
    from wtg_api.config import get_settings

    owner, org = agency
    login(client, owner)
    await invite(client, org.id, "agent@example.com")
    token = token_from(outbox)

    monkeypatch.setattr(get_settings(), "invite_ttl_seconds", -1)
    client.cookies.clear()
    r = await client.post("/api/invites/accept", json={"token": token})
    assert r.status_code == 400
    assert r.json()["detail"] == "invitation expired"


@pytest.mark.asyncio
async def test_a_revoked_invitation_looks_like_it_never_existed(
    client: AsyncClient, agency, outbox
) -> None:
    owner, org = agency
    login(client, owner)
    invitation_id = (await invite(client, org.id, "agent@example.com")).json()["id"]
    token = token_from(outbox)
    assert (
        await client.delete(f"/api/orgs/{org.id}/invites/{invitation_id}")
    ).status_code == 204

    client.cookies.clear()
    r = await client.post("/api/invites/accept", json={"token": token})
    assert r.status_code == 404
    assert (await client.get("/api/me")).status_code == 401  # no session issued


@pytest.mark.asyncio
async def test_a_forged_token_is_refused(client: AsyncClient, agency, outbox) -> None:
    owner, org = agency
    login(client, owner)
    await invite(client, org.id, "agent@example.com")
    good = token_from(outbox)

    client.cookies.clear()
    for bad in (
        good[:-3] + "aaa",  # tampered signature
        good.replace(".", "x", 1),  # mangled payload
        "not-a-token-at-all",
    ):
        r = await client.post("/api/invites/accept", json={"token": bad})
        assert r.status_code == 404, bad
    assert (await client.get("/api/me")).status_code == 401


@pytest.mark.asyncio
async def test_a_token_signed_for_another_purpose_is_refused(
    client: AsyncClient, agency, outbox
) -> None:
    """Salts, not just secrets: a magic-link token must not spend an invitation."""
    from wtg_api.services.sessions import issue_magic_link_token

    owner, org = agency
    login(client, owner)
    invitation_id = (await invite(client, org.id, "agent@example.com")).json()["id"]

    client.cookies.clear()
    r = await client.post(
        "/api/invites/accept",
        json={"token": issue_magic_link_token(f"agent@example.com|{invitation_id}")},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_accept_binds_to_the_invited_address_not_the_signed_in_user(
    client: AsyncClient, agency, outbox, user: User
) -> None:
    """A forwarded link cannot attach the seat to whoever opened it.

    The seat goes to the address the invitation was mailed to; the opener is
    signed in as that address or not at all. Anything else would let one
    careless forward hand an unrelated account an agency plan.
    """
    owner, org = agency
    login(client, owner)
    await invite(client, org.id, "agent@example.com")
    token = token_from(outbox)

    client.cookies.clear()
    login(client, user)  # some other signed-in person opens the link
    r = await client.post("/api/invites/accept", json={"token": token})
    assert r.status_code == 200

    me = await client.get("/api/me")
    assert me.json()["email"] == "agent@example.com"
    assert me.json()["email"] != user.email


@pytest.mark.asyncio
async def test_accept_is_refused_when_the_seats_are_gone(
    client: AsyncClient, sessionmaker, agency, outbox
) -> None:
    """The cap that matters is the one in force when the seat is taken.

    A plan can be downgraded between sending an invitation and its being
    opened, and the accept path is the last place that can notice.
    """
    owner, org = agency
    login(client, owner)
    await invite(client, org.id, "agent@example.com")
    token = token_from(outbox)

    async with sessionmaker() as session:
        row = await session.get(Organization, org.id)
        row.seat_cap = 1  # downgraded to a single seat, which the owner holds
        await session.commit()

    client.cookies.clear()
    r = await client.post("/api/invites/accept", json={"token": token})
    assert r.status_code == 409
    assert r.json()["detail"] == "seat cap reached"


@pytest.mark.asyncio
async def test_preview_says_only_what_the_recipient_already_knows(
    client: AsyncClient, agency, outbox
) -> None:
    owner, org = agency
    login(client, owner)
    await invite(client, org.id, "agent@example.com")
    token = token_from(outbox)

    client.cookies.clear()
    r = await client.get("/api/invites/preview", params={"token": token})
    assert r.status_code == 200
    body = r.json()
    assert body["organization_name"] == "Cordillera Travel"
    assert body["email"] == "agent@example.com"
    assert body["role"] == "agent"
    # No org id, no member list, no counts — this is answered to an
    # unauthenticated caller holding a token.
    assert "organization_id" not in body
    assert (await client.get("/api/me")).status_code == 401  # preview is not accept


@pytest.mark.asyncio
async def test_preview_of_a_spent_invitation_reports_it(
    client: AsyncClient, agency, outbox
) -> None:
    owner, org = agency
    login(client, owner)
    await invite(client, org.id, "agent@example.com")
    token = token_from(outbox)
    client.cookies.clear()
    await client.post("/api/invites/accept", json={"token": token})

    client.cookies.clear()
    r = await client.get("/api/invites/preview", params={"token": token})
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_accepted_invitations_leave_the_pending_list(
    client: AsyncClient, agency, outbox
) -> None:
    owner, org = agency
    login(client, owner)
    await invite(client, org.id, "agent@example.com")
    token = token_from(outbox)
    assert len((await client.get(f"/api/orgs/{org.id}/invites")).json()) == 1

    client.cookies.clear()
    await client.post("/api/invites/accept", json={"token": token})

    client.cookies.clear()
    login(client, owner)
    assert (await client.get(f"/api/orgs/{org.id}/invites")).json() == []
    members = (await client.get(f"/api/orgs/{org.id}/memberships")).json()
    assert sorted(m["email"] for m in members) == ["agent@example.com", owner.email]


@pytest.mark.asyncio
async def test_revoking_an_accepted_invitation_is_refused(
    client: AsyncClient, agency, outbox
) -> None:
    """Removing a member is a membership delete, not an invitation revoke."""
    owner, org = agency
    login(client, owner)
    invitation_id = (await invite(client, org.id, "agent@example.com")).json()["id"]
    token = token_from(outbox)
    client.cookies.clear()
    await client.post("/api/invites/accept", json={"token": token})

    client.cookies.clear()
    login(client, owner)
    r = await client.delete(f"/api/orgs/{org.id}/invites/{invitation_id}")
    assert r.status_code == 409
