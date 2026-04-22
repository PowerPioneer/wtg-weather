from __future__ import annotations

import json
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from wtg_api.config import get_settings
from wtg_api.models import Organization, PaddleWebhookEvent, Plan
from wtg_api.services.paddle import build_signature_header


def _event(
    event_id: str,
    event_type: str,
    organization_id: uuid.UUID,
    plan: str | None = None,
    subscription_id: str = "sub_123",
) -> dict:
    custom: dict[str, str] = {"organization_id": str(organization_id)}
    if plan is not None:
        custom["plan"] = plan
    return {
        "event_id": event_id,
        "event_type": event_type,
        "data": {
            "id": subscription_id,
            "custom_data": custom,
            "items": [],
        },
    }


@pytest.mark.asyncio
async def test_forged_signature_rejected(client: AsyncClient, premium_user) -> None:
    _user, org = premium_user
    body = json.dumps(_event("evt_forged", "subscription.created", org.id)).encode()
    r = await client.post(
        "/api/webhooks/paddle",
        content=body,
        headers={
            "Paddle-Signature": "ts=1700000000;h1=deadbeef",
            "Content-Type": "application/json",
        },
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_missing_signature_rejected(client: AsyncClient, premium_user) -> None:
    _user, org = premium_user
    body = json.dumps(_event("evt_x", "subscription.created", org.id)).encode()
    r = await client.post(
        "/api/webhooks/paddle", content=body, headers={"Content-Type": "application/json"}
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_valid_signature_activates_plan(
    client: AsyncClient, sessionmaker, premium_user
) -> None:
    _user, org = premium_user
    # Reset the org to free so we can assert the webhook upgrades it.
    async with sessionmaker() as session:
        fresh = await session.get(Organization, org.id)
        assert fresh is not None
        fresh.plan = Plan.free
        fresh.seat_cap = 1
        await session.commit()

    body = json.dumps(
        _event("evt_activate_1", "subscription.created", org.id, plan="agency_pro")
    ).encode()
    header = build_signature_header(body, get_settings().paddle_webhook_secret)
    r = await client.post(
        "/api/webhooks/paddle",
        content=body,
        headers={"Paddle-Signature": header, "Content-Type": "application/json"},
    )
    assert r.status_code == 200

    async with sessionmaker() as session:
        refreshed = await session.get(Organization, org.id)
        assert refreshed is not None
        assert refreshed.plan == Plan.agency_pro
        assert refreshed.seat_cap == 10
        assert refreshed.paddle_subscription_id == "sub_123"


@pytest.mark.asyncio
async def test_cancel_reverts_to_free(
    client: AsyncClient, sessionmaker, premium_user
) -> None:
    _user, org = premium_user
    body = json.dumps(_event("evt_cancel_1", "subscription.canceled", org.id)).encode()
    header = build_signature_header(body, get_settings().paddle_webhook_secret)
    r = await client.post(
        "/api/webhooks/paddle",
        content=body,
        headers={"Paddle-Signature": header, "Content-Type": "application/json"},
    )
    assert r.status_code == 200
    async with sessionmaker() as session:
        refreshed = await session.get(Organization, org.id)
        assert refreshed is not None
        assert refreshed.plan == Plan.free
        assert refreshed.paddle_subscription_id is None


@pytest.mark.asyncio
async def test_replayed_event_is_idempotent(
    client: AsyncClient, sessionmaker, premium_user
) -> None:
    """A replay (same event_id, attacker-modified plan) must not mutate state."""
    _user, org = premium_user

    first = json.dumps(
        _event("evt_replay", "subscription.created", org.id, plan="agency_pro")
    ).encode()
    header = build_signature_header(first, get_settings().paddle_webhook_secret)
    r = await client.post(
        "/api/webhooks/paddle",
        content=first,
        headers={"Paddle-Signature": header, "Content-Type": "application/json"},
    )
    assert r.status_code == 200

    # Replay with SAME event_id but attempting to upgrade to enterprise.
    second = json.dumps(
        _event("evt_replay", "subscription.updated", org.id, plan="agency_enterprise")
    ).encode()
    header2 = build_signature_header(second, get_settings().paddle_webhook_secret)
    r2 = await client.post(
        "/api/webhooks/paddle",
        content=second,
        headers={"Paddle-Signature": header2, "Content-Type": "application/json"},
    )
    assert r2.status_code == 200

    async with sessionmaker() as session:
        refreshed = await session.get(Organization, org.id)
        assert refreshed is not None
        # Plan must still be what the FIRST event set, not the replay.
        assert refreshed.plan == Plan.agency_pro

        # And the event ledger must have exactly one row for this event_id.
        count = (
            await session.execute(
                select(PaddleWebhookEvent).where(
                    PaddleWebhookEvent.event_id == "evt_replay"
                )
            )
        ).scalars().all()
        assert len(count) == 1


@pytest.mark.asyncio
async def test_missing_event_id_rejected(
    client: AsyncClient, premium_user
) -> None:
    _user, org = premium_user
    payload = {"event_type": "subscription.created", "data": {}}
    body = json.dumps(payload).encode()
    header = build_signature_header(body, get_settings().paddle_webhook_secret)
    r = await client.post(
        "/api/webhooks/paddle",
        content=body,
        headers={"Paddle-Signature": header, "Content-Type": "application/json"},
    )
    assert r.status_code == 400
