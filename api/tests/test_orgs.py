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
async def test_org_read_reports_seats_used_and_pending(
    client: AsyncClient, agency, outbox
) -> None:
    owner, org = agency
    login(client, owner)
    await client.post(f"/api/orgs/{org.id}/invites", json={"email": "one@example.com"})
    body = (await client.get(f"/api/orgs/{org.id}")).json()
    assert body["seat_cap"] == 3
    assert body["seats_used"] == 1
    assert body["seats_pending"] == 1


@pytest.mark.asyncio
async def test_invite_respects_seat_cap(client: AsyncClient, user, outbox) -> None:
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


# --- Clients ---
#
# The rule under every test below: a client id is not a capability. Every read
# and write goes through the caller's membership in the client's organization,
# so an id guessed, leaked or copied from another agency's URL is "not found".


@pytest.mark.asyncio
async def test_non_member_fetching_another_orgs_client_gets_404(
    client: AsyncClient, sessionmaker, agency
) -> None:
    from wtg_api.models import User

    owner, org = agency
    login(client, owner)
    created = await client.post(
        f"/api/orgs/{org.id}/clients", json={"name": "Westfield Family"}
    )
    assert created.status_code == 201
    client_id = created.json()["id"]

    async with sessionmaker() as session:
        outsider = User(email="rival-agency@example.com")
        session.add(outsider)
        await session.commit()
        await session.refresh(outsider)

    client.cookies.clear()
    login(client, outsider)
    for path in (
        f"/api/orgs/{org.id}/clients/{client_id}",
        f"/api/orgs/{org.id}/clients/{client_id}/trips",
        f"/api/orgs/{org.id}/clients/{client_id}/notes",
        f"/api/orgs/{org.id}/clients",
    ):
        assert (await client.get(path)).status_code == 404, path
    assert (
        await client.patch(
            f"/api/orgs/{org.id}/clients/{client_id}", json={"notes": "mine now"}
        )
    ).status_code == 404
    assert (
        await client.delete(f"/api/orgs/{org.id}/clients/{client_id}")
    ).status_code == 404


@pytest.mark.asyncio
async def test_a_client_id_from_another_org_is_not_found_under_yours(
    client: AsyncClient, sessionmaker, agency, user
) -> None:
    """Membership in *an* org is not membership in *the* org.

    The path carries both ids and only the pair is meaningful — asking for
    someone else's client under your own org id must not resolve it.
    """
    owner, org = agency
    login(client, owner)
    theirs = (
        await client.post(f"/api/orgs/{org.id}/clients", json={"name": "Theirs"})
    ).json()["id"]

    client.cookies.clear()
    login(client, user)
    mine = (await client.post("/api/orgs", json={"name": "My Agency"})).json()["id"]
    assert (await client.get(f"/api/orgs/{mine}/clients/{theirs}")).status_code == 404


@pytest.mark.asyncio
async def test_client_crud_and_trip_count(client: AsyncClient, agency) -> None:
    owner, org = agency
    login(client, owner)

    created = (
        await client.post(
            f"/api/orgs/{org.id}/clients",
            json={"name": "Hartwell", "email": "h@example.com", "notes": "Loves rain"},
        )
    ).json()
    assert created["trip_count"] == 0

    trip = (
        await client.post(
            "/api/trips",
            json={"title": "Peru in April", "client_id": created["id"], "month": 4},
        )
    ).json()
    assert trip["client_id"] == created["id"]

    listed = (await client.get(f"/api/orgs/{org.id}/clients")).json()
    assert [c["trip_count"] for c in listed] == [1]

    trips = (
        await client.get(f"/api/orgs/{org.id}/clients/{created['id']}/trips")
    ).json()
    assert trips[0]["title"] == "Peru in April"
    assert trips[0]["owner_email"] == owner.email
    assert trips[0]["shared"] is False
    # The owner's share token is the owner's to hand out — never listed here.
    assert "share_token" not in trips[0]

    patched = await client.patch(
        f"/api/orgs/{org.id}/clients/{created['id']}",
        json={"notes": "Prefers shoulder season"},
    )
    assert patched.json()["notes"] == "Prefers shoulder season"
    assert patched.json()["name"] == "Hartwell"  # untouched by a partial update


