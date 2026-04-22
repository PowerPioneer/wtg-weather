from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.db import get_sessionmaker
from wtg_api.models import User
from wtg_api.services.entitlements import Entitlement, resolve
from wtg_api.services.sessions import read_session


async def db_session() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker()() as session:
        yield session


async def optional_user(
    request: Request, session: AsyncSession = Depends(db_session)
) -> User | None:
    payload = read_session(request)
    if payload is None:
        return None
    return await session.get(User, payload.user_id)


async def current_user(user: User | None = Depends(optional_user)) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "not authenticated")
    return user


async def current_entitlement(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Entitlement:
    return await resolve(session, user)
