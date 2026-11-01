"""`POST /api/paddle/change-plan` — an agency's plan moves in place.

Every Paddle call is stubbed: either `_update_subscription` wholesale, or
httpx underneath it through a `MockTransport`, so the wire format is pinned
without the suite reaching Paddle (`.claude/rules/testing.md`).
"""

from __future__ import annotations

import json
import uuid
from typing import Any

import httpx
import pytest
from httpx import AsyncClient

from tests.conftest import login
from wtg_api.models import Membership, Organization, Plan, Role, User
from wtg_api.routers import paddle_checkout

SUB = "sub_01hv8zt3q9m2xk4c7wbn6yrfdc"


def _with_key() -> Any:
    from wtg_api.config import get_settings

    real = get_settings()
    return lambda: real.model_copy(update={"paddle_api_key": "pdl_test_key"})


@pytest.fixture
def paddle_update(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    sent: dict[str, Any] = {}

    async def fake_update(**kwargs: Any) -> bool:
        sent.update(kwargs)
        return True

    monkeypatch.setattr(paddle_checkout, "_update_subscription", fake_update)
    monkeypatch.setattr(paddle_checkout, "get_settings", _with_key())
    return sent


@pytest.fixture
async def subscribed_agency(sessionmaker, agency) -> tuple[User, Organization]:
    owner, org = agency
    async with sessionmaker() as session:
        fresh = await session.get(Organization, org.id)
        assert fresh is not None
        fresh.paddle_subscription_id = SUB
        await session.commit()
        await session.refresh(fresh)
        return owner, fresh


async def _change(client: AsyncClient, org: Organization, plan: str) -> httpx.Response:
    return await client.post(
        "/api/paddle/change-plan",
        json={"plan": plan, "organization_id": str(org.id)},
    )


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient, subscribed_agency) -> None:
    _owner, org = subscribed_agency
    assert (await _change(client, org, "agency_pro")).status_code == 401


@pytest.mark.asyncio
async def test_upgrade_charges_the_difference_now(
    client: AsyncClient, subscribed_agency, paddle_update: dict[str, Any]
) -> None:
    owner, org = subscribed_agency
    login(client, owner)
    r = await _change(client, org, "agency_pro")
    assert r.status_code == 200
    assert r.json() == {"plan": "agency_pro", "billed": "immediately"}
    assert paddle_update["subscription_id"] == SUB
    assert paddle_update["plan"] == Plan.agency_pro
    assert paddle_update["proration_billing_mode"] == "prorated_immediately"


@pytest.mark.asyncio
async def test_change_does_not_write_the_plan_itself(
    client: AsyncClient, sessionmaker, subscribed_agency, paddle_update: dict[str, Any]
) -> None:
    """The webhook is the one writer; a declined card must leave nothing behind."""
    owner, org = subscribed_agency
    login(client, owner)
    assert (await _change(client, org, "agency_pro")).status_code == 200
    async with sessionmaker() as session:
        fresh = await session.get(Organization, org.id)
        assert fresh is not None
        assert fresh.plan == Plan.agency_starter


@pytest.mark.asyncio
async def test_downgrade_waits_for_the_renewal(
    client: AsyncClient, sessionmaker, subscribed_agency, paddle_update: dict[str, Any]
) -> None:
    owner, org = subscribed_agency
    async with sessionmaker() as session:
        fresh = await session.get(Organization, org.id)
        assert fresh is not None
        fresh.plan = Plan.agency_pro
        fresh.seat_cap = 10
        await session.commit()
    login(client, owner)
    r = await _change(client, org, "agency_starter")
    assert r.status_code == 200
    assert r.json()["billed"] == "next_billing_period"
    assert paddle_update["proration_billing_mode"] == "prorated_next_billing_period"


@pytest.mark.asyncio
@pytest.mark.parametrize("role", [Role.agent, Role.member])
async def test_agent_cannot_change_the_plan(
    client: AsyncClient,
    sessionmaker,
    subscribed_agency,
    paddle_update: dict[str, Any],
    role: Role,
) -> None:
    _owner, org = subscribed_agency
    async with sessionmaker() as session:
        agent = User(email=f"agent-{uuid.uuid4().hex[:8]}@example.com")
        session.add(agent)
        await session.flush()
        session.add(Membership(user_id=agent.id, organization_id=org.id, role=role))
        await session.commit()
        await session.refresh(agent)
    login(client, agent)
    assert (await _change(client, org, "agency_pro")).status_code == 403
    assert not paddle_update


@pytest.mark.asyncio
async def test_stranger_cannot_change_the_plan(
    client: AsyncClient, user: User, subscribed_agency, paddle_update: dict[str, Any]
) -> None:
    _owner, org = subscribed_agency
    login(client, user)
    assert (await _change(client, org, "agency_pro")).status_code == 403
    assert not paddle_update


