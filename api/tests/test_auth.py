from __future__ import annotations

import uuid
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from httpx import AsyncClient
from itsdangerous import URLSafeTimedSerializer
from sqlalchemy import select

from wtg_api.config import get_settings
from wtg_api.models import MagicLinkToken, User
from wtg_api.routers import auth as auth_router
from wtg_api.services.sessions import issue_magic_link_token

from .conftest import login


@pytest.fixture
def mailbox(monkeypatch) -> list:
    """Capture sign-in mail. Never a live provider (`.claude/rules/testing.md`)."""
    sent: list = []

    class _Capture:
        async def send(self, message) -> None:
            sent.append(message)

    monkeypatch.setattr(auth_router, "build_provider", lambda: _Capture())
    return sent


def _token_from(message) -> str:
    url = next(word for word in message.text.split() if "/login/verify?" in word)
    return parse_qs(urlparse(url).query)["token"][0]


async def _request_link(client: AsyncClient, mailbox: list, email: str) -> str:
    r = await client.post("/api/auth/magic-link", json={"email": email})
    assert r.status_code == 200, r.text
    return _token_from(mailbox[-1])


@pytest.mark.asyncio
async def test_magic_link_accepts_valid_email(client: AsyncClient, mailbox) -> None:
    r = await client.post("/api/auth/magic-link", json={"email": "test@example.com"})
    assert r.status_code == 200
    assert r.json() == {"sent": True}
    assert len(mailbox) == 1


