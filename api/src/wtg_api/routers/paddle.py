"""Paddle webhook receiver.

Events we care about:
- `subscription.created` / `subscription.updated` / `subscription.activated`
  → set org plan + seat_cap, store paddle_subscription_id.
- `subscription.canceled` / `subscription.expired`
  → revert org to Plan.free, clear paddle_subscription_id.

Which organization the event applies to comes from the `custom_data` we attach
at checkout creation (`routers/paddle_checkout.py`):

- agency checkouts carry `organization_id` — that org is the subject;
- consumer checkouts carry only `user_id`, and the subject is that user's
  personal organization (`services.billing`), created on demand. Before this
  existed a consumer's `subscription.created` matched no org and was dropped,
  so a paid-for Premium subscription never reached `/api/me` or the tile
  entitlement — the buyer stayed on free with no error anywhere.

Events are idempotent by `event_id`.

Security: the plan is taken from the *signed* payload only. `custom_data` is
attacker-controlled in the sense that anyone who can forge a request body can
put anything in it — which is exactly why the HMAC check above runs first and
why a replayed `event_id` is dropped before any mutation. Nothing here trusts
an identifier that did not arrive inside a verified body.

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
from wtg_api.models import DEFAULT_SEAT_CAP, Organization, PaddleWebhookEvent, Plan, User
from wtg_api.services.billing import (
    ensure_personal_organization,
    find_personal_organization,
)
from wtg_api.services.paddle import verify_signature

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["paddle"])


_ACTIVATING_EVENTS = frozenset(
    {"subscription.created", "subscription.updated", "subscription.activated"}
)
_LAPSING_EVENTS = frozenset({"subscription.canceled", "subscription.expired"})


_PLAN_BY_PRICE: dict[str, Plan] = {
    # Sandbox + prod price IDs are injected via env vars in prod; for the MVP we
    # key off a `plan` value in `custom_data`. This map is the fallback lookup.
}


def _custom_data(payload: dict[str, Any]) -> dict[str, str]:
    """The event's `custom_data`, as a flat string map.

    Paddle echoes back whatever was attached at checkout creation. We send it
    as a `k=v,k=v` string in the checkout URL's query (see
    `routers/paddle_checkout.py`) and Paddle may hand it back either verbatim
    or parsed into an object depending on how the checkout was created. Accept
    both rather than depending on which — getting this wrong silently drops the
    subscription, and the failure is invisible until a paying customer
    complains that nothing unlocked.
    """
    data = payload.get("data") or {}
    raw = data.get("custom_data") if isinstance(data, dict) else None

    if isinstance(raw, dict):
        return {k: v for k, v in raw.items() if isinstance(v, str)}
    if isinstance(raw, str):
        out: dict[str, str] = {}
        for part in raw.split(","):
            key, sep, value = part.partition("=")
            if sep:
                out[key.strip()] = value.strip()
        return out
    return {}


def _extract_plan(payload: dict[str, Any]) -> Plan | None:
    # Prefer explicit plan stored in custom_data on checkout creation.
    data = payload.get("data") or {}
    custom = _custom_data(payload)
    plan_str = custom.get("plan")
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


def _extract_uuid(payload: dict[str, Any], key: str) -> uuid.UUID | None:
    raw = _custom_data(payload).get(key)
    if not isinstance(raw, str):
        return None
    try:
        return uuid.UUID(raw)
    except ValueError:
        return None


def _extract_org_id(payload: dict[str, Any]) -> uuid.UUID | None:
    return _extract_uuid(payload, "organization_id")


def _extract_user_id(payload: dict[str, Any]) -> uuid.UUID | None:
    return _extract_uuid(payload, "user_id")


async def _subject_organization(
    session: AsyncSession, payload: dict[str, Any], event_type: str
) -> Organization | None:
    """Which organization this event mutates, or None to ignore the event."""
    org_id = _extract_org_id(payload)
    if org_id is not None:
        return await session.get(Organization, org_id)

    user_id = _extract_user_id(payload)
    if user_id is None:
        return None
    user = await session.get(User, user_id)
    if user is None:
        return None

    # A cancellation for a user who never had a personal org is a no-op, and
    # creating one to immediately set it free would be pure noise. Only an
    # activation is allowed to bring the org into existence.
    if event_type in _ACTIVATING_EVENTS:
        return await ensure_personal_organization(session, user)
    return await find_personal_organization(session, user_id)


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

    org = await _subject_organization(session, payload, event_type)
    if org is None:
        await session.commit()
        return Response(status_code=status.HTTP_200_OK)

    data = payload.get("data") or {}
    subscription_id = data.get("id") if isinstance(data, dict) else None
    customer_id = data.get("customer_id") if isinstance(data, dict) else None

    if event_type in _ACTIVATING_EVENTS:
        plan = _extract_plan(payload)
        if plan is not None:
            org.plan = plan
            org.seat_cap = DEFAULT_SEAT_CAP[plan]
        if isinstance(subscription_id, str):
            org.paddle_subscription_id = subscription_id
        # Kept so the customer-portal endpoint has something to mint against
        # without a lookup round-trip to Paddle.
        if isinstance(customer_id, str):
            org.paddle_customer_id = customer_id
    elif event_type in _LAPSING_EVENTS:
        org.plan = Plan.free
        org.seat_cap = DEFAULT_SEAT_CAP[Plan.free]
        org.paddle_subscription_id = None
        # `paddle_customer_id` deliberately survives: the customer still exists
        # at Paddle, still has invoices to download, and may resubscribe.

    # Not PII: an org id and a plan name, no email and no address. The
    # cancellation branch is the one nobody notices going wrong, so it gets a
    # line either way.
    logger.info(
        "paddle.webhook.applied",
        extra={"organization_id": str(org.id), "event_type": event_type},
    )
    await session.commit()
    return Response(status_code=status.HTTP_200_OK)
