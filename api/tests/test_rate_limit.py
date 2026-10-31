from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import login
from wtg_api.config import get_settings
from wtg_api.middleware import rate_limit


@pytest.fixture(autouse=True)
def small_limits(monkeypatch: pytest.MonkeyPatch):
    s = get_settings()
    monkeypatch.setattr(s, "rate_limit_anonymous", "3/minute")
    monkeypatch.setattr(s, "rate_limit_authenticated", "5/minute")
    rate_limit.reset_store()
    yield
    rate_limit.reset_store()


def via_caddy(ip: str) -> dict[str, str]:
    return {"x-forwarded-for": ip}


async def hit(client: AsyncClient, n: int, headers: dict[str, str] | None = None) -> list[int]:
    return [
        (await client.get("/api/tiles/url", params={"tier": "free"}, headers=headers)).status_code
        for _ in range(n)
    ]


def test_parse_limit() -> None:
    assert rate_limit.parse_limit("100/minute") == (100, 60)
    assert rate_limit.parse_limit("600/minutes") == (600, 60)
    assert rate_limit.parse_limit("5/second") == (5, 1)


@pytest.mark.asyncio
async def test_anonymous_client_is_throttled_per_ip(client: AsyncClient) -> None:
    assert await hit(client, 3, via_caddy("203.0.113.1")) == [200, 200, 200]
    r = await client.get("/api/tiles/url", params={"tier": "free"}, headers=via_caddy("203.0.113.1"))
    assert r.status_code == 429
    assert 1 <= int(r.headers["retry-after"]) <= 60
    # Another visitor is unaffected.
    assert await hit(client, 1, via_caddy("203.0.113.2")) == [200]


@pytest.mark.asyncio
async def test_internal_callers_are_never_throttled(client: AsyncClient) -> None:
    """No X-Forwarded-For means the request did not come through Caddy: the web
    container rendering pages for every visitor from one address."""
    assert await hit(client, 10) == [200] * 10


@pytest.mark.asyncio
async def test_spoofed_forwarded_for_does_not_escape(client: AsyncClient) -> None:
    """Only the right-most entry, the one Caddy wrote, identifies the client."""
    codes = [
        (
            await client.get(
                "/api/tiles/url",
                params={"tier": "free"},
                headers=via_caddy(f"10.0.0.{n}, 198.51.100.9"),
            )
        ).status_code
        for n in range(4)
    ]
    assert codes == [200, 200, 200, 429]


@pytest.mark.asyncio
async def test_signed_in_user_has_own_larger_bucket(client: AsyncClient, user) -> None:
    ip = via_caddy("192.0.2.10")
    assert await hit(client, 3, ip) == [200, 200, 200]
    assert await hit(client, 1, ip) == [429]

    # Same address, now signed in: keyed by user, with the authenticated limit.
    login(client, user)
    assert await hit(client, 5, ip) == [200] * 5
    assert await hit(client, 1, ip) == [429]
    # ...and it follows the user to another address.
    assert await hit(client, 1, via_caddy("192.0.2.99")) == [429]


@pytest.mark.asyncio
async def test_forged_session_cookie_falls_back_to_ip_bucket(client: AsyncClient) -> None:
    client.cookies.set(get_settings().session_cookie_name, "forged.cookie.value")
    assert await hit(client, 4, via_caddy("192.0.2.20")) == [200, 200, 200, 429]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "path"),
    [("GET", "/api/tiles/verify"), ("POST", "/api/webhooks/paddle"), ("GET", "/api/health")],
)
async def test_machine_callers_are_exempt(client: AsyncClient, method: str, path: str) -> None:
    codes = [
        (await client.request(method, path, headers=via_caddy("192.0.2.30"))).status_code
        for _ in range(6)
    ]
    assert 429 not in codes


@pytest.mark.asyncio
async def test_store_failure_fails_open(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    class Broken:
        async def hit(self, key: str, window_seconds: int) -> int:
            raise ConnectionError("redis is down")

    monkeypatch.setattr(rate_limit, "_store", Broken())
    assert await hit(client, 5, via_caddy("192.0.2.40")) == [200] * 5


@pytest.mark.asyncio
async def test_counts_never_hold_a_plain_ip(client: AsyncClient) -> None:
    await hit(client, 1, via_caddy("203.0.113.77"))
    store = rate_limit.get_store()
    assert isinstance(store, rate_limit.MemoryStore)
    assert not any("203.0.113.77" in key for key in store._counts)
