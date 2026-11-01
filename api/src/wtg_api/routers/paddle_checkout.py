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

Security: only authenticated users may create a transaction. An agency plan
must name an agency the caller owns or administers; a consumer plan may name no
organization but the caller's own personal one; and an organization that is
already subscribed gets 409, because a second checkout is a second subscription
billing alongside the first. Those checks are the whole point of minting
server-side. Plan changes go through `/change-plan`, which updates the existing
subscription in place. `custom_data` — `plan`, `user_id`,
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
import time
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.config import get_settings
from wtg_api.deps import current_user, db_session
from wtg_api.models import AGENCY_PLANS, DEFAULT_SEAT_CAP, Plan, User
from wtg_api.schemas import (
    PaddleCheckoutRequest,
    PaddleCheckoutResponse,
    PaddlePlanChangeRequest,
    PaddlePlanChangeResponse,
    PaddlePricesResponse,
)
from wtg_api.services.billing import find_personal_organization, managed_agency_organization
from wtg_api.services.invites import seat_usage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/paddle", tags=["paddle"])

#: Machine-readable 409 code. The web turns it into a plan change rather than
#: an error (`web/src/lib/paddle.ts`).
ALREADY_SUBSCRIBED = "already_subscribed"

#: The self-serve agency ladder, cheapest first. Enterprise is not on it: it is
#: sold by conversation, with no price id to move to or from.
_AGENCY_LADDER = (Plan.agency_starter, Plan.agency_pro)


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
    formatted = await _formatted_base_prices(
        api_base=s.paddle_api_base_url,
        api_key=s.paddle_api_key,
        price_ids=configured,
    )
    return PaddlePricesResponse(
        prices=configured, formatted=formatted, sandbox=s.paddle_sandbox
    )


# Paddle's own formatted amounts, cached in-process. Prices change roughly
# never, the pricing page is public and cacheable, and asking Paddle on every
# render would put an outbound HTTP call in front of an anonymous page.
#
# Failures are cached too, for less time. Uncached, a Paddle outage turned
# every anonymous `/api/paddle/prices` into an outbound call with a 10-second
# timeout — work any visitor could trigger at will.
_PRICE_CACHE: dict[str, tuple[float, dict[str, str]]] = {}  # key -> (expires, value)
_PRICE_CACHE_TTL = 300.0
_PRICE_FAILURE_TTL = 60.0


async def _formatted_base_prices(
    *, api_base: str, api_key: str, price_ids: dict[str, str]
) -> dict[str, str]:
    """`{plan: "€2.99"}` from Paddle, or `{}` if it cannot be reached.

    Empty is a supported answer, not an error: the web falls back to its own
    copy rather than rendering a pricing page with a hole in it. What it must
    never do is invent a number, which is the whole point of sourcing this
    from Paddle instead of from a constant somebody edits by hand.
    """
    if not api_key or not price_ids:
        return {}

    key = "|".join(sorted(price_ids.values()))
    hit = _PRICE_CACHE.get(key)
    if hit and time.monotonic() < hit[0]:
        return hit[1]

    fetched = await _fetch_formatted_prices(
        api_base=api_base, api_key=api_key, price_ids=price_ids
    )
    ttl = _PRICE_CACHE_TTL if fetched is not None else _PRICE_FAILURE_TTL
    out = fetched or {}
    _PRICE_CACHE[key] = (time.monotonic() + ttl, out)
    return out


async def _fetch_formatted_prices(
    *, api_base: str, api_key: str, price_ids: dict[str, str]
) -> dict[str, str] | None:
    """One `/pricing-preview` call. None when Paddle failed or answered nonsense."""
    body = {
        "items": [{"price_id": pid, "quantity": 1} for pid in price_ids.values()]
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            res = await http.post(
                f"{api_base}/pricing-preview",
                json=body,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
    except httpx.HTTPError:
        logger.warning("paddle.pricing_preview.transport_error")
        return None

    if res.status_code >= 400:
        logger.warning(
            "paddle.pricing_preview.rejected", extra={"status": res.status_code}
        )
        return None

    payload = res.json()
    data = payload.get("data") if isinstance(payload, dict) else None
    details = data.get("details") if isinstance(data, dict) else None
    line_items = details.get("line_items") if isinstance(details, dict) else None
    if not isinstance(line_items, list):
        return None

    by_price: dict[str, str] = {}
    for item in line_items:
        if not isinstance(item, dict):
            continue
        price = item.get("price")
        totals = item.get("formatted_totals")
        pid = price.get("id") if isinstance(price, dict) else None
        total = totals.get("total") if isinstance(totals, dict) else None
        if isinstance(pid, str) and isinstance(total, str):
            by_price[pid] = total

    return {
        plan: by_price[pid] for plan, pid in price_ids.items() if pid in by_price
    }


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
    if plan in AGENCY_PLANS:
        # Seats attach to an agency, so an agency plan names one — and only an
        # owner or admin may buy for it. Without the org the webhook would fall
        # back to the buyer's personal organization and put agency seats there.
        if payload.organization_id is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "agency plans need an organization"
            )
        target = await managed_agency_organization(
            session, user, payload.organization_id
        )
        if target is None:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "no access to that organization"
            )
        org_id = target.id
    else:
        # A consumer plan lands on the buyer's own personal organization, which
        # the webhook finds from `user_id`. Naming any other organization here
        # is how a Premium checkout used to overwrite an agency's plan.
        target = await find_personal_organization(session, user.id)
        if payload.organization_id is not None and (
            target is None or target.id != payload.organization_id
        ):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "consumer plans cannot be bought for an organization",
            )

    # A second checkout for an organization already paying would create a
    # second subscription: the webhook re-points the org at the new one and the
    # old one keeps billing. Changing plan is `/change-plan`.
    if target is not None and target.paddle_subscription_id is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"code": ALREADY_SUBSCRIBED, "message": "already subscribed — change plan instead"},
        )

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


