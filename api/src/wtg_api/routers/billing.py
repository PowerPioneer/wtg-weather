"""Billing summary + Paddle customer-portal link.

Two endpoints, both authenticated:

- `GET /api/billing` — what the account page prints: the caller's plan, whether
  a subscription is actually on file, and whether a portal link can be minted.
  Deliberately thin. Renewal dates, payment methods and invoices live at Paddle
  and are not mirrored here; the page links out for them rather than printing a
  stale copy (the section it replaces printed a fixture renewal date and "card
  ending 4471" to every subscriber).

- `POST /api/billing/portal` — mints a Paddle customer-portal session and
  returns its URL.

Security: the portal URL is minted **server-side, against the caller's own
resolved organization**, and is never constructed from client input — that is
the contract `web/src/lib/paddle.ts` states and the reason the web side has no
Paddle host in it at all. A portal session is a bearer capability over
somebody's subscription and payment methods: handing the browser the ingredients
to build one would let any signed-in user address any customer id. The Paddle
API key never leaves this process.

Sandbox only. Live-mode credentials are WS-G; with no `PADDLE_API_KEY`
configured this returns 503 rather than inventing a URL, because a fabricated
portal link is indistinguishable from a working one until a user clicks it.
"""

from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.config import get_settings
from wtg_api.deps import current_user, db_session
from wtg_api.models import Organization, Plan, User
from wtg_api.schemas import BillingPortalResponse, BillingSummaryResponse
from wtg_api.services.billing import billable_organization

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("", response_model=BillingSummaryResponse)
async def billing_summary(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> BillingSummaryResponse:
    org = await billable_organization(session, user)
    s = get_settings()
    if org is None:
        return BillingSummaryResponse(
            plan=Plan.free.value,
            has_subscription=False,
            portal_available=False,
            sandbox=s.paddle_sandbox,
        )
    return BillingSummaryResponse(
        plan=org.plan.value,
        has_subscription=org.paddle_subscription_id is not None,
        # Whether the *button* should be offered at all. A free user who has
        # never checked out has no Paddle customer, so the portal has nothing
        # to show them and the UI points them at checkout instead.
        portal_available=_portal_possible(org, s.paddle_api_key),
        sandbox=s.paddle_sandbox,
        organization_id=org.id if org.personal_user_id is None else None,
        seat_cap=org.seat_cap,
    )


def _portal_possible(org: Organization, api_key: str) -> bool:
    return bool(api_key) and org.paddle_customer_id is not None


@router.post("/portal", response_model=BillingPortalResponse)
async def billing_portal(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> BillingPortalResponse:
    s = get_settings()
    org = await billable_organization(session, user)
    if org is None or org.paddle_customer_id is None:
        # 404, not 403: there is no subscription to manage. Distinguishing it
        # from "not yours" matters — the UI shows checkout for one and an error
        # for the other.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no subscription on file")

    if not s.paddle_api_key:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "billing portal is not configured in this environment",
        )

    url = await _create_portal_session(
        api_base=s.paddle_api_base_url,
        api_key=s.paddle_api_key,
        customer_id=org.paddle_customer_id,
        subscription_id=org.paddle_subscription_id,
    )
    if url is None:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "could not reach the billing provider"
        )
    return BillingPortalResponse(portal_url=url, sandbox=s.paddle_sandbox)


async def _create_portal_session(
    *,
    api_base: str,
    api_key: str,
    customer_id: str,
    subscription_id: str | None,
) -> str | None:
    """POST /customers/{id}/portal-sessions, returning the general portal URL.

    Never called in tests against the real host — `PADDLE_API_KEY` is empty in
    the test settings, so the 503 above short-circuits before we get here, and
    the tests that do exercise this patch the transport.
    """
    body: dict[str, object] = {}
    if subscription_id:
        body["subscription_ids"] = [subscription_id]

    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            res = await http.post(
                f"{api_base}/customers/{customer_id}/portal-sessions",
                json=body,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
    except httpx.HTTPError:
        # No customer id, no key, no URL in the log line — just the fact.
        logger.warning("paddle.portal.transport_error")
        return None

    if res.status_code >= 400:
        logger.warning("paddle.portal.rejected", extra={"status": res.status_code})
        return None

    payload = res.json()
    data = payload.get("data") if isinstance(payload, dict) else None
    urls = data.get("urls") if isinstance(data, dict) else None
    general = urls.get("general") if isinstance(urls, dict) else None
    overview = general.get("overview") if isinstance(general, dict) else None
    return overview if isinstance(overview, str) else None
