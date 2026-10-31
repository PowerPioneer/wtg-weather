"""Tile-URL HMAC signing.

A signed tile URL looks like:

    https://cdn.example/premium.pmtiles?exp=<unix>&sig=<hex-hmac>

The HMAC is computed as:

    HMAC_SHA256(TILE_SIGNING_SECRET, f"{path}|{exp}")

where `path` is the URL path (e.g. `/premium.pmtiles`) and `exp` is an integer
unix timestamp after which the signature is no longer accepted.

Caddy reverse-proxies `/_tiles/*` to `/api/tiles/verify` (in this API) first;
that endpoint calls `verify()` below and returns 204 on success, 403 otherwise.

A second scheme, :func:`sign_bunny` / :func:`verify_bunny`, produces bunny.net's
Advanced Token Authentication format instead:

    https://cdn.example/_tiles/premium.pmtiles?token=HS256-<b64url>&expires=<unix>

    token = "HS256-" + base64url_nopad(HMAC_SHA256(BUNNY_TOKEN_KEY, path + expires))

which the CDN edge itself can check — so it can refuse an expired or forged URL
without asking the origin, and cache one copy per archive. Taken from bunny's
reference implementation (BunnyWay/BunnyCDN.TokenAuthentication, python3,
v2.1.0) for the case with no user IP, no `token_path` and no other query
parameters. That last condition matters: bunny signs *every* query parameter on
the URL, so nothing else may ride along with `token` and `expires`.
"""

from __future__ import annotations

import base64
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


def _bunny_token(path: str, expires: int, key: str) -> str:
    digest = hmac.new(key.encode("utf-8"), f"{path}{expires}".encode("utf-8"), hashlib.sha256)
    return "HS256-" + base64.urlsafe_b64encode(digest.digest()).decode("ascii").rstrip("=")


def sign_bunny(path: str, key: str, ttl_seconds: int, now: int | None = None) -> SignedTileURL:
    """Sign `path` (the full CDN path, e.g. `/_tiles/premium.pmtiles`) for bunny's edge."""
    if now is None:
        now = int(time.time())
    expires = now + int(ttl_seconds)
    query = urlencode({"token": _bunny_token(path, expires, key), "expires": expires})
    return SignedTileURL(url=f"{path}?{query}", expires_at=expires)


def verify_bunny(
    path: str,
    token: str | None,
    expires: str | int | None,
    key: str,
    now: int | None = None,
) -> bool:
    """The origin's copy of the edge's check, for requests bunny forwards with the
    token still on them (any time before its edge enforces tokens itself)."""
    if not key or token is None or expires is None:
        return False
    try:
        expires_int = int(expires)
    except (TypeError, ValueError):
        return False
    if now is None:
        now = int(time.time())
    if expires_int <= now:
        return False
    return hmac.compare_digest(_bunny_token(path, expires_int, key), token)
