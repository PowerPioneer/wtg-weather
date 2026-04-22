from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import login
from wtg_api.config import get_settings
from wtg_api.services.signing import sign_path


@pytest.mark.asyncio
async def test_tile_url_requires_auth(client: AsyncClient) -> None:
    r = await client.get("/api/tiles/url", params={"tier": "free"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_tile_url_free_for_any_authenticated_user(client: AsyncClient, user) -> None:
    login(client, user)
    r = await client.get("/api/tiles/url", params={"tier": "free"})
    assert r.status_code == 200
    body = r.json()
    assert body["tier"] == "free"
    assert "/free.pmtiles" in body["url"]
    assert body["expires_at"] > 0


@pytest.mark.asyncio
async def test_tile_url_premium_forbidden_for_free_user(client: AsyncClient, user) -> None:
    login(client, user)
    r = await client.get("/api/tiles/url", params={"tier": "premium"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_tile_url_premium_allowed_for_premium_user(
    client: AsyncClient, premium_user
) -> None:
    user, _org = premium_user
    login(client, user)
    r = await client.get("/api/tiles/url", params={"tier": "premium"})
    assert r.status_code == 200
    assert "/premium.pmtiles" in r.json()["url"]


@pytest.mark.asyncio
async def test_verify_endpoint_accepts_valid_signature(client: AsyncClient) -> None:
    s = get_settings()
    signed = sign_path("/premium.pmtiles", s.tile_signing_secret, 900)
    _, query = signed.url.split("?", 1)
    params = dict(pair.split("=", 1) for pair in query.split("&"))
    r = await client.get(
        "/api/tiles/verify",
        params=params,
        headers={"X-Original-URI": "/_tiles/premium.pmtiles"},
    )
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_verify_endpoint_rejects_forged_signature(client: AsyncClient) -> None:
    r = await client.get(
        "/api/tiles/verify",
        params={"exp": "9999999999", "sig": "deadbeef"},
        headers={"X-Original-URI": "/_tiles/premium.pmtiles"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_verify_endpoint_rejects_expired_signature(client: AsyncClient) -> None:
    s = get_settings()
    # TTL of 1s signed "now", but the verify runs after expiry. We fake this by
    # signing relative to an earlier `now`.
    signed = sign_path("/premium.pmtiles", s.tile_signing_secret, 1, now=1)
    _, query = signed.url.split("?", 1)
    params = dict(pair.split("=", 1) for pair in query.split("&"))
    r = await client.get(
        "/api/tiles/verify",
        params=params,
        headers={"X-Original-URI": "/_tiles/premium.pmtiles"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_verify_endpoint_rejects_path_mismatch(client: AsyncClient) -> None:
    s = get_settings()
    signed = sign_path("/premium.pmtiles", s.tile_signing_secret, 900)
    _, query = signed.url.split("?", 1)
    params = dict(pair.split("=", 1) for pair in query.split("&"))
    # Caddy forwards a DIFFERENT path than the signature was computed over.
    r = await client.get(
        "/api/tiles/verify",
        params=params,
        headers={"X-Original-URI": "/_tiles/free.pmtiles"},
    )
    assert r.status_code == 403
