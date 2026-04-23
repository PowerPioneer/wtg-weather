"""Paddle checkout URL issuer.

Returns a sandbox Paddle checkout URL for the chosen plan. Webhook side (see
`routers/paddle.py`) resolves `organization_id` + `plan` from `custom_data`
attached at checkout creation time — we set both here.

Security: only authenticated users may request a checkout URL; a forged
`organization_id` is rejected if the caller has no membership in it. No
Paddle-live secrets are involved in this endpoint — sandbox only in dev; the
production-switch happens in Phase 7.
"""

from __future__ import annotations

import uuid
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.config import get_settings
from wtg_api.deps import current_user, db_session
from wtg_api.models import Membership, Plan, User
from wtg_api.schemas import PaddleCheckoutRequest, PaddleCheckoutResponse

router = APIRouter(prefix="/api/paddle", tags=["paddle"])


def _price_for(plan: Plan) -> str | None:
    s = get_settings()
    return {
        Plan.consumer_premium: s.paddle_price_consumer_premium,
        Plan.agency_starter: s.paddle_price_agency_starter,
        Plan.agency_pro: s.paddle_price_agency_pro,
    }.get(plan)


@router.post("/checkout-url", response_model=PaddleCheckoutResponse)
async def checkout_url(
    payload: PaddleCheckoutRequest,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> PaddleCheckoutResponse:
    s = get_settings()
    plan = Plan(payload.plan)
    price_id = _price_for(plan)
    if price_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "unsupported plan")

    org_id: uuid.UUID | None = None
    if payload.organization_id is not None:
        membership = (
            await session.execute(
                select(Membership).where(
                    Membership.user_id == user.id,
                    Membership.organization_id == payload.organization_id,
                )
            )
        ).scalar_one_or_none()
        if membership is None:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "no access to that organization"
            )
        org_id = payload.organization_id

    custom_data = {"plan": plan.value, "user_id": str(user.id)}
    if org_id is not None:
        custom_data["organization_id"] = str(org_id)

    query = {
        "items[0][priceId]": price_id,
        "items[0][quantity]": "1",
        "customData": ",".join(f"{k}={v}" for k, v in custom_data.items()),
        "customerEmail": user.email,
    }
    checkout = f"{s.paddle_checkout_base_url}?{urlencode(query)}"

    return PaddleCheckoutResponse(
        checkout_url=checkout, sandbox=s.paddle_sandbox, plan=plan.value
    )
