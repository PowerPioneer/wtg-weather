"""Per-client request limits for the public API.

`RATE_LIMIT_ANONYMOUS` (default 100/minute) per client IP, and
`RATE_LIMIT_AUTHENTICATED` (default 600/minute) per signed-in user, counted in
fixed windows in Redis so every worker shares one count. Over the limit is a
429 with `Retry-After`.

Who is counted, and who is not:

- **Only requests that came through Caddy.** The API publishes no port
  (`docker-compose.yml`), so a public request always arrives via Caddy, which
  sets `X-Forwarded-For`. A request *without* it came from inside the docker
  network — the web container rendering a page, which calls `/v1/*` and
  `/api/me` for every visitor from one address — and counting those against one
  bucket would throttle the whole site's server rendering.
- **Not the paths whose callers are machines we expect to be busy:**
  `/api/tiles/verify` (Caddy's `forward_auth`, once per CDN miss),
  `/api/webhooks/*` (Paddle, which retries anything that is not a 2xx), and
  `/api/health`.
- A signed-in request is keyed by user id, read from the session cookie's
  signature alone (no database read). A forged cookie fails the signature and
  falls back to the IP bucket; a revoked one still names its own user, whose
  bucket is the only one it can spend.

The client IP is the right-most `X-Forwarded-For` entry, the one Caddy wrote,
as in `routers/auth.py` — the stricter magic-link throttle there is separate
and stacks with this one. IPs never reach Redis or the logs in the clear.

If Redis is unreachable the limiter **fails open** and logs it: a limit that
takes the site down when Redis restarts would do more damage than the abuse it
is there to slow.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Awaitable, Callable
from typing import Protocol

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from wtg_api.config import get_settings
from wtg_api.services.sessions import fingerprint, read_session

logger = logging.getLogger(__name__)

EXEMPT_PREFIXES = ("/api/tiles/verify", "/api/webhooks/", "/api/health")

_UNITS = {"second": 1, "minute": 60, "hour": 3600}


def parse_limit(spec: str) -> tuple[int, int]:
    """`"100/minute"` → `(100, 60)`."""
    count, _, unit = spec.partition("/")
    return int(count), _UNITS[unit.strip().rstrip("s")]


class CounterStore(Protocol):
    async def hit(self, key: str, window_seconds: int) -> int: ...


class MemoryStore:
    """Per-process counts. For tests and a Redis-less dev box only."""

    def __init__(self) -> None:
        self._counts: dict[str, tuple[int, float]] = {}

    async def hit(self, key: str, window_seconds: int) -> int:
        now = time.monotonic()
        if len(self._counts) > 10_000:
            self._counts = {k: v for k, v in self._counts.items() if v[1] > now}
        count, expires = self._counts.get(key, (0, now + window_seconds))
        if expires <= now:
            count, expires = 0, now + window_seconds
        self._counts[key] = (count + 1, expires)
        return count + 1


class RedisStore:
    def __init__(self, url: str) -> None:
        import redis.asyncio as redis

        self._redis = redis.from_url(url, socket_timeout=0.25, socket_connect_timeout=0.25)

    async def hit(self, key: str, window_seconds: int) -> int:
        pipe = self._redis.pipeline()
        pipe.incr(key)
        # A little longer than the window so a key outlives its last increment.
        pipe.expire(key, window_seconds + 5, nx=True)
        count, _ = await pipe.execute()
        return int(count)


_store: CounterStore | None = None


def get_store() -> CounterStore:
    global _store
    if _store is None:
        s = get_settings()
        _store = MemoryStore() if s.rate_limit_storage == "memory" else RedisStore(s.redis_url)
    return _store


def reset_store() -> None:
    """Forget all counts (tests)."""
    global _store
    _store = None


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if not forwarded:
        return None
    return forwarded.split(",")[-1].strip() or None


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        path = request.url.path
        ip = _client_ip(request)
        if ip is None or path.startswith(EXEMPT_PREFIXES):
            return await call_next(request)

        s = get_settings()
        session = read_session(request)
        if session is not None:
            ident, spec = f"u:{session.user_id}", s.rate_limit_authenticated
        else:
            ident, spec = f"ip:{fingerprint(ip)[:32]}", s.rate_limit_anonymous
        limit, window = parse_limit(spec)
        window_start = int(time.time()) // window * window

        try:
            count = await get_store().hit(f"rl:{ident}:{window_start}", window)
        except Exception:  # noqa: BLE001 — any store failure fails open
            logger.warning("rate_limit.store_unavailable — allowing request", exc_info=True)
            return await call_next(request)

        if count > limit:
            retry_after = max(1, window_start + window - int(time.time()))
            if count == limit + 1:
                logger.warning("rate_limit.exceeded who=%s limit=%s", ident[:14], spec)
            return JSONResponse(
                {"detail": "too many requests; slow down"},
                status_code=429,
                headers={"Retry-After": str(retry_after)},
            )
        return await call_next(request)
