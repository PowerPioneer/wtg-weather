"""Billing summary + customer-portal minting.

The portal URL is a bearer capability over somebody's subscription and saved
payment methods, so the failure paths are the point: anonymous, no subscription
on file, and an unconfigured environment must each refuse rather than return
something a browser will happily open.

Never live Paddle. `PADDLE_API_KEY` is empty in the test settings, and the one
test that exercises the outbound call patches the transport.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient

from tests.conftest import login
from wtg_api.config import get_settings
from wtg_api.models import Organization, Plan, User


@pytest.mark.asyncio
async def test_summary_requires_auth(client: AsyncClient) -> None:
    assert (await client.get("/api/billing")).status_code == 401


@pytest.mark.asyncio
async def test_portal_requires_auth(client: AsyncClient) -> None:
    assert (await client.post("/api/billing/portal")).status_code == 401


@pytest.mark.asyncio
async def test_free_user_summary_offers_no_portal(
    client: AsyncClient, user: User
) -> None:
    login(client, user)
    r = await client.get("/api/billing")
    assert r.status_code == 200
    body = r.json()
    assert body["plan"] == "free"
    assert body["has_subscription"] is False
    assert body["portal_available"] is False
    assert body["sandbox"] is True


@pytest.mark.asyncio
async def test_free_user_portal_is_404_not_403(
    client: AsyncClient, user: User
) -> None:
    """"Nothing to manage" and "not yours" are different answers.

    The account page shows checkout for the first and an error for the second;
    collapsing them would tell a free user their own billing is forbidden.
    """
    login(client, user)
    r = await client.post("/api/billing/portal")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_subscriber_summary_reports_the_plan(
    client: AsyncClient, sessionmaker, premium_user: tuple[User, Organization]
) -> None:
    user, org = premium_user
    async with sessionmaker() as session:
        fresh = await session.get(Organization, org.id)
        assert fresh is not None
        fresh.paddle_subscription_id = "sub_live_1"
        fresh.paddle_customer_id = "ctm_1"
        await session.commit()

    login(client, user)
    body = (await client.get("/api/billing")).json()
    assert body["plan"] == Plan.consumer_premium.value
    assert body["has_subscription"] is True
    # No API key configured in tests, so the button stays hidden rather than
    # being offered and failing on click.
    assert body["portal_available"] is False


@pytest.mark.asyncio
async def test_portal_unconfigured_environment_returns_503(
    client: AsyncClient, sessionmaker, premium_user: tuple[User, Organization]
) -> None:
    """With no key we refuse. We never invent a plausible-looking portal URL.

    A fabricated link is indistinguishable from a working one until a user
    clicks it and lands somewhere that is not their account.
    """
    user, org = premium_user
    async with sessionmaker() as session:
        fresh = await session.get(Organization, org.id)
        assert fresh is not None
        fresh.paddle_customer_id = "ctm_1"
        await session.commit()

    login(client, user)
    r = await client.post("/api/billing/portal")
    assert r.status_code == 503


@pytest.mark.asyncio
async def test_portal_mints_url_from_paddle_response(
    client: AsyncClient, sessionmaker, premium_user: tuple[User, Organization], monkeypatch
) -> None:
    """The happy path, with the Paddle call stubbed at the transport."""
    user, org = premium_user
    async with sessionmaker() as session:
        fresh = await session.get(Organization, org.id)
        assert fresh is not None
        fresh.paddle_customer_id = "ctm_42"
        fresh.paddle_subscription_id = "sub_42"
        await session.commit()

    settings = get_settings()
    monkeypatch.setattr(settings, "paddle_api_key", "pdl_sdbx_test_key")

    seen: dict[str, Any] = {}

    async def fake_create(**kwargs: Any) -> str:
        seen.update(kwargs)
        return "https://sandbox-customer-portal.paddle.com/cpl_abc123"

    monkeypatch.setattr(
        "wtg_api.routers.billing._create_portal_session", fake_create
    )

    login(client, user)
    r = await client.post("/api/billing/portal")
    assert r.status_code == 200
    assert r.json()["portal_url"].startswith("https://sandbox-customer-portal.paddle.com/")
    assert r.json()["sandbox"] is True

    # The customer id came from the caller's own org row, never from the request.
    assert seen["customer_id"] == "ctm_42"
    assert seen["subscription_id"] == "sub_42"
    assert "sandbox-api.paddle.com" in seen["api_base"]


@pytest.mark.asyncio
async def test_portal_never_takes_a_customer_id_from_the_client(
    client: AsyncClient, sessionmaker, premium_user: tuple[User, Organization], monkeypatch
) -> None:
    """A body naming somebody else's customer must not steer the mint.

    This is the whole reason the endpoint exists rather than the browser
    building the URL: a portal session opens payment methods and invoices.
    """
    user, org = premium_user
    async with sessionmaker() as session:
        fresh = await session.get(Organization, org.id)
        assert fresh is not None
        fresh.paddle_customer_id = "ctm_mine"
        await session.commit()

    monkeypatch.setattr(get_settings(), "paddle_api_key", "pdl_sdbx_test_key")
    seen: dict[str, Any] = {}

    async def fake_create(**kwargs: Any) -> str:
        seen.update(kwargs)
        return "https://sandbox-customer-portal.paddle.com/cpl_ok"

    monkeypatch.setattr("wtg_api.routers.billing._create_portal_session", fake_create)

    login(client, user)
    r = await client.post(
        "/api/billing/portal",
        json={"customer_id": "ctm_someone_else", "organization_id": str(uuid.uuid4())},
    )
    assert r.status_code == 200
    assert seen["customer_id"] == "ctm_mine"


@pytest.mark.asyncio
async def test_agent_of_an_agency_gets_no_portal(
    client: AsyncClient, sessionmaker, user: User
) -> None:
    """A non-owner agent sees the agency's clients, never its card."""
    from wtg_api.models import Membership, Role

    async with sessionmaker() as session:
        org = Organization(
            name="Someone Else's Agency",
            plan=Plan.agency_pro,
            seat_cap=10,
            paddle_customer_id="ctm_agency",
            paddle_subscription_id="sub_agency",
        )
        session.add(org)
        await session.flush()
        session.add(
            Membership(user_id=user.id, organization_id=org.id, role=Role.agent)
        )
        await session.commit()

    login(client, user)
    # They are premium — the agency plan entitles them — but the subscription
    # is not theirs to manage.
    assert (await client.get("/api/me")).json()["is_premium"] is True
    assert (await client.post("/api/billing/portal")).status_code == 404
    assert (await client.get("/api/billing")).json()["portal_available"] is False


@pytest.mark.asyncio
async def test_portal_reports_bad_gateway_when_paddle_refuses(
    client: AsyncClient, sessionmaker, premium_user: tuple[User, Organization], monkeypatch
) -> None:
    user, org = premium_user
    async with sessionmaker() as session:
        fresh = await session.get(Organization, org.id)
        assert fresh is not None
        fresh.paddle_customer_id = "ctm_1"
        await session.commit()

    monkeypatch.setattr(get_settings(), "paddle_api_key", "pdl_sdbx_test_key")

    async def fake_create(**_: Any) -> None:
        return None

    monkeypatch.setattr("wtg_api.routers.billing._create_portal_session", fake_create)

    login(client, user)
    assert (await client.post("/api/billing/portal")).status_code == 502
