from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient

from tests.conftest import login
from wtg_api.models import Organization, User

TXN = "txn_01hv8zt3q9m2xk4c7wbn6yrfda"
CUSTOMER = "ctm_01hv8zt3q9m2xk4c7wbn6yrfdb"
CHECKOUT = f"http://localhost:3000/checkout/pay?_ptxn={TXN}"


@pytest.fixture
def paddle_api(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """Stub the Paddle call and capture what we sent it.

    The real `_create_transaction` is never reached in tests — `PADDLE_API_KEY`
    is empty in the test settings, so the endpoint 503s before it. Tests that
    want the success path patch both.
    """
    sent: dict[str, Any] = {}

    async def fake_create(**kwargs: Any) -> tuple[str, str | None]:
        sent.update(kwargs)
        return TXN, CHECKOUT

    async def fake_customer(**kwargs: Any) -> str:
        sent["customer_email"] = kwargs.get("email")
        return CUSTOMER

    monkeypatch.setattr(
        "wtg_api.routers.paddle_checkout._create_transaction", fake_create
    )
    # Stubbed as well as `_create_transaction`: without this the endpoint makes
    # a real HTTPS call to Paddle from the test suite, which
    # `.claude/rules/testing.md` forbids. It passed anyway only because the
    # helper swallows transport errors and returns None — an accidental pass.
    monkeypatch.setattr(
        "wtg_api.routers.paddle_checkout._find_or_create_customer", fake_customer
    )
    monkeypatch.setattr(
        "wtg_api.routers.paddle_checkout.get_settings",
        _settings_with_key(),
    )
    return sent


def _settings_with_key() -> Any:
    from wtg_api.config import get_settings

    real = get_settings()

    def patched() -> Any:
        return real.model_copy(update={"paddle_api_key": "pdl_test_key"})

    return patched


@pytest.mark.asyncio
async def test_checkout_requires_auth(client: AsyncClient) -> None:
    r = await client.post(
        "/api/paddle/checkout-url", json={"plan": "consumer_premium"}
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_checkout_returns_transaction_id(
    client: AsyncClient, user: User, paddle_api: dict[str, Any]
) -> None:
    login(client, user)
    r = await client.post(
        "/api/paddle/checkout-url", json={"plan": "consumer_premium"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["transaction_id"] == TXN
    assert body["checkout_url"] == CHECKOUT
    assert body["sandbox"] is True
    assert body["plan"] == "consumer_premium"


@pytest.mark.asyncio
async def test_checkout_stamps_custom_data_server_side(
    client: AsyncClient, user: User, paddle_api: dict[str, Any]
) -> None:
    """The plan and user reach Paddle from here, never from the browser.

    `routers/paddle.py::_extract_plan` trusts `custom_data["plan"]` over the
    price, so a client able to set it could buy the cheapest price and claim
    the dearest plan. This test is what pins that door shut.
    """
    login(client, user)
    r = await client.post(
        "/api/paddle/checkout-url", json={"plan": "consumer_premium"}
    )
    assert r.status_code == 200
    assert paddle_api["custom_data"] == {
        "plan": "consumer_premium",
        "user_id": str(user.id),
    }
    assert paddle_api["price_id"]


@pytest.mark.asyncio
async def test_checkout_prefills_the_signed_in_email(
    client: AsyncClient, user: User, paddle_api: dict[str, Any]
) -> None:
    """The buyer should not retype an address we already hold."""
    login(client, user)
    r = await client.post(
        "/api/paddle/checkout-url", json={"plan": "consumer_premium"}
    )
    assert r.status_code == 200
    assert paddle_api["customer_email"] == user.email
    assert paddle_api["customer_id"] == CUSTOMER


@pytest.mark.asyncio
async def test_prices_endpoint_lists_only_configured_plans(
    client: AsyncClient,
) -> None:
    """Public, unauthenticated, and silent about plans with no price."""
    r = await client.get("/api/paddle/prices")
    assert r.status_code == 200
    body = r.json()
    assert body["sandbox"] is True
    assert "consumer_premium" in body["prices"]
    # Sold by "contact sales" — no price id, so nothing to preview.
    assert "agency_enterprise" not in body["prices"]
    assert "free" not in body["prices"]
    # No API key in the test settings, so Paddle is never called and the
    # formatted amounts come back empty rather than invented. The web treats
    # that as "use your own copy", which is the only honest fallback: a price
    # this endpoint made up would be a price nobody is charged.
    assert body["formatted"] == {}


@pytest.mark.asyncio
async def test_checkout_rejects_forged_org(
    client: AsyncClient, user: User, paddle_api: dict[str, Any]
) -> None:
    login(client, user)
    r = await client.post(
        "/api/paddle/checkout-url",
        json={"plan": "agency_pro", "organization_id": str(uuid.uuid4())},
    )
    assert r.status_code == 403
    # Rejected before anything was created at Paddle.
    assert sent_nothing(paddle_api)


@pytest.mark.asyncio
async def test_checkout_agency_with_membership(
    client: AsyncClient,
    premium_user: tuple[User, Organization],
    paddle_api: dict[str, Any],
) -> None:
    user, org = premium_user
    login(client, user)
    r = await client.post(
        "/api/paddle/checkout-url",
        json={"plan": "agency_pro", "organization_id": str(org.id)},
    )
    assert r.status_code == 200
    assert r.json()["plan"] == "agency_pro"
    assert paddle_api["custom_data"]["organization_id"] == str(org.id)


@pytest.mark.asyncio
async def test_checkout_rejects_invalid_plan(
    client: AsyncClient, user: User
) -> None:
    login(client, user)
    r = await client.post("/api/paddle/checkout-url", json={"plan": "free"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_checkout_unconfigured_is_503(
    client: AsyncClient, user: User
) -> None:
    """No API key: a clear 503, not a checkout that dies at Paddle."""
    login(client, user)
    r = await client.post(
        "/api/paddle/checkout-url", json={"plan": "consumer_premium"}
    )
    assert r.status_code == 503


@pytest.mark.asyncio
async def test_checkout_paddle_failure_is_502(
    client: AsyncClient, user: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Paddle refusing or unreachable must not surface as a broken 200."""
    async def fake_create(**_: Any) -> None:
        return None

    async def no_customer(**_: Any) -> None:
        return None

    monkeypatch.setattr(
        "wtg_api.routers.paddle_checkout._create_transaction", fake_create
    )
    # Also stubbed, or this test reaches Paddle over the network.
    monkeypatch.setattr(
        "wtg_api.routers.paddle_checkout._find_or_create_customer", no_customer
    )
    monkeypatch.setattr(
        "wtg_api.routers.paddle_checkout.get_settings", _settings_with_key()
    )
    login(client, user)
    r = await client.post(
        "/api/paddle/checkout-url", json={"plan": "consumer_premium"}
    )
    assert r.status_code == 502


def sent_nothing(captured: dict[str, Any]) -> bool:
    return not captured
