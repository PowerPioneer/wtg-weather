"""Premium climate series for one country, for a premium visitor's browser.

`GET /api/countries/{slug}/premium` → snow depth, sea surface temperature,
humidity and heat index for that country, or 401 / 403 / 404.

Why this exists at all: country pages are statically generated, so one HTML
document serves every visitor and a premium series baked into it would be in
public view-source. The pipeline therefore publishes the premium four to their
own directory (`publish/premium_data.py`), and the page fetches them here after
hydration, only for a visitor whose session says premium. Everyone else — and
everyone with scripting off — keeps the teaser the static HTML already has.

Unlike `/v1/countries`, this is under `/api` and so publicly routed by Caddy:
the browser has to reach it. The gate is the same one `/api/tiles/url` uses
for `tier=premium` — session first (401), then entitlement (403) — and the
order matters for the same reason: a client must be able to tell "sign in"
from "upgrade".
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.deps import db_session, optional_user
from wtg_api.models import User
from wtg_api.schemas import PremiumClimate
from wtg_api.services import country_data
from wtg_api.services.entitlements import resolve

router = APIRouter(prefix="/api/countries", tags=["countries"])


@router.get("/{slug}/premium", response_model=PremiumClimate)
async def get_premium_climate(
    slug: str,
    response: Response,
    user: User | None = Depends(optional_user),
    db: AsyncSession = Depends(db_session),
) -> dict:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "authentication required")
    entitlement = await resolve(db, user)
    if not entitlement.is_premium:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "premium entitlement required")

    payload = country_data.load_premium(slug)
    if payload is None:
        # Unknown slug and "no premium series for this country" are the same
        # answer: there is nothing to chart, and the page keeps its teaser.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no premium climate for this country")

    # Per-user, behind a cookie: no shared cache may keep it, or the next
    # visitor through that cache gets a premium response without a session.
    response.headers["Cache-Control"] = "private, max-age=3600"
    response.headers["Vary"] = "Cookie"
    return payload
