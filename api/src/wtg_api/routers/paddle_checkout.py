"""Paddle checkout opener.

Creates a Paddle **transaction** for the chosen plan and hands the caller its
id. The browser opens the overlay with `Paddle.Checkout.open({transactionId})`
(see `web/src/hooks/use-checkout.ts`); the server-side `/upgrade` route
redirects to the same transaction's `checkout.url` instead.

Why a transaction and not a URL. Paddle Billing has no hand-buildable checkout
link: `pri_` prices are only addressable through Paddle.js or through a
transaction created by the API. This endpoint used to assemble
`checkout.paddle.com/checkout/custom?items[0][priceId]=…`, which is Paddle
*Classic* and cannot take a `pri_` price — it had never been exercised against
Paddle, and the tests pinned the broken shape.

Security: only authenticated users may create a transaction, and a forged
`organization_id` is rejected if the caller has no membership in it. That check
is the whole point of minting server-side. `custom_data` — `plan`, `user_id`,
`organization_id` — is attached here, inside a request authenticated by our
API key, so the browser can neither see nor alter it. That matters more than it
looks: `routers/paddle.py::_extract_plan` reads the plan straight out of
`custom_data`, so a client able to set it could pay for the cheapest price
while claiming `agency_pro`. Keeping the browser out of `custom_data` is what
makes that safe, and it is the reason the overlay is opened by transaction id
rather than by price id.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.config import get_settings
from wtg_api.deps import current_user, db_session
from wtg_api.models import Membership, Plan, User
from wtg_api.schemas import (
    PaddleCheckoutRequest,
    PaddleCheckoutResponse,
    PaddlePricesResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/paddle", tags=["paddle"])


def _price_for(plan: Plan) -> str | None:
    s = get_settings()
    return {
        Plan.consumer_premium: s.paddle_price_consumer_premium,
        Plan.agency_starter: s.paddle_price_agency_starter,
        Plan.agency_pro: s.paddle_price_agency_pro,
    }.get(plan)


@router.get("/prices", response_model=PaddlePricesResponse)
async def prices() -> PaddlePricesResponse:
    """Price ids for the pricing page's `Paddle.PricePreview()` call.

    Unauthenticated: the pricing page is public and is the whole point. Only
    plans that actually have a price id are listed, so a plan sold by "contact
    sales" (`agency_enterprise`) simply does not appear and the page has
    nothing to preview for it.
    """
    s = get_settings()
    configured = {
        plan.value: price
        for plan, price in ((p, _price_for(p)) for p in Plan)
        if price
    }
    return PaddlePricesResponse(prices=configured, sandbox=s.paddle_sandbox)


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

    # Same keys the webhook reads back. `user_id` is what resolves a consumer
    # checkout to a personal organization; `organization_id` short-circuits
    # that for agency plans.
    custom_data: dict[str, str] = {"plan": plan.value, "user_id": str(user.id)}
    if org_id is not None:
        custom_data["organization_id"] = str(org_id)

    # Unlike the old URL-building version this endpoint cannot work without a
    # key. Fail loudly rather than handing back something that 404s at Paddle:
    # a dev box with no key gets a clear 503, not a mysterious dead checkout.
    if not s.paddle_api_key:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "paddle checkout is not configured in this environment",
        )

    # Prefills the email at checkout. Best-effort: a failure here costs the
    # buyer one field of typing, so it must not cost them the checkout.
    # `Checkout.open` takes `transactionId` *instead of* an items array and
    # will not accept a `customer` alongside it, so this is the only place the
    # prefill can come from.
    customer_id = await _find_or_create_customer(
        api_base=s.paddle_api_base_url, api_key=s.paddle_api_key, email=user.email
    )

    created = await _create_transaction(
        api_base=s.paddle_api_base_url,
        api_key=s.paddle_api_key,
        price_id=price_id,
        custom_data=custom_data,
        payment_link_url=s.paddle_payment_link_url,
        customer_id=customer_id,
    )
    if created is None:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "could not start a checkout right now"
        )

    transaction_id, checkout = created
    return PaddleCheckoutResponse(
        transaction_id=transaction_id,
        checkout_url=checkout,
        sandbox=s.paddle_sandbox,
        plan=plan.value,
    )


async def _find_or_create_customer(
    *, api_base: str, api_key: str, email: str
) -> str | None:
    """The Paddle customer id for this email, creating one if needed.

    Looked up before creating rather than relying on the 409 that a duplicate
    email returns, because the lookup is the common case after the first
    purchase and reading the conflict body to recover the existing id is more
    fragile than just asking.

    Returns None on any failure. The caller treats a missing customer as "let
    the checkout collect the email", which is exactly what happened before
    this existed — never as a reason to fail the checkout.
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            found = await http.get(
                f"{api_base}/customers",
                params={"email": email, "status": "active"},
                headers=headers,
            )
            if found.status_code < 400:
                data = found.json().get("data")
                if isinstance(data, list) and data:
                    first = data[0]
                    existing = first.get("id") if isinstance(first, dict) else None
                    if isinstance(existing, str):
                        return existing

            made = await http.post(
                f"{api_base}/customers", json={"email": email}, headers=headers
            )
    except httpx.HTTPError:
        # No email in the log line — `.claude/rules/security.md` forbids it.
        logger.warning("paddle.customer.transport_error")
        return None

    if made.status_code >= 400:
        logger.warning("paddle.customer.rejected", extra={"status": made.status_code})
        return None

    payload = made.json()
    data = payload.get("data") if isinstance(payload, dict) else None
    new_id = data.get("id") if isinstance(data, dict) else None
    return new_id if isinstance(new_id, str) else None


async def _create_transaction(
    *,
    api_base: str,
    api_key: str,
    price_id: str,
    custom_data: dict[str, str],
    payment_link_url: str,
    customer_id: str | None = None,
) -> tuple[str, str | None] | None:
    """POST /transactions, returning `(transaction_id, checkout_url)`.

    Never called in tests against the real host — the 503 above short-circuits
    on the empty test key, and the tests that exercise this monkeypatch it, the
    same arrangement `routers/billing.py::_create_portal_session` uses.

    `customer_id` is optional and the transaction stays `draft` either way —
    Paddle only marks one `ready` once it has an address too, which the
    checkout collects. With a customer the email is prefilled; without, the
    buyer types it.
    """
    body: dict[str, Any] = {
        "items": [{"price_id": price_id, "quantity": 1}],
        "custom_data": custom_data,
    }
    if customer_id:
        body["customer_id"] = customer_id
    # Names the page we expect Paddle to send customers to, rather than
    # depending on the dashboard's default payment link matching this repo.
    if payment_link_url:
        body["checkout"] = {"url": payment_link_url}

    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            res = await http.post(
                f"{api_base}/transactions",
                json=body,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
    except httpx.HTTPError:
        # No key, no price, no email in the log line — just the fact.
        logger.warning("paddle.transaction.transport_error")
        return None

    if res.status_code >= 400:
        # A 403 here usually means a sandbox key against the live host or the
        # reverse; a 400 usually means the price id is from the other
        # environment. Both are configuration, not a customer's problem.
        logger.warning(
            "paddle.transaction.rejected", extra={"status": res.status_code}
        )
        return None

    payload = res.json()
    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, dict):
        logger.warning("paddle.transaction.malformed")
        return None

    transaction_id = data.get("id")
    if not isinstance(transaction_id, str) or not transaction_id:
        logger.warning("paddle.transaction.malformed")
        return None

    checkout = data.get("checkout")
    url = checkout.get("url") if isinstance(checkout, dict) else None
    return transaction_id, url if isinstance(url, str) else None
