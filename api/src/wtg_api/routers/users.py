from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from wtg_api.deps import current_entitlement, current_user
from wtg_api.models import User
from wtg_api.schemas import MeResponse
from wtg_api.services.entitlements import Entitlement

router = APIRouter(prefix="/api", tags=["users"])


@router.get("/me", response_model=MeResponse)
async def me(
    user: User = Depends(current_user),
    entitlement: Entitlement = Depends(current_entitlement),
) -> MeResponse:
    org_id: uuid.UUID | None = (
        uuid.UUID(entitlement.organization_id) if entitlement.organization_id else None
    )
    return MeResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        plan=entitlement.plan,
        organization_id=org_id,
        is_premium=entitlement.is_premium,
        is_agency=entitlement.is_agency,
    )
