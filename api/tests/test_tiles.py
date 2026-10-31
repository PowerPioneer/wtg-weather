from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import login
from wtg_api.config import get_settings
from wtg_api.services.signing import sign_path


@pytest.mark.asyncio
async def test_tile_url_free_allowed_anonymously(client: AsyncClient) -> None:
    """Free tier is publicly accessible — anonymous visitors can render
    the country/admin-1 map without an account."""
    r = await client.get("/api/tiles/url", params={"tier": "free"})
    assert r.status_code == 200
    body = r.json()
    assert body["tier"] == "free"
    # Must include the `/_tiles/` prefix so bunny.net's origin pull lands on
    # Caddy's tile-serving route rather than falling through to the Next.js
    # app and 502'ing.
    assert "/_tiles/free.pmtiles" in body["url"]
    assert body["expires_at"] > 0


@pytest.mark.asyncio
async def test_tile_url_premium_requires_auth(client: AsyncClient) -> None:
    r = await client.get("/api/tiles/url", params={"tier": "premium"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_tile_url_free_for_any_authenticated_user(client: AsyncClient, user) -> None:
    login(client, user)
    r = await client.get("/api/tiles/url", params={"tier": "free"})
    assert r.status_code == 200
    body = r.json()
    assert body["tier"] == "free"
    assert "/_tiles/free.pmtiles" in body["url"]
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
    assert "/_tiles/premium.pmtiles" in r.json()["url"]


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


# --- Edge-checked signing (bunny Token Authentication) ---------------------


def _query(url: str) -> dict[str, str]:
    from urllib.parse import parse_qsl, urlsplit

    return dict(parse_qsl(urlsplit(url).query))


@pytest.fixture
def bunny_key(monkeypatch: pytest.MonkeyPatch) -> str:
    key = "test-bunny-token-key"
    monkeypatch.setattr(get_settings(), "bunny_token_key", key)
    return key


@pytest.fixture
def origin_secret(monkeypatch: pytest.MonkeyPatch) -> str:
    secret = "test-origin-secret"
    monkeypatch.setattr(get_settings(), "tile_origin_secret", secret)
    return secret


def test_bunny_token_matches_reference_implementation() -> None:
    """Pinned against bunny's own python3/token.py (v2.1.0) for a URL with no IP,
    no token_path and no other parameters: HMAC-SHA256(key, path + expires),
    base64url without padding, `HS256-` prefix. If this drifts, the edge 403s
    every tile on the site."""
    import base64
    import hashlib
    import hmac

    from wtg_api.services.signing import sign_bunny

    signed = sign_bunny("/_tiles/premium.pmtiles", "k3y", 900, now=1_798_000_000)
    expected = "HS256-" + base64.urlsafe_b64encode(
        hmac.new(b"k3y", b"/_tiles/premium.pmtiles1798000900", hashlib.sha256).digest()
    ).decode().rstrip("=")
    assert signed.url == f"/_tiles/premium.pmtiles?token={expected}&expires=1798000900"


@pytest.mark.asyncio
async def test_tile_url_uses_bunny_format_when_key_set(
    client: AsyncClient, premium_user, bunny_key: str
) -> None:
    user, _org = premium_user
    login(client, user)
    body = (await client.get("/api/tiles/url", params={"tier": "premium"})).json()
    assert body["url"].startswith(f"{get_settings().cdn_url}/_tiles/premium.pmtiles?")
    # bunny signs every query parameter, so nothing may ride along.
    assert set(_query(body["url"])) == {"token", "expires"}
    assert int(_query(body["url"])["expires"]) == body["expires_at"]


@pytest.mark.asyncio
async def test_bunny_key_does_not_relax_the_premium_gate(
    client: AsyncClient, user, bunny_key: str
) -> None:
    assert (await client.get("/api/tiles/url", params={"tier": "premium"})).status_code == 401
    login(client, user)
    assert (await client.get("/api/tiles/url", params={"tier": "premium"})).status_code == 403


@pytest.mark.asyncio
async def test_origin_accepts_a_forwarded_bunny_token(
    client: AsyncClient, premium_user, bunny_key: str
) -> None:
    """Before the edge enforces tokens it forwards them, and the origin must
    accept them or the switch would blank the map."""
    user, _org = premium_user
    login(client, user)
    url = (await client.get("/api/tiles/url", params={"tier": "premium"})).json()["url"]
    client.cookies.clear()
    r = await client.get(
        "/api/tiles/verify",
        params=_query(url),
        headers={"X-Original-URI": "/_tiles/premium.pmtiles"},
    )
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_origin_rejects_a_free_token_presented_for_premium(
    client: AsyncClient, bunny_key: str
) -> None:
    url = (await client.get("/api/tiles/url", params={"tier": "free"})).json()["url"]
    r = await client.get(
        "/api/tiles/verify",
        params=_query(url),
        headers={"X-Original-URI": "/_tiles/premium.pmtiles"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_origin_rejects_expired_or_forged_bunny_tokens(
    client: AsyncClient, bunny_key: str
) -> None:
    from wtg_api.services.signing import sign_bunny

    expired = sign_bunny("/_tiles/premium.pmtiles", bunny_key, -1)
    forged = sign_bunny("/_tiles/premium.pmtiles", "not-the-key", 900)
    for signed in (expired, forged):
        r = await client.get(
            "/api/tiles/verify",
            params=_query(signed.url),
            headers={"X-Original-URI": "/_tiles/premium.pmtiles"},
        )
        assert r.status_code == 403


@pytest.mark.asyncio
async def test_bunny_tokens_refused_while_no_key_is_configured(client: AsyncClient) -> None:
    """With the key unset, a token signed with an empty key must not pass."""
    from wtg_api.services.signing import sign_bunny

    signed = sign_bunny("/_tiles/premium.pmtiles", "", 900)
    r = await client.get(
        "/api/tiles/verify",
        params=_query(signed.url),
        headers={"X-Original-URI": "/_tiles/premium.pmtiles"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_origin_accepts_bunny_origin_header(
    client: AsyncClient, origin_secret: str
) -> None:
    """Once the edge checks tokens and stops forwarding them, bunny's header is
    the origin's proof the request came through it."""
    r = await client.get(
        "/api/tiles/verify",
        headers={"X-Original-URI": "/_tiles/premium.pmtiles", "X-Wtg-Origin-Auth": origin_secret},
    )
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_origin_rejects_wrong_origin_header(client: AsyncClient, origin_secret: str) -> None:
    r = await client.get(
        "/api/tiles/verify",
        headers={"X-Original-URI": "/_tiles/premium.pmtiles", "X-Wtg-Origin-Auth": "guess"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_origin_header_check_is_off_while_secret_unset(client: AsyncClient) -> None:
    """Fail closed: an unset secret must not match an empty header."""
    for value in ("", " "):
        r = await client.get(
            "/api/tiles/verify",
            headers={"X-Original-URI": "/_tiles/premium.pmtiles", "X-Wtg-Origin-Auth": value},
        )
        assert r.status_code == 403
