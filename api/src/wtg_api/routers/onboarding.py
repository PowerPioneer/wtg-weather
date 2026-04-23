"""Onboarding wizard progress.

Persists per-user wizard state (kind, step, completed, collected form data) on
the `users` row so the wizard can be resumed across sessions and devices.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.deps import current_user, db_session
from wtg_api.models import User
from wtg_api.schemas import OnboardingPatch, OnboardingState

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


def _serialize(user: User) -> OnboardingState:
    return OnboardingState(
        kind=user.onboarding_kind,  # type: ignore[arg-type]
        step=user.onboarding_step,
        completed=user.onboarding_completed,
        data=dict(user.onboarding_data or {}),
    )


@router.get("", response_model=OnboardingState)
async def get_onboarding(user: User = Depends(current_user)) -> OnboardingState:
    return _serialize(user)


@router.patch("", response_model=OnboardingState)
async def patch_onboarding(
    payload: OnboardingPatch,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> OnboardingState:
    if payload.kind is not None:
        user.onboarding_kind = payload.kind
    if payload.step is not None:
        user.onboarding_step = payload.step
    if payload.completed is not None:
        user.onboarding_completed = payload.completed
    if payload.data is not None:
        merged = dict(user.onboarding_data or {})
        merged.update(payload.data)
        user.onboarding_data = merged
    await session.commit()
    await session.refresh(user)
    return _serialize(user)
