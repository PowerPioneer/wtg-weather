"""`/api/me` — the whole session contract in one payload.

The web mirrors this response field for field and derives its premium/agency
gates from `plan`. Anything this endpoint omits is something the account
surface has to invent, which is how `/account` came to print fixture strings
for real users; anything it gets wrong about the plan is a paid tier given
away or withheld. Hence the shape assertions, not just the status codes.
"""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import login


@pytest.mark.asyncio
async def test_me_requires_a_session(client: AsyncClient) -> None:
    assert (await client.get("/api/me")).status_code == 401


@pytest.mark.asyncio
async def test_me_forged_session_cookie_is_not_a_session(
    client: AsyncClient, user
) -> None:
    client.cookies.set("wtg_session", "not.a.signed.token")
    r = await client.get("/api/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_free_user_has_no_org_and_no_role(client: AsyncClient, user) -> None:
    login(client, user)
    r = await client.get("/api/me")
    assert r.status_code == 200
    body = r.json()

    assert body["plan"] == "free"
    assert body["is_premium"] is False
    assert body["is_agency"] is False
    assert body["organization"] is None
    assert body["organization_id"] is None
    assert body["role"] is None
    assert body["email"] == user.email
    assert body["created_at"] is not None


@pytest.mark.asyncio
async def test_premium_user_carries_plan_org_and_role(
    client: AsyncClient, premium_user
) -> None:
    user, org = premium_user
    login(client, user)
    r = await client.get("/api/me")
    assert r.status_code == 200
    body = r.json()

    assert body["plan"] == "consumer_premium"
    assert body["is_premium"] is True
    assert body["is_agency"] is False
    assert body["role"] == "owner"
    assert body["organization"] == {
        "id": str(org.id),
        "name": org.name,
        "plan": "consumer_premium",
        "seat_cap": org.seat_cap,
        "seats_used": 1,
        "created_at": body["organization"]["created_at"],
    }
    assert uuid.UUID(body["organization_id"]) == org.id


@pytest.mark.asyncio
async def test_agency_seats_used_counts_every_membership(
    client: AsyncClient, sessionmaker
) -> None:
    """Seat-cap enforcement (WS-C) reads this number, so it counts members —
    including one who has been invited but never signed in."""
    from wtg_api.models import Membership, Organization, Plan, Role, User

    async with sessionmaker() as session:
        owner = User(email="owner@agency.example", name="Owner")
        agent = User(email="agent@agency.example", name="Agent")
        org = Organization(name="Cordillera", plan=Plan.agency_starter, seat_cap=3)
        session.add_all([owner, agent, org])
        await session.flush()
        session.add_all(
            [
                Membership(user_id=owner.id, organization_id=org.id, role=Role.owner),
                Membership(user_id=agent.id, organization_id=org.id, role=Role.agent),
            ]
        )
        await session.commit()
        await session.refresh(owner)
        await session.refresh(agent)

    login(client, owner)
    body = (await client.get("/api/me")).json()
    assert body["plan"] == "agency_starter"
    assert body["is_agency"] is True
    assert body["role"] == "owner"
    assert body["organization"]["seats_used"] == 2
    assert body["organization"]["seat_cap"] == 3

    client.cookies.clear()
    login(client, agent)
    body = (await client.get("/api/me")).json()
    # The agent inherits the org's plan but not the owner's role.
    assert body["plan"] == "agency_starter"
    assert body["role"] == "agent"
