from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import login
from wtg_api.models import User


@pytest.mark.asyncio
async def test_get_onboarding_requires_auth(client: AsyncClient) -> None:
    r = await client.get("/api/onboarding")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_patch_onboarding_updates_state(client: AsyncClient, user: User) -> None:
    login(client, user)

    r = await client.get("/api/onboarding")
    assert r.status_code == 200
    assert r.json() == {"kind": None, "step": 0, "completed": False, "data": {}}

    r = await client.patch(
        "/api/onboarding",
        json={"kind": "consumer", "step": 1, "data": {"units": {"temp": "C"}}},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["kind"] == "consumer"
    assert body["step"] == 1
    assert body["data"] == {"units": {"temp": "C"}}

    r = await client.patch(
        "/api/onboarding",
        json={"step": 2, "data": {"preferences": {"temp_min": 16}}},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["step"] == 2
    assert body["data"]["units"] == {"temp": "C"}
    assert body["data"]["preferences"] == {"temp_min": 16}

    r = await client.patch("/api/onboarding", json={"completed": True})
    assert r.status_code == 200
    assert r.json()["completed"] is True


@pytest.mark.asyncio
async def test_patch_onboarding_rejects_invalid_kind(
    client: AsyncClient, user: User
) -> None:
    login(client, user)
    r = await client.patch("/api/onboarding", json={"kind": "nonsense"})
    assert r.status_code == 422