@pytest.mark.asyncio
async def test_deleting_a_client_unassigns_its_trips_rather_than_deleting_them(
    client: AsyncClient, agency
) -> None:
    owner, org = agency
    login(client, owner)
    c = (
        await client.post(f"/api/orgs/{org.id}/clients", json={"name": "Okafor"})
    ).json()
    trip = (
        await client.post("/api/trips", json={"title": "Chile", "client_id": c["id"]})
    ).json()

    assert (
        await client.delete(f"/api/orgs/{org.id}/clients/{c['id']}")
    ).status_code == 204

    still_there = await client.get(f"/api/trips/{trip['id']}")
    assert still_there.status_code == 200
    assert still_there.json()["client_id"] is None


@pytest.mark.asyncio
async def test_an_agent_works_on_clients_but_does_not_delete_them(
    client: AsyncClient, sessionmaker, agency
) -> None:
    """The role line: an agent plans, an owner administers."""
    from wtg_api.models import Membership, Role, User

    owner, org = agency
    login(client, owner)
    existing = (
        await client.post(f"/api/orgs/{org.id}/clients", json={"name": "Shared"})
    ).json()["id"]

    async with sessionmaker() as session:
        agent = User(email="agent-role@example.com", name="Ana Agent")
        session.add(agent)
        await session.flush()
        session.add(
            Membership(user_id=agent.id, organization_id=org.id, role=Role.agent)
        )
        await session.commit()
        await session.refresh(agent)

    client.cookies.clear()
    login(client, agent)
    assert (await client.get(f"/api/orgs/{org.id}/clients")).status_code == 200
    assert (
        await client.post(f"/api/orgs/{org.id}/clients", json={"name": "Agent's own"})
    ).status_code == 201
    assert (
        await client.patch(
            f"/api/orgs/{org.id}/clients/{existing}", json={"notes": "called them"}
        )
    ).status_code == 200
    assert (
        await client.delete(f"/api/orgs/{org.id}/clients/{existing}")
    ).status_code == 403


@pytest.mark.asyncio
async def test_client_notes_are_attributed_and_org_scoped(
    client: AsyncClient, sessionmaker, agency
) -> None:
    from wtg_api.models import User

    owner, org = agency
    login(client, owner)
    c = (
        await client.post(f"/api/orgs/{org.id}/clients", json={"name": "Vance"})
    ).json()

    created = await client.post(
        f"/api/orgs/{org.id}/clients/{c['id']}/notes",
        json={"body": "Wants shoulder season, hates crowds."},
    )
    assert created.status_code == 201
    assert created.json()["author_email"] == owner.email
    assert created.json()["author_name"] == "Ada Owner"

    notes = (await client.get(f"/api/orgs/{org.id}/clients/{c['id']}/notes")).json()
    assert len(notes) == 1

    async with sessionmaker() as session:
        outsider = User(email="nosy@example.com")
        session.add(outsider)
        await session.commit()
        await session.refresh(outsider)

    client.cookies.clear()
    login(client, outsider)
    assert (
        await client.post(
            f"/api/orgs/{org.id}/clients/{c['id']}/notes", json={"body": "hello"}
        )
    ).status_code == 404
    assert (
        await client.delete(
            f"/api/orgs/{org.id}/clients/{c['id']}/notes/{notes[0]['id']}"
        )
    ).status_code == 404


@pytest.mark.asyncio
async def test_an_agent_deletes_their_own_note_but_not_a_colleagues(
    client: AsyncClient, sessionmaker, agency
) -> None:
    from wtg_api.models import Membership, Role, User

    owner, org = agency
    login(client, owner)
    c = (
        await client.post(f"/api/orgs/{org.id}/clients", json={"name": "Vance"})
    ).json()
    owners_note = (
        await client.post(
            f"/api/orgs/{org.id}/clients/{c['id']}/notes", json={"body": "owner's"}
        )
    ).json()

    async with sessionmaker() as session:
        agent = User(email="note-agent@example.com")
        session.add(agent)
        await session.flush()
        session.add(
            Membership(user_id=agent.id, organization_id=org.id, role=Role.agent)
        )
        await session.commit()
        await session.refresh(agent)

    client.cookies.clear()
    login(client, agent)
    theirs = (
        await client.post(
            f"/api/orgs/{org.id}/clients/{c['id']}/notes", json={"body": "agent's"}
        )
    ).json()
    assert (
        await client.delete(
            f"/api/orgs/{org.id}/clients/{c['id']}/notes/{owners_note['id']}"
        )
    ).status_code == 403
    assert (
        await client.delete(
            f"/api/orgs/{org.id}/clients/{c['id']}/notes/{theirs['id']}"
        )
    ).status_code == 204
