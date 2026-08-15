from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import login


@pytest.mark.asyncio
async def test_trip_crud_happy_path(client: AsyncClient, user) -> None:
    login(client, user)
    r = await client.post(
        "/api/trips",
        json={"title": "Peru in April", "country_iso2": "PE", "month": 4},
    )
    assert r.status_code == 201
    trip_id = r.json()["id"]

    r = await client.get(f"/api/trips/{trip_id}")
    assert r.status_code == 200

    r = await client.patch(f"/api/trips/{trip_id}", json={"title": "Updated"})
    assert r.status_code == 200
    assert r.json()["title"] == "Updated"

    r = await client.delete(f"/api/trips/{trip_id}")
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_trip_access_scoped_to_owner(client: AsyncClient, user, sessionmaker) -> None:
    login(client, user)
    r = await client.post("/api/trips", json={"title": "Mine"})
    trip_id = r.json()["id"]

    # Log in as a different user
    from wtg_api.models import User

    async with sessionmaker() as session:
        other = User(email="other@example.com")
        session.add(other)
        await session.commit()
        await session.refresh(other)

    client.cookies.clear()
    login(client, other)
    r = await client.get(f"/api/trips/{trip_id}")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_unauth_trip_requests_401(client: AsyncClient) -> None:
    assert (await client.get("/api/trips")).status_code == 401
    assert (await client.post("/api/trips", json={"title": "x"})).status_code == 401


@pytest.mark.asyncio
async def test_trip_month_validated(client: AsyncClient, user) -> None:
    login(client, user)
    r = await client.post("/api/trips", json={"title": "Bad", "month": 13})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_alert_can_be_paused_without_being_deleted(
    client: AsyncClient, premium_user
) -> None:
    """Pausing is what the account page's toggle does. Without it the only way
    to stop an alert is to delete its definition."""
    user, _org = premium_user
    login(client, user)
    r = await client.post("/api/alerts", json={"country_iso2": "pt", "month": 4})
    assert r.status_code == 201
    alert = r.json()
    assert alert["active"] is True
    assert alert["country_iso2"] == "PT"

    r = await client.patch(f"/api/alerts/{alert['id']}", json={"active": False})
    assert r.status_code == 200
    assert r.json()["active"] is False
    # Everything else survives the pause.
    assert r.json()["country_iso2"] == "PT"
    assert r.json()["month"] == 4

    r = await client.patch(f"/api/alerts/{alert['id']}", json={"active": True})
    assert r.json()["active"] is True


@pytest.mark.asyncio
async def test_alert_patch_scoped_to_owner(
    client: AsyncClient, premium_user, sessionmaker
) -> None:
    from wtg_api.models import User

    user, _org = premium_user
    login(client, user)
    alert_id = (await client.post("/api/alerts", json={"country_iso2": "PT"})).json()["id"]

    async with sessionmaker() as session:
        other = User(email="other-alerts@example.com")
        session.add(other)
        await session.commit()
        await session.refresh(other)

    client.cookies.clear()
    login(client, other)
    r = await client.patch(f"/api/alerts/{alert_id}", json={"active": False})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_unauth_alert_patch_401(client: AsyncClient) -> None:
    import uuid

    r = await client.patch(f"/api/alerts/{uuid.uuid4()}", json={"active": False})
    assert r.status_code == 401


# --- Sharing ---
#
# The token is the whole authorisation for the public view: there is no session
# behind it. So the failure paths matter more than the happy one.


@pytest.mark.asyncio
async def test_share_is_opt_in_and_idempotent(client: AsyncClient, user) -> None:
    login(client, user)
    trip_id = (await client.post("/api/trips", json={"title": "Peru"})).json()["id"]

    # Not shared until asked.
    assert (await client.get(f"/api/trips/{trip_id}")).json()["share_token"] is None

    first = (await client.post(f"/api/trips/{trip_id}/share")).json()["share_token"]
    assert first
    # Pressing share twice hands back the same link rather than invalidating
    # the one already sent.
    second = (await client.post(f"/api/trips/{trip_id}/share")).json()["share_token"]
    assert first == second


@pytest.mark.asyncio
async def test_shared_trip_readable_without_a_session(client: AsyncClient, user) -> None:
    login(client, user)
    trip_id = (
        await client.post(
            "/api/trips",
            json={"title": "Peru in April", "country_iso2": "PE", "month": 4},
        )
    ).json()["id"]
    token = (await client.post(f"/api/trips/{trip_id}/share")).json()["share_token"]

    client.cookies.clear()
    r = await client.get(f"/api/trips/shared/{token}")
    assert r.status_code == 200
    body = r.json()
    assert body["title"] == "Peru in April"
    assert body["month"] == 4
    # The public view must not hand out anything that turns into an
    # owner-scoped request, or that names an agency's client.
    assert "id" not in body
    assert "client_id" not in body
    assert "share_token" not in body