@pytest.mark.asyncio
async def test_no_subscription_is_409(
    client: AsyncClient, agency, paddle_update: dict[str, Any]
) -> None:
    owner, org = agency
    login(client, owner)
    assert (await _change(client, org, "agency_pro")).status_code == 409
    assert not paddle_update


@pytest.mark.asyncio
async def test_same_plan_is_409(
    client: AsyncClient, subscribed_agency, paddle_update: dict[str, Any]
) -> None:
    owner, org = subscribed_agency
    login(client, owner)
    assert (await _change(client, org, "agency_starter")).status_code == 409
    assert not paddle_update


@pytest.mark.asyncio
async def test_downgrade_below_the_member_count_is_409(
    client: AsyncClient, sessionmaker, subscribed_agency, paddle_update: dict[str, Any]
) -> None:
    owner, org = subscribed_agency
    async with sessionmaker() as session:
        fresh = await session.get(Organization, org.id)
        assert fresh is not None
        fresh.plan = Plan.agency_pro
        fresh.seat_cap = 10
        for i in range(3):  # owner + 3 = 4 members, Starter has 3 seats
            u = User(email=f"m{i}-{uuid.uuid4().hex[:6]}@example.com")
            session.add(u)
            await session.flush()
            session.add(Membership(user_id=u.id, organization_id=org.id, role=Role.agent))
        await session.commit()
    login(client, owner)
    assert (await _change(client, org, "agency_starter")).status_code == 409
    assert not paddle_update


@pytest.mark.asyncio
async def test_paddle_refusal_is_502(
    client: AsyncClient, subscribed_agency, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Including a declined card: Paddle's default `prevent_change` refuses."""

    async def refused(**_: Any) -> bool:
        return False

    monkeypatch.setattr(paddle_checkout, "_update_subscription", refused)
    monkeypatch.setattr(paddle_checkout, "get_settings", _with_key())
    owner, org = subscribed_agency
    login(client, owner)
    assert (await _change(client, org, "agency_pro")).status_code == 502


@pytest.mark.asyncio
async def test_unconfigured_is_503(client: AsyncClient, subscribed_agency) -> None:
    owner, org = subscribed_agency
    login(client, owner)
    assert (await _change(client, org, "agency_pro")).status_code == 503


# --- the wire format, through httpx ---


def _mock_paddle(
    monkeypatch: pytest.MonkeyPatch, handler: Any
) -> list[httpx.Request]:
    seen: list[httpx.Request] = []

    def recording(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    real = httpx.AsyncClient
    monkeypatch.setattr(
        paddle_checkout.httpx,
        "AsyncClient",
        lambda **kw: real(transport=httpx.MockTransport(recording), **kw),
    )
    return seen


@pytest.mark.asyncio
async def test_update_replaces_the_item_and_merges_custom_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    existing = {"plan": "agency_starter", "user_id": "u-1", "organization_id": "o-1"}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(200, json={"data": {"id": SUB, "custom_data": existing}})
        return httpx.Response(200, json={"data": {"id": SUB}})

    seen = _mock_paddle(monkeypatch, handler)
    ok = await paddle_checkout._update_subscription(
        api_base="https://sandbox-api.paddle.com",
        api_key="pdl_test_key",
        subscription_id=SUB,
        price_id="pri_pro",
        plan=Plan.agency_pro,
        proration_billing_mode="prorated_immediately",
    )
    assert ok is True
    assert [r.method for r in seen] == ["GET", "PATCH"]
    assert str(seen[1].url) == f"https://sandbox-api.paddle.com/subscriptions/{SUB}"
    body = json.loads(seen[1].content)
    # Replaced, not appended — appending would bill both plans.
    assert body["items"] == [{"price_id": "pri_pro", "quantity": 1}]
    assert body["proration_billing_mode"] == "prorated_immediately"
    # Only the label moved; the ids the webhook attributes by survive.
    assert body["custom_data"] == {**existing, "plan": "agency_pro"}


@pytest.mark.asyncio
async def test_update_reports_a_declined_change(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(200, json={"data": {"custom_data": {}}})
        return httpx.Response(
            400, json={"error": {"code": "subscription_payment_declined", "detail": "x"}}
        )

    _mock_paddle(monkeypatch, handler)
    ok = await paddle_checkout._update_subscription(
        api_base="https://p",
        api_key="k",
        subscription_id=SUB,
        price_id="pri_pro",
        plan=Plan.agency_pro,
        proration_billing_mode="prorated_immediately",
    )
    assert ok is False
