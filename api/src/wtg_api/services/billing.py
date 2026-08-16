"""Where a consumer's own subscription lives.

`services.entitlements.resolve` reads the plan off the organizations a user is
a member of, and nothing else. That is fine for agencies, which create an
organization during onboarding, and it left consumer checkouts with nowhere to
land: `subscription.created` for a consumer arrived carrying a `user_id` and no
`organization_id`, and the webhook dropped it.

A "personal organization" closes that: one single-seat organization per user,
marked by `Organization.personal_user_id`, created lazily the first time a
subscription event needs somewhere to record a plan. It is not a user-visible
concept — nothing in the API exposes it as an organization, `/api/me` reports
it only through `plan`, and it is never an agency.

Security note: creating one grants no entitlement by itself. It is created at
`Plan.free` and only a signature-verified webhook moves it off free, so an
unauthenticated caller cannot reach this code path at all.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.models import (
    AGENCY_PLANS,
    DEFAULT_SEAT_CAP,
    Membership,
    Organization,
    Plan,
    Role,
    User,
)


async def find_personal_organization(
    session: AsyncSession, user_id: uuid.UUID
) -> Organization | None:
    """The organization carrying this user's own subscription, if any."""
    return (
        await session.execute(
            select(Organization).where(Organization.personal_user_id == user_id)
        )
    ).scalar_one_or_none()


async def ensure_personal_organization(
    session: AsyncSession, user: User
) -> Organization:
    """Find or create the user's personal organization, at `Plan.free`.

    Flushes so the caller has a primary key to work with, but does not commit —
    the webhook owns the transaction boundary so a failure mid-handler leaves
    neither the org nor the plan change behind.
    """
    existing = await find_personal_organization(session, user.id)
    if existing is not None:
        return existing

    org = Organization(
        # Never rendered anywhere; `/api/me` reports the plan, not this name.
        # Deliberately not the user's email — organization names reach agency
        # surfaces and logs, and this one has no reason to carry an address.
        name="Personal",
        plan=Plan.free,
        seat_cap=DEFAULT_SEAT_CAP[Plan.free],
        personal_user_id=user.id,
    )
    session.add(org)
    await session.flush()
    session.add(
        Membership(user_id=user.id, organization_id=org.id, role=Role.owner)
    )
    await session.flush()
    return org


# Same order `services.entitlements.resolve` ranks by. Kept here rather than
# imported to avoid a cycle; `test_billing.py` pins that they agree.
_PLAN_RANK = [
    Plan.free,
    Plan.consumer_premium,
    Plan.agency_starter,
    Plan.agency_pro,
    Plan.agency_enterprise,
]


async def billable_organization(
    session: AsyncSession, user: User
) -> Organization | None:
    """The organization whose subscription this user may manage.

    The same organization `entitlements.resolve` picks — the highest-tier one
    they belong to — so the plan the billing page prints is by construction the
    plan the rest of the app enforces. Two independent answers to "what is this
    user paying for" is precisely the drift WS-A spent its time undoing.

    One narrowing: an agency organization is only billable by its owner or
    admin. An agent sees the agency's clients, not its card. That user falls
    back to their personal org, which is usually nothing.
    """
    rows = (
        await session.execute(
            select(Organization, Membership.role)
            .join(Membership, Membership.organization_id == Organization.id)
            .where(Membership.user_id == user.id)
        )
    ).all()

    personal: Organization | None = None
    candidates: list[Organization] = []
    for org, role in rows:
        if org.personal_user_id == user.id:
            personal = org
        if org.plan in AGENCY_PLANS and role not in (Role.owner, Role.admin):
            continue
        candidates.append(org)

    if not candidates:
        return personal
    return max(candidates, key=lambda o: _PLAN_RANK.index(o.plan))
