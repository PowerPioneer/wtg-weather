from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.deps import current_entitlement, current_user, db_session
from wtg_api.models import Membership, Organization, User
from wtg_api.schemas import MeOrganization, MeResponse
from wtg_api.services.entitlements import Entitlement

router = APIRouter(prefix="/api", tags=["users"])


@router.get("/me", response_model=MeResponse)
async def me(
    user: User = Depends(current_user),
    entitlement: Entitlement = Depends(current_entitlement),
    session: AsyncSession = Depends(db_session),
) -> MeResponse:
    org_id: uuid.UUID | None = (
        uuid.UUID(entitlement.organization_id) if entitlement.organization_id else None
    )

    organization: MeOrganization | None = None
    role = None
    if org_id is not None:
        organization = await _load_organization(session, org_id)
        role = await session.scalar(
            select(Membership.role).where(
                Membership.user_id == user.id,
                Membership.organization_id == org_id,
            )
        )

    return MeResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        plan=entitlement.plan,
        organization_id=org_id,
        is_premium=entitlement.is_premium,
        is_agency=entitlement.is_agency,
        role=role,
        created_at=user.created_at,
        organization=organization,
    )


async def _load_organization(
    session: AsyncSession, org_id: uuid.UUID
) -> MeOrganization | None:
    org = await session.get(Organization, org_id)
    if org is None:
        return None
    seats_used = await session.scalar(
        select(func.count())
        .select_from(Membership)
        .where(Membership.organization_id == org_id)
    )
    return MeOrganization(
        id=org.id,
        name=org.name,
        plan=org.plan,
        seat_cap=org.seat_cap,
        seats_used=seats_used or 0,
        created_at=org.created_at,
    )
