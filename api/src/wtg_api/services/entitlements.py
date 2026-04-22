"""Resolve a user's effective plan by looking at their memberships.

In production this is wrapped by a 60s Redis cache; the cache layer is
deliberately a thin decorator so unit tests can exercise the pure resolver.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.models import AGENCY_PLANS, PREMIUM_PLANS, Membership, Organization, Plan, User


@dataclass(frozen=True)
class Entitlement:
    user_id: str
    plan: Plan
    organization_id: str | None
    is_premium: bool
    is_agency: bool


async def resolve(session: AsyncSession, user: User) -> Entitlement:
    """Resolve a user's best (highest-tier) plan across their memberships.

    Free if they have no memberships. Otherwise the highest tier of any org
    they belong to.
    """
    stmt = (
        select(Organization)
        .join(Membership, Membership.organization_id == Organization.id)
        .where(Membership.user_id == user.id)
    )
    orgs = (await session.execute(stmt)).scalars().all()
    if not orgs:
        return Entitlement(
            user_id=str(user.id),
            plan=Plan.free,
            organization_id=None,
            is_premium=False,
            is_agency=False,
        )
    # Rank: free < consumer_premium < agency_starter < agency_pro < agency_enterprise
    ranking = [
        Plan.free,
        Plan.consumer_premium,
        Plan.agency_starter,
        Plan.agency_pro,
        Plan.agency_enterprise,
    ]
    best = max(orgs, key=lambda o: ranking.index(o.plan))
    return Entitlement(
        user_id=str(user.id),
        plan=best.plan,
        organization_id=str(best.id),
        is_premium=best.plan in PREMIUM_PLANS,
        is_agency=best.plan in AGENCY_PLANS,
    )


def has_tier(entitlement: Entitlement, required: Plan) -> bool:
    ranking = [
        Plan.free,
        Plan.consumer_premium,
        Plan.agency_starter,
        Plan.agency_pro,
        Plan.agency_enterprise,
    ]
    return ranking.index(entitlement.plan) >= ranking.index(required)
