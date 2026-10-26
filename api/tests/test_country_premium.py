"""`GET /api/countries/{slug}/premium` — the premium four, behind an entitlement.

This endpoint is publicly routed and hands out what the Premium tier sells, so
per `api/CLAUDE.md` every way it should refuse is exercised: no session, a
forged session, an expired session, a free plan, and a slug that would walk
out of the data directory.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import AsyncClient

from tests.conftest import login
from wtg_api.config import get_settings
from wtg_api.services import country_data

PREMIUM = {
    "slug": "peru",
    "snow": [0.0] * 12,
    "sst": [20.0] * 12,
    "sstBandLow": [18.5] * 12,
    "sstBandHigh": [21.5] * 12,
    "humidity": [65.0] * 12,
    "heat": [27.0] * 12,
}


@pytest_asyncio.fixture
async def premium_bundle(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    settings = get_settings()
    monkeypatch.setattr(settings, "country_data_dir", str(tmp_path), raising=False)
    (tmp_path / "premium").mkdir()
    (tmp_path / "premium" / "peru.json").write_text(json.dumps(PREMIUM), encoding="utf-8")
    # A free payload with a premium-looking key in it must not leak through
    # this route: it reads `premium/`, never `countries/`.
    (tmp_path / "countries").mkdir()
    (tmp_path / "countries" / "chile.json").write_text(
        json.dumps({"slug": "chile", "sst": [99.0] * 12}), encoding="utf-8"
    )
    country_data.reset_cache()
    yield tmp_path
    country_data.reset_cache()


@pytest.mark.asyncio
async def test_anonymous_visitor_is_told_to_sign_in(client: AsyncClient, premium_bundle: Path) -> None:
    r = await client.get("/api/countries/peru/premium")
    assert r.status_code == 401
    assert "sst" not in r.text


@pytest.mark.asyncio
async def test_forged_session_cookie_is_not_a_session(client: AsyncClient, premium_bundle: Path) -> None:
    client.cookies.set(get_settings().session_cookie_name, "forged.cookie.value")
    r = await client.get("/api/countries/peru/premium")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_expired_session_is_refused(
    client: AsyncClient, premium_user, premium_bundle: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    user, _org = premium_user
    login(client, user)
    # Any token is older than a negative lifetime.
    monkeypatch.setattr(get_settings(), "session_ttl_seconds", -1, raising=False)
    r = await client.get("/api/countries/peru/premium")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_free_plan_is_told_to_upgrade(client: AsyncClient, user, premium_bundle: Path) -> None:
    login(client, user)
    r = await client.get("/api/countries/peru/premium")
    assert r.status_code == 403
    assert "sst" not in r.text


@pytest.mark.asyncio
async def test_premium_user_gets_the_series(client: AsyncClient, premium_user, premium_bundle: Path) -> None:
    user, _org = premium_user
    login(client, user)
    r = await client.get("/api/countries/peru/premium")
    assert r.status_code == 200
    body = r.json()
    assert body["sst"] == PREMIUM["sst"]
    assert body["sstBandLow"] == PREMIUM["sstBandLow"]
    assert body["humidity"] == PREMIUM["humidity"]
    assert body["snowBandLow"] is None
    # Per-user and behind a cookie: never cacheable by a shared cache.
    assert r.headers["cache-control"].startswith("private")


@pytest.mark.asyncio
async def test_country_without_premium_series_is_not_found(
    client: AsyncClient, premium_user, premium_bundle: Path
) -> None:
    user, _org = premium_user
    login(client, user)
    r = await client.get("/api/countries/chile/premium")
    assert r.status_code == 404
    assert "99" not in r.text


@pytest.mark.asyncio
@pytest.mark.parametrize("slug", ["..%2Fcountries%2Fchile", "PERU..", "peru%00"])
async def test_a_slug_cannot_walk_out_of_the_premium_directory(
    client: AsyncClient, premium_user, premium_bundle: Path, slug: str
) -> None:
    user, _org = premium_user
    login(client, user)
    r = await client.get(f"/api/countries/{slug}/premium")
    assert r.status_code == 404
