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
    client: AsyncClient, user
) -> None:
    """Pausing is what the account page's toggle does. Without it the only way
    to stop an alert is to delete its definition."""
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
    client: AsyncClient, user, sessionmaker
) -> None:
    from wtg_api.models import User

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
