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
import json
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from wtg_api.config import get_settings
from wtg_api.db import Base
from wtg_api.deps import db_session
from wtg_api.main import app
from wtg_api.models import Membership, Organization, Plan, Role, User
from wtg_api.services import country_data
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


@pytest_asyncio.fixture
async def agency(sessionmaker) -> tuple[User, Organization]:
    """An agency on Starter — three seats, one of them the owner's."""
    async with sessionmaker() as session:
        owner = User(email=f"owner-{uuid.uuid4().hex[:8]}@example.com", name="Ada Owner")
        org = Organization(name="Cordillera Travel", plan=Plan.agency_starter, seat_cap=3)
        session.add_all([owner, org])
        await session.flush()
        session.add(Membership(user_id=owner.id, organization_id=org.id, role=Role.owner))
        await session.commit()
        await session.refresh(owner)
        await session.refresh(org)
        return owner, org


@pytest.fixture
def outbox(monkeypatch) -> list:
    """Capture invite mail instead of sending it.

    `.claude/rules/testing.md`: never a live provider. Patched at the point the
    invite service builds one, so a test that forgets this fixture sends
    through `ConsoleEmail` and still reaches no network.
    """
    sent: list = []

    class _Capture:
        async def send(self, message) -> None:
            sent.append(message)

    monkeypatch.setattr("wtg_api.services.invites.build_provider", lambda: _Capture())
    return sent


MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


class PublishedBundle:
    """A stand-in for `wtg publish api-data`'s output directory.

    Hand-built rather than generated, for the same reason `test_countries.py`
    hand-builds its own: what is under test here is the *reading* half. What
    this adds over that one is mutability — the alert job's whole job is to
    notice that a country's numbers moved between two runs, so a test needs to
    move them, which means republishing and dropping the mtime cache the way a
    real rebuild does.
    """

    def __init__(self, root: Path) -> None:
        self.root = root
        self._countries: dict[str, dict[str, Any]] = {}
        (self.root / "countries").mkdir(parents=True, exist_ok=True)

    def publish(
        self,
        *,
        slug: str = "peru",
        name: str = "Peru",
        iso2: str = "PE",
        temp: list[float] | float = 22.0,
        rain_day: list[float] | float = 1.0,
        sun: list[float] | float = 7.0,
        regions: list[dict[str, Any]] | None = None,
    ) -> None:
        """Write (or overwrite) one country payload, then rewrite the index."""

        def series(v: list[float] | float) -> list[float]:
            return list(v) if isinstance(v, list) else [float(v)] * 12

        self._countries[slug] = {
            "slug": slug,
            "name": name,
            "iso2": iso2,
            "region": "South America",
            "summary": f"{name} is warm.",
            "climate": {
                "months": MONTH_LABELS,
                "t": series(temp),
                "tMin": series(temp),
                "tMax": series(temp),
                "r": [v * 30 for v in series(rain_day)],
                "rDay": series(rain_day),
                "s": series(sun),
            },
            "bestMonths": [],
            "regions": regions or [],
            "related": [],
            "monthNotes": {},
        }
        self._flush()

    @staticmethod
    def region(
        *,
        name: str = "Cusco",
        code: str = "PER-1234",
        slug: str = "cusco",
        temp: list[float] | float = 13.0,
        rain_day: list[float] | float = 1.0,
        sun: list[float] | float = 7.0,
    ) -> dict[str, Any]:
        def series(v: list[float] | float) -> list[float]:
            return list(v) if isinstance(v, list) else [float(v)] * 12

        return {
            "name": name,
            # `adm1_code`, the polygon identity — this is what an alert's
            # `region_code` carries, not the ISO-3166-2 code.
            "code": code,
            "slug": slug,
            "score": 60,
            "tl": series(temp),
            "rl": series(rain_day),
            "sl": series(sun),
        }

    def _flush(self) -> None:
        for slug, payload in self._countries.items():
            (self.root / "countries" / f"{slug}.json").write_text(
                json.dumps(payload), encoding="utf-8"
            )
        (self.root / "index.json").write_text(
            json.dumps(
                {
                    "countries": [
                        {
                            "slug": p["slug"],
                            "name": p["name"],
                            "iso2": p["iso2"],
                            "region": p["region"],
                        }
                        for p in self._countries.values()
                    ]
                }
            ),
            encoding="utf-8",
        )
        # A republish replaces the files under a running container; the API
        # notices via mtime. tmp_path writes inside one test can land on the
        # same mtime tick, so drop the cache explicitly rather than trusting
        # filesystem timestamp resolution.
        country_data.reset_cache()


@pytest.fixture
def published_bundle(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "country_data_dir", str(tmp_path), raising=False)
    country_data.reset_cache()
    yield PublishedBundle(tmp_path)
    country_data.reset_cache()


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
