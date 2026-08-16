"""The consumer subscription lifecycle, both directions.

A consumer checkout carries `user_id` and no `organization_id`, because a
consumer has no organization. The webhook used to key exclusively off
`organization_id`, so every consumer `subscription.created` matched nothing and
was dropped with a 200: the customer paid, Paddle was satisfied, and the site
never unlocked. There was no error anywhere to notice.

These tests pin the whole round trip, upgrade and downgrade, through the same
surface the map actually reads: `/api/me` (what the UI gates on) and
`/api/tiles/url?tier=premium` (what the tiles gate on). Asserting on the
organization row alone would have passed even while both of those said free.

No live Paddle: the signature is built locally with the test secret.
"""

from __future__ import annotations

import json
import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import login
from wtg_api.config import get_settings
from wtg_api.models import Organization, Plan, User
from wtg_api.services.billing import find_personal_organization
from wtg_api.services.paddle import build_signature_header


def _consumer_event(
    event_id: str,
    event_type: str,
    user_id: uuid.UUID,
    plan: str | None = "consumer_premium",
    subscription_id: str = "sub_consumer_1",
    custom_as_string: bool = False,
) -> dict:
    custom: dict[str, str] = {"user_id": str(user_id)}
    if plan is not None:
        custom["plan"] = plan
    return {
        "event_id": event_id,
        "event_type": event_type,
        "data": {
            "id": subscription_id,
            "customer_id": "ctm_test_1",
            "custom_data": (
                ",".join(f"{k}={v}" for k, v in custom.items())
                if custom_as_string
                else custom
            ),
            "items": [],
        },
    }


async def _deliver(client: AsyncClient, payload: dict) -> int:
    body = json.dumps(payload).encode()
    header = build_signature_header(body, get_settings().paddle_webhook_secret)
    res = await client.post(
        "/api/webhooks/paddle",
        content=body,
        headers={"Paddle-Signature": header, "Content-Type": "application/json"},
    )
    return res.status_code


@pytest.mark.asyncio
async def test_consumer_activation_unlocks_me_and_premium_tiles(
    client: AsyncClient, user: User
) -> None:
    login(client, user)

    before = await client.get("/api/me")
    assert before.json()["plan"] == "free"
    assert before.json()["is_premium"] is False
    assert (await client.get("/api/tiles/url?tier=premium")).status_code == 403

    assert await _deliver(client, _consumer_event("evt_c_up", "subscription.created", user.id)) == 200

    after = await client.get("/api/me")
    assert after.status_code == 200
    assert after.json()["plan"] == "consumer_premium"
    assert after.json()["is_premium"] is True
    assert after.json()["is_agency"] is False

    premium = await client.get("/api/tiles/url?tier=premium")
    assert premium.status_code == 200
    assert premium.json()["tier"] == "premium"


@pytest.mark.asyncio
async def test_consumer_cancellation_relocks_premium_tiles(
    client: AsyncClient, sessionmaker, user: User
) -> None:
    """The downgrade half — the one the map's fallback depends on.

    RC-8 made a premium session read every layer from the premium archive, so a
    lapsed subscription that still handed out premium tile URLs (or handed out a
    URL the CDN then refused) would blank the map rather than degrade it. The
    contract the web side relies on is exactly this: once the subscription is
    gone, `/api/tiles/url?tier=premium` is a clean 403.
    """
    login(client, user)
    assert await _deliver(client, _consumer_event("evt_c_up2", "subscription.created", user.id)) == 200
    assert (await client.get("/api/tiles/url?tier=premium")).status_code == 200

    assert (
        await _deliver(
            client,
            _consumer_event("evt_c_down", "subscription.canceled", user.id, plan=None),
        )
        == 200
    )

    me = await client.get("/api/me")
    assert me.json()["plan"] == "free"
    assert me.json()["is_premium"] is False

    denied = await client.get("/api/tiles/url?tier=premium")
    assert denied.status_code == 403

    # Free tiles must keep working — that is the whole fallback.
    assert (await client.get("/api/tiles/url?tier=free")).status_code == 200

    async with sessionmaker() as session:
        org = await find_personal_organization(session, user.id)
        assert org is not None
        assert org.plan == Plan.free
        assert org.paddle_subscription_id is None
        # The customer survives cancellation: their invoices do too, and the
        # portal link is how they reach them.
        assert org.paddle_customer_id == "ctm_test_1"


