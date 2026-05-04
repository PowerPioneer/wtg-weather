"""Tile URL issuer + Caddy verification endpoint.

`GET /api/tiles/url?tier=free|premium` → signed CDN URL (15-minute lifetime).
Premium tier requires a premium entitlement.

`GET /api/tiles/verify` → 204 if the forwarded request's `path+exp` HMAC
matches `sig`, 403 otherwise. Caddy reverse-proxies `/_tiles/*` here first,
then serves the file from disk only on 204.

Caddy forwards:
- `X-Original-URI` — the original path, e.g. `/premium.pmtiles`
- query params `exp` and `sig`
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.config import get_settings
from wtg_api.deps import db_session, optional_user
from wtg_api.models import User
from wtg_api.schemas import SignedTileURLResponse
from wtg_api.services.entitlements import resolve
from wtg_api.services.signing import sign_path, verify

router = APIRouter(prefix="/api/tiles", tags=["tiles"])


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
    signed = sign_path(path, s.tile_signing_secret, s.tile_signature_ttl_seconds)
    return SignedTileURLResponse(
        url=f"{s.cdn_url}/_tiles{signed.url}",
        expires_at=signed.expires_at,
        tier=tier,
    )


@router.get("/verify")
async def verify_tile(
    request: Request,
    exp: str | None = Query(None),
    sig: str | None = Query(None),
) -> Response:
    # Caddy forwards the original path via `X-Original-URI`; the path may still
    # include the query string, so strip it.
    original = request.headers.get("x-original-uri") or request.url.path
    path = original.split("?", 1)[0]
    # Caddy reverse-proxies `/_tiles/premium.pmtiles` → here; the signed
    # CDN path is `/premium.pmtiles`, so strip any `/_tiles` prefix.
    if path.startswith("/_tiles"):
        path = path[len("/_tiles") :]
    if not path.startswith("/"):
        path = "/" + path

    s = get_settings()
    if verify(path, exp, sig, s.tile_signing_secret):
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    raise HTTPException(status.HTTP_403_FORBIDDEN, "invalid tile signature")