@pytest.mark.asyncio
async def test_unshared_trip_is_not_reachable_by_its_id(client: AsyncClient, user) -> None:
    login(client, user)
    trip_id = (await client.post("/api/trips", json={"title": "Private"})).json()["id"]

    client.cookies.clear()
    # The id is not a capability; only a token is.
    assert (await client.get(f"/api/trips/{trip_id}")).status_code == 401
    assert (await client.get(f"/api/trips/shared/{trip_id}")).status_code == 404


@pytest.mark.asyncio
async def test_revoked_share_link_stops_working(client: AsyncClient, user) -> None:
    login(client, user)
    trip_id = (await client.post("/api/trips", json={"title": "Peru"})).json()["id"]
    token = (await client.post(f"/api/trips/{trip_id}/share")).json()["share_token"]

    assert (await client.delete(f"/api/trips/{trip_id}/share")).status_code == 204

    client.cookies.clear()
    # 404, the same answer a token that never existed gets: the recipient of a
    # withdrawn link learns it does not work, not that it used to.
    assert (await client.get(f"/api/trips/shared/{token}")).status_code == 404


@pytest.mark.asyncio
async def test_share_token_rotates_after_revoke(client: AsyncClient, user) -> None:
    login(client, user)
    trip_id = (await client.post("/api/trips", json={"title": "Peru"})).json()["id"]
    first = (await client.post(f"/api/trips/{trip_id}/share")).json()["share_token"]
    await client.delete(f"/api/trips/{trip_id}/share")
    second = (await client.post(f"/api/trips/{trip_id}/share")).json()["share_token"]

    assert second != first
    client.cookies.clear()
    assert (await client.get(f"/api/trips/shared/{first}")).status_code == 404
    assert (await client.get(f"/api/trips/shared/{second}")).status_code == 200


@pytest.mark.asyncio
async def test_only_the_owner_can_share_or_revoke(
    client: AsyncClient, user, sessionmaker
) -> None:
    from wtg_api.models import User

    login(client, user)
    trip_id = (await client.post("/api/trips", json={"title": "Mine"})).json()["id"]

    async with sessionmaker() as session:
        other = User(email="other-share@example.com")
        session.add(other)
        await session.commit()
        await session.refresh(other)

    client.cookies.clear()
    login(client, other)
    assert (await client.post(f"/api/trips/{trip_id}/share")).status_code == 404
    assert (await client.delete(f"/api/trips/{trip_id}/share")).status_code == 404


@pytest.mark.asyncio
async def test_anonymous_cannot_mint_a_share_token(client: AsyncClient, user) -> None:
    login(client, user)
    trip_id = (await client.post("/api/trips", json={"title": "Mine"})).json()["id"]

    client.cookies.clear()
    assert (await client.post(f"/api/trips/{trip_id}/share")).status_code == 401


@pytest.mark.asyncio
async def test_share_token_is_not_guessably_short(client: AsyncClient, user) -> None:
    login(client, user)
    trip_id = (await client.post("/api/trips", json={"title": "Peru"})).json()["id"]
    token = (await client.post(f"/api/trips/{trip_id}/share")).json()["share_token"]
    assert len(token) >= 40


# --- Alerts are premium ---


@pytest.mark.asyncio
async def test_free_user_cannot_create_an_alert(client: AsyncClient, user) -> None:
    """The pricing table sells alerts as Premium. A gate that lives only in the
    web UI is not a gate — this endpoint is reachable directly."""
    login(client, user)
    r = await client.post("/api/alerts", json={"country_iso2": "PT", "month": 4})
    assert r.status_code == 403
    assert (await client.get("/api/alerts")).json() == []


@pytest.mark.asyncio
async def test_premium_user_can_create_an_alert(client: AsyncClient, premium_user) -> None:
    user, _org = premium_user
    login(client, user)
    r = await client.post("/api/alerts", json={"country_iso2": "PT", "month": 4})
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_a_lapsed_user_keeps_control_of_alerts_they_already_made(
    client: AsyncClient, premium_user, sessionmaker
) -> None:
    """Downgrading must not lock someone out of pausing or deleting their own
    alerts — only out of making new ones."""
    from wtg_api.models import Organization, Plan

    user, org = premium_user
    login(client, user)
    alert_id = (
        await client.post("/api/alerts", json={"country_iso2": "PT"})
    ).json()["id"]

    async with sessionmaker() as session:
        lapsed = await session.get(Organization, org.id)
        assert lapsed is not None
        lapsed.plan = Plan.free
        await session.commit()

    assert (await client.post("/api/alerts", json={"country_iso2": "ES"})).status_code == 403
    assert (await client.get("/api/alerts")).status_code == 200
    assert (
        await client.patch(f"/api/alerts/{alert_id}", json={"active": False})
    ).status_code == 200
    assert (await client.delete(f"/api/alerts/{alert_id}")).status_code == 204
