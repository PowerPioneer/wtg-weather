"""Public (no-auth) SSR data endpoints.

SSR country/region pages on the web app hit these via the internal docker
network. In phase 4 we expose a placeholder contract so the web app can wire
up; the actual climate data will come from the pipeline's outputs and be
populated in a later phase.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/country/{iso2}")
async def country_summary(iso2: str) -> dict[str, Any]:
    if len(iso2) != 2:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "country not found")
    return {
        "iso2": iso2.upper(),
        "climate": None,
        "note": "Climate payload will be populated by the pipeline in phase 5.",
    }


@router.get("/country/{iso2}/{month}")
async def country_month_summary(iso2: str, month: int) -> dict[str, Any]:
    if len(iso2) != 2:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "country not found")
    if not 1 <= month <= 12:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "month must be 1..12")
    return {
        "iso2": iso2.upper(),
        "month": month,
        "climate": None,
        "note": "Climate payload will be populated by the pipeline in phase 5.",
    }
