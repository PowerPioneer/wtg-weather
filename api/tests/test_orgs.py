from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import login


@pytest.mark.asyncio
async def test_create_org_makes_caller_owner(client: AsyncClient, user) -> None:
    login(client, user)
    r = await client.post("/api/orgs", json={"name": "My Agency"})
    assert r.status_code == 201
    org_id = r.json()["id"]

    r = await client.get(f"/api/orgs/{org_id}/memberships")
    assert r.status_code == 200
    roles = [m["role"] for m in r.json()]
    assert "owner" in roles


@pytest.mark.asyncio
async def test_non_member_cannot_read_org(client: AsyncClient, user, sessionmaker) -> None:
    login(client, user)
    r = await client.post("/api/orgs", json={"name": "Secret"})
    org_id = r.json()["id"]

    from wtg_api.models import User

    async with sessionmaker() as session:
        outsider = User(email="outsider@example.com")
        session.add(outsider)
        await session.commit()
        await session.refresh(outsider)

    client.cookies.clear()
    login(client, outsider)
    r = await client.get(f"/api/orgs/{org_id}")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_invite_respects_seat_cap(client: AsyncClient, user) -> None:
    login(client, user)
    r = await client.post("/api/orgs", json={"name": "Tight"})
    org_id = r.json()["id"]
    # Default plan is free, seat_cap=1 — the owner already occupies the seat.
    r = await client.post(
        f"/api/orgs/{org_id}/memberships",
        json={"email": "new@example.com", "role": "agent"},
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_non_admin_cannot_invite(client: AsyncClient, user, sessionmaker) -> None:
    login(client, user)
    r = await client.post("/api/orgs", json={"name": "Big"})
    org_id = r.json()["id"]

    # Bump seat_cap artificially to allow the agent membership, then log in as them.
    import uuid as _uuid

    from wtg_api.models import Membership, Organization, Role, User

    async with sessionmaker() as session:
        org = await session.get(Organization, _uuid.UUID(org_id))
        assert org is not None
        org.seat_cap = 5
        agent = User(email="agent@example.com")
        session.add(agent)
        await session.flush()
        session.add(Membership(user_id=agent.id, organization_id=org.id, role=Role.agent))
        await session.commit()
        await session.refresh(agent)

    client.cookies.clear()
    login(client, agent)
    r = await client.post(
        f"/api/orgs/{org_id}/memberships",
        json={"email": "x@example.com", "role": "agent"},
    )
    assert r.status_code == 403
