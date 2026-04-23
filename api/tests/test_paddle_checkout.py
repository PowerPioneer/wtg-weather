from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import login
from wtg_api.models import Organization, User


@pytest.mark.asyncio
async def test_checkout_url_requires_auth(client: AsyncClient) -> None:
    r = await client.post(
        "/api/paddle/checkout-url", json={"plan": "consumer_premium"}
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_checkout_url_consumer_returns_sandbox_url(
    client: AsyncClient, user: User
) -> None:
    login(client, user)
    r = await client.post(
        "/api/paddle/checkout-url", json={"plan": "consumer_premium"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["sandbox"] is True
    assert body["plan"] == "consumer_premium"
    assert "sandbox-checkout.paddle.com" in body["checkout_url"]
    assert "priceId" in body["checkout_url"]


@pytest.mark.asyncio
async def test_checkout_url_rejects_forged_org(
    client: AsyncClient, user: User
) -> None:
    login(client, user)
    r = await client.post(
        "/api/paddle/checkout-url",
        json={"plan": "agency_pro", "organization_id": str(uuid.uuid4())},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_checkout_url_agency_with_membership(
    client: AsyncClient,
    premium_user: tuple[User, Organization],
) -> None:
    user, org = premium_user
    login(client, user)
    r = await client.post(
        "/api/paddle/checkout-url",
        json={"plan": "agency_pro", "organization_id": str(org.id)},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["plan"] == "agency_pro"
    assert str(org.id) in body["checkout_url"]


@pytest.mark.asyncio
async def test_checkout_url_rejects_invalid_plan(
    client: AsyncClient, user: User
) -> None:
    login(client, user)
    r = await client.post("/api/paddle/checkout-url", json={"plan": "free"})
    assert r.status_code == 422
