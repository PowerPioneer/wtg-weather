from __future__ import annotations

import os

# Point Settings at an in-memory sqlite DB *before* importing the app.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SESSION_SECRET", "test-session-secret")
os.environ.setdefault("TILE_SIGNING_SECRET", "test-tile-signing-secret")
os.environ.setdefault("PADDLE_WEBHOOK_SECRET", "test-paddle-webhook-secret")
os.environ.setdefault("EMAIL_PROVIDER", "console")
os.environ.setdefault("GOOGLE_CLIENT_ID", "")

import asyncio
import uuid
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from wtg_api.config import get_settings
from wtg_api.db import Base
from wtg_api.deps import db_session
from wtg_api.main import app
from wtg_api.models import Membership, Organization, Plan, Role, User
from wtg_api.services.sessions import issue_session


@pytest_asyncio.fixture
async def engine():
    # A fresh in-memory sqlite per test; shared across connections via StaticPool.
    from sqlalchemy.pool import StaticPool

    eng = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def sessionmaker(engine):
    return async_sessionmaker(engine, expire_on_commit=False)


@pytest_asyncio.fixture
async def client(sessionmaker) -> AsyncIterator[AsyncClient]:
    async def override() -> AsyncIterator[AsyncSession]:
        async with sessionmaker() as session:
            yield session

    app.dependency_overrides[db_session] = override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.pop(db_session, None)


@pytest_asyncio.fixture
async def user(sessionmaker) -> User:
    async with sessionmaker() as session:
        user = User(email=f"user-{uuid.uuid4().hex[:8]}@example.com", name="Test User")
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


@pytest_asyncio.fixture
async def premium_user(sessionmaker) -> tuple[User, Organization]:
    async with sessionmaker() as session:
        user = User(email=f"prem-{uuid.uuid4().hex[:8]}@example.com")
        org = Organization(name="Premium Org", plan=Plan.consumer_premium, seat_cap=1)
        session.add_all([user, org])
        await session.flush()
        session.add(Membership(user_id=user.id, organization_id=org.id, role=Role.owner))
        await session.commit()
        await session.refresh(user)
        await session.refresh(org)
        return user, org


def login(client: AsyncClient, user: User) -> None:
    """Set a valid session cookie on the client for `user`."""
    s = get_settings()
    # Build a cookie by asking the session module to mint one.
    from fastapi import Response

    response = Response()
    issue_session(response, user.id)
    cookie_header = response.headers.get("set-cookie", "")
    # Extract `wtg_session=<value>`
    token = cookie_header.split(";", 1)[0].split("=", 1)[1]
    client.cookies.set(s.session_cookie_name, token)


@pytest.fixture(autouse=True)
def _ensure_event_loop():
    # On Windows, pytest-asyncio's default loop occasionally conflicts with
    # httpx's ASGITransport; force a new loop per test session.
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            asyncio.set_event_loop(asyncio.new_event_loop())
    except RuntimeError:
        asyncio.set_event_loop(asyncio.new_event_loop())
