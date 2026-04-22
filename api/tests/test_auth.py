from __future__ import annotations

import pytest
from httpx import AsyncClient
from itsdangerous import URLSafeTimedSerializer

from wtg_api.config import get_settings
from wtg_api.services.sessions import issue_magic_link_token


@pytest.mark.asyncio
async def test_magic_link_accepts_valid_email(client: AsyncClient) -> None:
    r = await client.post("/api/auth/magic-link", json={"email": "test@example.com"})
    assert r.status_code == 200
    assert r.json() == {"sent": True}


@pytest.mark.asyncio
async def test_magic_link_rejects_invalid_email(client: AsyncClient) -> None:
    r = await client.post("/api/auth/magic-link", json={"email": "not-an-email"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_verify_with_forged_token_rejected(client: AsyncClient) -> None:
    # A token signed with a different secret should not validate.
    bad = URLSafeTimedSerializer("other-secret", salt="wtg.magic-link.v1").dumps(
        {"email": "attacker@example.com"}
    )
    r = await client.get("/api/auth/verify", params={"token": bad})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_verify_with_mangled_token_rejected(client: AsyncClient) -> None:
    r = await client.get("/api/auth/verify", params={"token": "obviously-garbage-token"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_verify_creates_user_and_sets_session_cookie(client: AsyncClient) -> None:
    token = issue_magic_link_token("fresh@example.com")
    r = await client.get("/api/auth/verify", params={"token": token})
    assert r.status_code == 204
    cookies = r.cookies
    assert get_settings().session_cookie_name in cookies


@pytest.mark.asyncio
async def test_me_requires_session(client: AsyncClient) -> None:
    r = await client.get("/api/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_user_after_magic_link(client: AsyncClient) -> None:
    token = issue_magic_link_token("return@example.com")
    r = await client.get("/api/auth/verify", params={"token": token})
    assert r.status_code == 204
    # Cookie was set; AsyncClient persists cookies across calls
    r = await client.get("/api/me")
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == "return@example.com"
    assert body["plan"] == "free"
    assert body["is_premium"] is False


@pytest.mark.asyncio
async def test_tampered_session_cookie_unauthenticated(client: AsyncClient) -> None:
    s = get_settings()
    client.cookies.set(s.session_cookie_name, "garbage.garbage.garbage")
    r = await client.get("/api/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_google_oauth_rejects_mismatched_state(client: AsyncClient) -> None:
    client.cookies.set("wtg_oauth_state", "one")
    r = await client.get(
        "/api/auth/google/callback", params={"code": "c", "state": "two"}
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_logout_clears_session(client: AsyncClient) -> None:
    token = issue_magic_link_token("bye@example.com")
    await client.get("/api/auth/verify", params={"token": token})
    r = await client.post("/api/auth/logout")
    assert r.status_code == 204
    # After logout the session cookie is cleared
    r = await client.get("/api/me")
    assert r.status_code == 401
