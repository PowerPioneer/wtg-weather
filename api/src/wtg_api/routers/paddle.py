"""Paddle webhook receiver.

Events we care about:
- `subscription.created` / `subscription.updated` / `subscription.activated`
  → set org plan + seat_cap, store paddle_subscription_id.
- `subscription.canceled` / `subscription.expired`
  → revert org to Plan.free, clear paddle_subscription_id.

The org is identified via `custom_data.organization_id` that we include when
creating the checkout. Events are idempotent by `event_id`.

Test/sandbox use a separate Paddle environment; the signing secret differs.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.config import get_settings
from wtg_api.deps import db_session
from wtg_api.models import DEFAULT_SEAT_CAP, Organization, PaddleWebhookEvent, Plan
from wtg_api.services.paddle import verify_signature

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["paddle"])


_PLAN_BY_PRICE: dict[str, Plan] = {
    # Sandbox + prod price IDs are injected via env vars in prod; for the MVP we
    # key off a `plan` value in `custom_data`. This map is the fallback lookup.
}


def _extract_plan(payload: dict[str, Any]) -> Plan | None:
    # Prefer explicit plan stored in custom_data on checkout creation.
    data = payload.get("data") or {}
    custom = (data.get("custom_data") or {}) if isinstance(data, dict) else {}
    plan_str = custom.get("plan") if isinstance(custom, dict) else None
    if isinstance(plan_str, str):
        try:
            return Plan(plan_str)
        except ValueError:
            return None
    # Fallback: look up by first item's price_id.
    items = data.get("items") if isinstance(data, dict) else None
    if isinstance(items, list) and items:
        first = items[0]
        price_id = (
            first.get("price", {}).get("id") if isinstance(first, dict) else None
        )
        if isinstance(price_id, str) and price_id in _PLAN_BY_PRICE:
            return _PLAN_BY_PRICE[price_id]
    return None


def _extract_org_id(payload: dict[str, Any]) -> uuid.UUID | None:
    data = payload.get("data") or {}
    custom = (data.get("custom_data") or {}) if isinstance(data, dict) else {}
    raw = custom.get("organization_id") if isinstance(custom, dict) else None
    if not isinstance(raw, str):
        return None
    try:
        return uuid.UUID(raw)
    except ValueError:
        return None


@router.post("/paddle", status_code=status.HTTP_200_OK)
async def paddle_webhook(
    request: Request,
    paddle_signature: str | None = Header(default=None, alias="Paddle-Signature"),
    session: AsyncSession = Depends(db_session),
) -> Response:
    s = get_settings()
    raw = await request.body()

    if not verify_signature(raw, paddle_signature, s.paddle_webhook_secret):
        logger.warning("paddle.webhook.bad_signature")
        raise HTTPException(status.HTTP_403_FORBIDDEN, "invalid signature")

    payload = await request.json()
    event_id = payload.get("event_id")
    event_type = payload.get("event_type") or ""
    if not isinstance(event_id, str) or not event_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "missing event_id")

    # Idempotency: try to insert the event_id; on duplicate, drop silently.
    session.add(PaddleWebhookEvent(event_id=event_id, event_type=event_type))
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        return Response(status_code=status.HTTP_200_OK)

    org_id = _extract_org_id(payload)
    if org_id is None:
        await session.commit()
        return Response(status_code=status.HTTP_200_OK)

    org = await session.get(Organization, org_id)
    if org is None:
        await session.commit()
        return Response(status_code=status.HTTP_200_OK)

    data = payload.get("data") or {}
    subscription_id = data.get("id") if isinstance(data, dict) else None

    if event_type in ("subscription.created", "subscription.updated", "subscription.activated"):
        plan = _extract_plan(payload)
        if plan is not None:
            org.plan = plan
            org.seat_cap = DEFAULT_SEAT_CAP[plan]
        if isinstance(subscription_id, str):
            org.paddle_subscription_id = subscription_id
    elif event_type in ("subscription.canceled", "subscription.expired"):
        org.plan = Plan.free
        org.seat_cap = DEFAULT_SEAT_CAP[Plan.free]
        org.paddle_subscription_id = None

    await session.commit()
    return Response(status_code=status.HTTP_200_OK)
