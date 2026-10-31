"""Tile URL issuer + Caddy verification endpoint.

`GET /api/tiles/url?tier=free|premium` → signed CDN URL (15-minute lifetime).
Premium tier requires a premium entitlement.

`GET /api/tiles/verify` → 204 if the forwarded request's `path+exp` HMAC
matches `sig`, 403 otherwise. Caddy reverse-proxies `/_tiles/*` here first,
then serves the file from disk only on 204.

Caddy forwards:
- `X-Original-URI` — the original path, e.g. `/premium.pmtiles`
- the original query string (`exp`/`sig`, or bunny's `token`/`expires`)
- every original request header, including bunny's `X-Wtg-Origin-Auth`

Two signing schemes, chosen by whether `BUNNY_TOKEN_KEY` is set:

- **origin-checked** (`exp`/`sig`, the original): only this API can verify it,
  and only on a cache miss. Measured 2026-10-31, the pull zone keys its cache
  on the path alone and checks nothing: free tiles came back `206 HIT` with a
  bogus signature and with none. Premium was closed only because no edge held
  a copy, so every premium request went to the origin — and any edge that did
  cache it would have served it to anyone.
- **edge-checked** (bunny Token Authentication, `token`/`expires`): bunny
  refuses a bad or expired URL itself, and can cache one copy per archive.

`/verify` therefore accepts three credentials, so the switch can happen with
no window in which tiles either fail or go unprotected:

1. `exp`/`sig` — the original scheme, kept for URLs issued before the switch.
2. bunny's `token`/`expires`, re-checked here — covers the period after
   `BUNNY_TOKEN_KEY` is set but before the edge enforces it. bunny forwards the
   requesting URL's query string on a miss (it is how `exp`/`sig` reach us).
3. the `X-Wtg-Origin-Auth` header equal to `TILE_ORIGIN_SECRET` — bunny's own
   origin requests, once the edge checks tokens and no longer needs to forward
   them. Never configure the secret before the edge enforces tokens.

The operator's order is in `infra/CLAUDE.md` § "Tile signing at the edge".
"""

from __future__ import annotations

import hmac
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.config import get_settings
from wtg_api.deps import db_session, optional_user
from wtg_api.models import User
from wtg_api.schemas import SignedTileURLResponse
from wtg_api.services.entitlements import resolve
from wtg_api.services.signing import sign_bunny, sign_path, verify, verify_bunny

router = APIRouter(prefix="/api/tiles", tags=["tiles"])

#: Header bunny's Edge Rule adds to every request it sends to the origin.
ORIGIN_AUTH_HEADER = "x-wtg-origin-auth"


@router.get("/url", response_model=SignedTileURLResponse)
async def get_tile_url(
    tier: Literal["free", "premium"] = Query("free"),
    user: User | None = Depends(optional_user),
    db: AsyncSession = Depends(db_session),
) -> SignedTileURLResponse:
    if tier == "premium":
        if user is None:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED, "authentication required for premium tiles"
            )
        entitlement = await resolve(db, user)
        if not entitlement.is_premium:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "premium entitlement required")

    s = get_settings()
    # The HMAC is computed over the bare path (`/free.pmtiles`) so the
    # `verify_tile` endpoint can keep stripping the `/_tiles` prefix it
    # receives from Caddy. The CDN URL gets the prefix tacked on so the
    # request bunny.net forwards to the origin actually hits Caddy's
    # `/_tiles/*` tile-serving route — without it, the request falls
    # through to `route /*` (Next.js) and 502s.
    path = f"/{tier}.pmtiles"
    if s.bunny_token_key:
        # bunny signs the path the visitor requests, prefix included, and signs
        # every query parameter — so this URL carries `token`/`expires` only.
        signed = sign_bunny(f"/_tiles{path}", s.bunny_token_key, s.tile_signature_ttl_seconds)
        url = f"{s.cdn_url}{signed.url}"
    else:
        signed = sign_path(path, s.tile_signing_secret, s.tile_signature_ttl_seconds)
        url = f"{s.cdn_url}/_tiles{signed.url}"
    return SignedTileURLResponse(url=url, expires_at=signed.expires_at, tier=tier)


@router.get("/verify")
async def verify_tile(
    request: Request,
    exp: str | None = Query(None),
    sig: str | None = Query(None),
    token: str | None = Query(None),
    expires: str | None = Query(None),
) -> Response:
    # Caddy forwards the original path via `X-Original-URI`; the path may still
    # include the query string, so strip it.
    original = request.headers.get("x-original-uri") or request.url.path
    cdn_path = original.split("?", 1)[0]
    if not cdn_path.startswith("/"):
        cdn_path = "/" + cdn_path
    # The original scheme signs the bare path (`/premium.pmtiles`); bunny signs
    # the path it was asked for (`/_tiles/premium.pmtiles`).
    path = cdn_path[len("/_tiles") :] if cdn_path.startswith("/_tiles/") else cdn_path

    s = get_settings()
    from_cdn = request.headers.get(ORIGIN_AUTH_HEADER)
    if (
        verify(path, exp, sig, s.tile_signing_secret)
        or verify_bunny(cdn_path, token, expires, s.bunny_token_key)
        # Empty secret = check disabled. Without that guard an empty header
        # would equal an unset secret and open the archive to anyone.
        or (
            bool(s.tile_origin_secret)
            and from_cdn is not None
            and hmac.compare_digest(from_cdn, s.tile_origin_secret)
        )
    ):
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    raise HTTPException(status.HTTP_403_FORBIDDEN, "invalid tile signature")