@router.post("/change-plan", response_model=PaddlePlanChangeResponse)
async def change_plan(
    payload: PaddlePlanChangeRequest,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> PaddlePlanChangeResponse:
    """Move an agency's subscription to another plan, in place.

    The organization row is not written here. Paddle answers the update with a
    `subscription.updated` webhook carrying the merged `custom_data`, and that
    is what moves `plan` and `seat_cap` — the same path every other plan
    change takes, so there is one writer.
    """
    s = get_settings()
    plan = Plan(payload.plan)
    org = await managed_agency_organization(session, user, payload.organization_id)
    if org is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "no access to that organization")
    if org.paddle_subscription_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "no subscription to change — check out instead")
    if org.plan not in _AGENCY_LADDER:
        raise HTTPException(status.HTTP_409_CONFLICT, "this plan is changed by contacting us")
    if org.plan == plan:
        raise HTTPException(status.HTTP_409_CONFLICT, "already on that plan")

    usage = await seat_usage(session, org.id, org.seat_cap)
    if usage.members > DEFAULT_SEAT_CAP[plan]:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{usage.members} members is more than that plan's {DEFAULT_SEAT_CAP[plan]} seats",
        )

    price_id = _price_for(plan)
    if not s.paddle_api_key or price_id is None:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "paddle is not configured in this environment",
        )

    # An upgrade charges the prorated difference now; a downgrade waits for the
    # renewal rather than refunding mid-period. With Paddle's default
    # `on_payment_failure: prevent_change`, a declined card leaves the
    # subscription on its old plan and Paddle answers with an error.
    upgrade = _AGENCY_LADDER.index(plan) > _AGENCY_LADDER.index(org.plan)
    proration = "prorated_immediately" if upgrade else "prorated_next_billing_period"

    ok = await _update_subscription(
        api_base=s.paddle_api_base_url,
        api_key=s.paddle_api_key,
        subscription_id=org.paddle_subscription_id,
        price_id=price_id,
        plan=plan,
        proration_billing_mode=proration,
    )
    if not ok:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "could not change the plan right now")

    logger.info(
        "paddle.subscription.change_requested organization_id=%s from=%s to=%s",
        org.id,
        org.plan.value,
        plan.value,
    )
    return PaddlePlanChangeResponse(
        plan=plan.value,
        billed="immediately" if upgrade else "next_billing_period",
    )


async def _update_subscription(
    *,
    api_base: str,
    api_key: str,
    subscription_id: str,
    price_id: str,
    plan: Plan,
    proration_billing_mode: str,
) -> bool:
    """Swap the subscription's single item for `price_id`, and its plan label.

    `items` is a full replacement, which is what a one-item plan change wants;
    appending would bill both plans. `custom_data` is replaced whole too, so the
    current one is read first and only `plan` changed in it — the webhook's
    `_extract_plan` reads `custom_data["plan"]` before the price, and would
    otherwise put the old plan straight back.
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    url = f"{api_base}/subscriptions/{subscription_id}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            current = await http.get(url, headers=headers)
            if current.status_code >= 400:
                logger.warning(
                    "paddle.subscription.read_rejected status=%s code=%s",
                    current.status_code,
                    _paddle_error_code(current),
                )
                return False
            data = current.json().get("data")
            existing = data.get("custom_data") if isinstance(data, dict) else None
            custom_data = dict(existing) if isinstance(existing, dict) else {}
            custom_data["plan"] = plan.value

            res = await http.patch(
                url,
                json={
                    "items": [{"price_id": price_id, "quantity": 1}],
                    "proration_billing_mode": proration_billing_mode,
                    "custom_data": custom_data,
                },
                headers=headers,
            )
    except httpx.HTTPError:
        logger.warning("paddle.subscription.transport_error")
        return False

    if res.status_code >= 400:
        # Paddle's code says which of our settings is wrong, or that the card
        # was declined (the change is then not applied). No customer data.
        logger.warning(
            "paddle.subscription.update_rejected status=%s code=%s detail=%s",
            res.status_code,
            _paddle_error_code(res),
            _paddle_error_detail(res),
        )
        return False
    return True


def _paddle_error(res: httpx.Response) -> dict[str, Any]:
    try:
        payload = res.json()
    except ValueError:
        return {}
    err = payload.get("error") if isinstance(payload, dict) else None
    return err if isinstance(err, dict) else {}


def _paddle_error_code(res: httpx.Response) -> str:
    code = _paddle_error(res).get("code")
    return code if isinstance(code, str) else "unknown"


def _paddle_error_detail(res: httpx.Response) -> str:
    detail = _paddle_error(res).get("detail")
    # Truncated: Paddle's details are a sentence, but a log line is not the
    # place to discover that assumption was wrong.
    return detail[:200] if isinstance(detail, str) else ""


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
        # Paddle's own machine-readable code, in the message rather than in
        # `extra`, because the default formatter drops extras and a bare
        # "rejected" is not actionable — every one of these is a configuration
        # problem with a specific name. `transaction_checkout_url_domain_is_
        # not_approved` means the payment link's domain is not approved;
        # a 403 usually means a sandbox key against the live host or the
        # reverse; `price_id` errors mean ids from the other environment.
        # The code and detail are Paddle's own descriptions of *our* config
        # and carry no customer data.
        logger.warning(
            "paddle.transaction.rejected status=%s code=%s detail=%s",
            res.status_code,
            _paddle_error_code(res),
            _paddle_error_detail(res),
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
