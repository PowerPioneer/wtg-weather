"""Tile-URL HMAC signing.

A signed tile URL looks like:

    https://cdn.example/premium.pmtiles?exp=<unix>&sig=<hex-hmac>

The HMAC is computed as:

    HMAC_SHA256(TILE_SIGNING_SECRET, f"{path}|{exp}")

where `path` is the URL path (e.g. `/premium.pmtiles`) and `exp` is an integer
unix timestamp after which the signature is no longer accepted.

Caddy reverse-proxies `/_tiles/*` to `/api/tiles/verify` (in this API) first;
that endpoint calls `verify()` below and returns 204 on success, 403 otherwise.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from dataclasses import dataclass
from urllib.parse import urlencode


@dataclass(frozen=True)
class SignedTileURL:
    url: str
    expires_at: int


def _canonical(path: str, exp: int) -> bytes:
    return f"{path}|{exp}".encode("utf-8")


def sign_path(path: str, secret: str, ttl_seconds: int, now: int | None = None) -> SignedTileURL:
    """Produce the `exp` + `sig` query params for a tile path.

    `path` should be the CDN-relative path (e.g. `/premium.pmtiles`).
    """
    if now is None:
        now = int(time.time())
    exp = now + int(ttl_seconds)
    sig = hmac.new(secret.encode("utf-8"), _canonical(path, exp), hashlib.sha256).hexdigest()
    query = urlencode({"exp": exp, "sig": sig})
    return SignedTileURL(url=f"{path}?{query}", expires_at=exp)


def verify(path: str, exp: str | int | None, sig: str | None, secret: str, now: int | None = None) -> bool:
    """Return True iff `sig` is a valid HMAC for `path+exp` and `exp` is in the future."""
    if exp is None or sig is None:
        return False
    try:
        exp_int = int(exp)
    except (TypeError, ValueError):
        return False
    if now is None:
        now = int(time.time())
    if exp_int <= now:
        return False
    expected = hmac.new(secret.encode("utf-8"), _canonical(path, exp_int), hashlib.sha256).hexdigest()
    # hmac.compare_digest guards against timing attacks
    return hmac.compare_digest(expected, sig)
