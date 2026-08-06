"""Public country/region data for the SSR pages.

Mounted at ``/v1``, not ``/api/v1``, and that is load-bearing: the Caddyfile
routes ``/api/*`` to this service and everything else to the web app, so
``/v1/*`` is reachable only from inside the Docker network. The SSR pages call
it over ``INTERNAL_API_URL``; a browser cannot reach it at all. There is
nothing secret in a country payload — the pages built from it are public and
statically generated — but an endpoint with no public route is an endpoint with
no public rate-limit surface either.

Data comes from :mod:`wtg_api.services.country_data`, which reads the
pipeline's published bundle off a read-only mount. Nothing here touches the
database.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from wtg_api.schemas import CountryData, CountryRef, CountryRegion
from wtg_api.services import country_data

router = APIRouter(prefix="/v1", tags=["countries"])


@router.get("/countries", response_model=list[CountryRef])
async def list_countries() -> list[dict]:
    """Every country the pipeline has published a payload for.

    The web generates its static route tree from this list, so it is the
    contract that keeps `generateStaticParams` from emitting a slug this
    service would then 404 — which, with `dynamicParams = false`, is a
    build-time 404 page rather than a runtime one.
    """
    try:
        return country_data.load_index()
    except country_data.CountryDataUnavailable as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)
        ) from exc


@router.get("/countries/{slug}", response_model=CountryData)
async def get_country(slug: str) -> dict:
    payload = country_data.load_country(slug)
    if payload is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "country not found")
    return payload


@router.get("/countries/{slug}/regions/{region_slug}", response_model=CountryRegion)
async def get_country_region(slug: str, region_slug: str) -> dict:
    """One admin-1 region, with its parent country alongside.

    The region pages render both — breadcrumb, national comparison, sibling
    regions — so returning the pair in one response saves the SSR page a
    second round trip on every render.
    """
    payload = country_data.load_country(slug)
    if payload is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "country not found")
    region = country_data.find_region(payload, region_slug)
    if region is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "region not found")
    return {"country": payload, "region": region}