@pytest.mark.asyncio
async def test_expiry_is_treated_like_cancellation(
    client: AsyncClient, user: User
) -> None:
    login(client, user)
    await _deliver(client, _consumer_event("evt_c_up3", "subscription.created", user.id))
    assert (
        await _deliver(
            client,
            _consumer_event("evt_c_exp", "subscription.expired", user.id, plan=None),
        )
        == 200
    )
    assert (await client.get("/api/tiles/url?tier=premium")).status_code == 403


@pytest.mark.asyncio
async def test_custom_data_as_string_is_understood(
    client: AsyncClient, user: User
) -> None:
    """`customData` goes out on the checkout URL as `k=v,k=v`.

    Whether Paddle echoes that back verbatim or parsed into an object is not
    something this repo controls, and guessing wrong loses the subscription
    silently. Both forms must resolve to the same user.
    """
    login(client, user)
    assert (
        await _deliver(
            client,
            _consumer_event(
                "evt_c_str", "subscription.created", user.id, custom_as_string=True
            ),
        )
        == 200
    )
    assert (await client.get("/api/me")).json()["plan"] == "consumer_premium"


@pytest.mark.asyncio
async def test_repeat_activation_reuses_one_personal_org(
    client: AsyncClient, sessionmaker, user: User
) -> None:
    """Two activations must not leave two orgs for one user.

    `resolve()` takes the best plan across memberships, so a duplicate would
    keep a cancelled user premium forever via the stale row.
    """
    from sqlalchemy import func, select

    await _deliver(client, _consumer_event("evt_dup_1", "subscription.created", user.id))
    await _deliver(client, _consumer_event("evt_dup_2", "subscription.updated", user.id))

    async with sessionmaker() as session:
        count = await session.scalar(
            select(func.count())
            .select_from(Organization)
            .where(Organization.personal_user_id == user.id)
        )
        assert count == 1


@pytest.mark.asyncio
async def test_cancellation_for_unknown_user_creates_nothing(
    client: AsyncClient, sessionmaker, user: User
) -> None:
    """A lapse event for someone who never subscribed must not mint an org."""
    assert (
        await _deliver(
            client,
            _consumer_event("evt_ghost", "subscription.canceled", user.id, plan=None),
        )
        == 200
    )
    async with sessionmaker() as session:
        assert await find_personal_organization(session, user.id) is None


@pytest.mark.asyncio
async def test_unknown_user_id_is_ignored(client: AsyncClient) -> None:
    """A signed event naming a user that does not exist is a 200 no-op."""
    assert (
        await _deliver(
            client,
            _consumer_event("evt_nouser", "subscription.created", uuid.uuid4()),
        )
        == 200
    )


@pytest.mark.asyncio
async def test_replayed_cancellation_cannot_undo_a_resubscribe(
    client: AsyncClient, user: User
) -> None:
    """Cancel → resubscribe → replay of the *old* cancel must not re-lock.

    Idempotency by `event_id` is what makes this safe, and a consumer is the
    case where it bites hardest: the replay is a plain HTTP POST anyone who
    captured the body can repeat, and its effect would be to revoke a
    subscription the user is currently paying for.
    """
    login(client, user)
    await _deliver(client, _consumer_event("evt_rs_1", "subscription.created", user.id))
    cancel = _consumer_event("evt_rs_2", "subscription.canceled", user.id, plan=None)
    await _deliver(client, cancel)
    await _deliver(client, _consumer_event("evt_rs_3", "subscription.created", user.id))
    assert (await client.get("/api/me")).json()["plan"] == "consumer_premium"

    # Same event_id as the earlier cancellation — must be dropped.
    assert await _deliver(client, cancel) == 200
    assert (await client.get("/api/me")).json()["plan"] == "consumer_premium"
    assert (await client.get("/api/tiles/url?tier=premium")).status_code == 200