@pytest.mark.asyncio
async def test_magic_link_rejects_invalid_email(client: AsyncClient) -> None:
    r = await client.post("/api/auth/magic-link", json={"email": "not-an-email"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_verify_with_forged_token_rejected(client: AsyncClient) -> None:
    # A token signed with a different secret should not validate.
    bad = URLSafeTimedSerializer("other-secret", salt="wtg.magic-link.v1").dumps(
        {"email": "attacker@example.com", "jti": str(uuid.uuid4())}
    )
    r = await client.get("/api/auth/verify", params={"token": bad})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_verify_with_mangled_token_rejected(client: AsyncClient) -> None:
    r = await client.get("/api/auth/verify", params={"token": "obviously-garbage-token"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_verify_creates_user_and_sets_session_cookie(
    client: AsyncClient, mailbox
) -> None:
    token = await _request_link(client, mailbox, "fresh@example.com")
    r = await client.get("/api/auth/verify", params={"token": token})
    assert r.status_code == 204
    assert get_settings().session_cookie_name in r.cookies


@pytest.mark.asyncio
async def test_magic_link_works_once(client: AsyncClient, mailbox) -> None:
    """A forwarded or leaked link must not sign its holder in after the owner used it."""
    token = await _request_link(client, mailbox, "once@example.com")
    assert (await client.get("/api/auth/verify", params={"token": token})).status_code == 204

    client.cookies.clear()
    r = await client.get("/api/auth/verify", params={"token": token})
    assert r.status_code == 400
    assert get_settings().session_cookie_name not in r.cookies


@pytest.mark.asyncio
async def test_validly_signed_link_with_no_issued_row_is_refused(client: AsyncClient) -> None:
    """The signature proves we minted it; only the row proves it was mailed and unspent."""
    token = issue_magic_link_token("ghost@example.com", uuid.uuid4())
    r = await client.get("/api/auth/verify", params={"token": token})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_link_minted_before_single_use_is_refused(client: AsyncClient) -> None:
    """Old-format links (no `jti`) have no row to spend and must not bypass it."""
    legacy = URLSafeTimedSerializer(
        get_settings().session_secret, salt="wtg.magic-link.v1"
    ).dumps({"email": "legacy@example.com"})
    r = await client.get("/api/auth/verify", params={"token": legacy})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_link_cannot_be_respent_for_another_address(
    client: AsyncClient, mailbox
) -> None:
    """A row issued for one address does not authorise a token naming another."""
    token = await _request_link(client, mailbox, "owner@example.com")
    serializer = URLSafeTimedSerializer(get_settings().session_secret, salt="wtg.magic-link.v1")
    jti = serializer.loads(token)["jti"]
    swapped = issue_magic_link_token("intruder@example.com", uuid.UUID(jti))
    assert (await client.get("/api/auth/verify", params={"token": swapped})).status_code == 400


@pytest.mark.asyncio
async def test_magic_link_rows_hold_no_plain_email_or_ip(
    client: AsyncClient, mailbox, sessionmaker
) -> None:
    await client.post(
        "/api/auth/magic-link",
        json={"email": "private@example.com"},
        headers={"x-forwarded-for": "203.0.113.9"},
    )
    async with sessionmaker() as session:
        row = (await session.execute(select(MagicLinkToken))).scalar_one()
    assert "private" not in row.email_hash
    assert row.ip_hash is not None and "203.0.113.9" not in row.ip_hash


@pytest.mark.asyncio
async def test_magic_link_throttled_per_email(client: AsyncClient, mailbox) -> None:
    limit = get_settings().magic_link_max_per_email
    for i in range(limit):
        r = await client.post(
            "/api/auth/magic-link",
            json={"email": "Flooded@example.com"},
            headers={"x-forwarded-for": f"198.51.100.{i}"},
        )
        assert r.status_code == 200
    # Case-folded, and from a fresh IP: the address is what is protected.
    r = await client.post(
        "/api/auth/magic-link",
        json={"email": "flooded@example.com"},
        headers={"x-forwarded-for": "198.51.100.200"},
    )
    assert r.status_code == 429
    assert r.headers["retry-after"] == str(get_settings().magic_link_ttl_seconds)
    assert len(mailbox) == limit


@pytest.mark.asyncio
async def test_magic_link_throttled_per_ip(
    client: AsyncClient, mailbox, monkeypatch
) -> None:
    monkeypatch.setattr(get_settings(), "magic_link_max_per_ip", 2)
    headers = {"x-forwarded-for": "192.0.2.7"}
    for n in range(2):
        r = await client.post(
            "/api/auth/magic-link", json={"email": f"stranger{n}@example.com"}, headers=headers
        )
        assert r.status_code == 200
    r = await client.post(
        "/api/auth/magic-link", json={"email": "stranger9@example.com"}, headers=headers
    )
    assert r.status_code == 429
    assert len(mailbox) == 2

    # Another client is unaffected.
    r = await client.post(
        "/api/auth/magic-link",
        json={"email": "stranger9@example.com"},
        headers={"x-forwarded-for": "192.0.2.8"},
    )
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_ip_throttle_reads_the_address_caddy_appended(
    client: AsyncClient, mailbox, monkeypatch
) -> None:
    """A client-supplied left-hand X-Forwarded-For entry cannot dodge the limit."""
    monkeypatch.setattr(get_settings(), "magic_link_max_per_ip", 1)
    first = {"x-forwarded-for": "10.0.0.1, 192.0.2.50"}
    assert (
        await client.post("/api/auth/magic-link", json={"email": "a@example.com"}, headers=first)
    ).status_code == 200
    spoofed = {"x-forwarded-for": "10.9.9.9, 192.0.2.50"}
    r = await client.post("/api/auth/magic-link", json={"email": "b@example.com"}, headers=spoofed)
    assert r.status_code == 429


@pytest.mark.asyncio
async def test_me_requires_session(client: AsyncClient) -> None:
    r = await client.get("/api/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_user_after_magic_link(client: AsyncClient, mailbox) -> None:
    token = await _request_link(client, mailbox, "return@example.com")
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
async def test_session_cookie_from_before_versioning_still_works(
    client: AsyncClient, user: User
) -> None:
    """Deploying revocation must not sign everyone out: no `sv` reads as version 0."""
    s = get_settings()
    legacy = URLSafeTimedSerializer(s.session_secret, salt="wtg.session.v1").dumps(
        {"uid": str(user.id)}
    )
    client.cookies.set(s.session_cookie_name, legacy)
    assert (await client.get("/api/me")).status_code == 200


@pytest.mark.asyncio
async def test_logout_clears_session(client: AsyncClient, mailbox) -> None:
    token = await _request_link(client, mailbox, "bye@example.com")
    await client.get("/api/auth/verify", params={"token": token})
    r = await client.post("/api/auth/logout")
    assert r.status_code == 204
    # After logout the session cookie is cleared
    r = await client.get("/api/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_logout_all_revokes_every_existing_cookie(
    client: AsyncClient, user: User
) -> None:
    s = get_settings()
    login(client, user)
    stolen = client.cookies.get(s.session_cookie_name)
    assert (await client.get("/api/me")).status_code == 200

    r = await client.post("/api/auth/logout-all")
    assert r.status_code == 204

    # The copy taken before sign-out-everywhere is still correctly signed and
    # inside its 30 days, and is refused anyway.
    client.cookies.set(s.session_cookie_name, stolen)
    assert (await client.get("/api/me")).status_code == 401
    # Nor does the sliding refresh resurrect it on the way out.
    assert (await client.get("/api/me")).status_code == 401


@pytest.mark.asyncio
async def test_logout_all_leaves_new_sign_ins_working(
    client: AsyncClient, user: User, sessionmaker
) -> None:
    login(client, user)
    assert (await client.post("/api/auth/logout-all")).status_code == 204

    async with sessionmaker() as session:
        fresh = await session.get(User, user.id)
    assert fresh is not None and fresh.session_version == 1
    login(client, fresh)
    assert (await client.get("/api/me")).status_code == 200


@pytest.mark.asyncio
async def test_logout_all_requires_session(client: AsyncClient) -> None:
    assert (await client.post("/api/auth/logout-all")).status_code == 401


@pytest.mark.asyncio
async def test_google_oauth_rejects_mismatched_state(client: AsyncClient) -> None:
    client.cookies.set("wtg_oauth_state", "one")
    r = await client.get(
        "/api/auth/google/callback", params={"code": "c", "state": "two"}
    )
    assert r.status_code == 400


def _fake_google(monkeypatch, userinfo: dict[str, Any]) -> None:
    """Answer Google's token and userinfo endpoints locally — never the real one."""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "oauth2.googleapis.com":
            return httpx.Response(200, json={"access_token": "fake"})
        if request.url.host == "openidconnect.googleapis.com":
            return httpx.Response(200, json=userinfo)
        raise AssertionError(f"unexpected request to {request.url}")

    real = httpx.AsyncClient

    def client_factory(*args: Any, **kwargs: Any) -> httpx.AsyncClient:
        kwargs["transport"] = httpx.MockTransport(handler)
        return real(*args, **kwargs)

    monkeypatch.setattr(auth_router.httpx, "AsyncClient", client_factory)


async def _google_callback(client: AsyncClient) -> httpx.Response:
    client.cookies.set("wtg_oauth_state", "s")
    return await client.get("/api/auth/google/callback", params={"code": "c", "state": "s"})


@pytest.mark.asyncio
@pytest.mark.parametrize("verified", [False, None, "true"])
async def test_google_unverified_email_cannot_claim_existing_account(
    client: AsyncClient, user: User, monkeypatch, verified: object
) -> None:
    info: dict[str, Any] = {"sub": "google-attacker", "email": user.email, "name": "Mallory"}
    if verified is not None:
        info["email_verified"] = verified
    _fake_google(monkeypatch, info)

    r = await _google_callback(client)
    assert r.status_code == 400
    assert get_settings().session_cookie_name not in r.cookies
    assert (await client.get("/api/me")).status_code == 401


@pytest.mark.asyncio
async def test_google_verified_email_signs_in(
    client: AsyncClient, user: User, monkeypatch
) -> None:
    _fake_google(
        monkeypatch, {"sub": "google-123", "email": user.email, "email_verified": True}
    )
    r = await _google_callback(client)
    assert r.status_code == 307
    me = await client.get("/api/me")
    assert me.status_code == 200
    assert me.json()["email"] == user.email
