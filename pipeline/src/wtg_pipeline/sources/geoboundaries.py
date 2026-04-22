"""Boundary downloader: Natural Earth (country, admin-1) + geoBoundaries (admin-2).

The sources:

* Natural Earth — CC0, 1:50m cultural vectors for country + admin-1. Single
  zipfile per layer.
* geoBoundaries — CC-BY-4.0, admin-2 per country. API returns a JSON metadata
  document with a ``gjDownloadURL`` field pointing at the GeoJSON.

Idempotent: if the target file is present and non-empty, it is skipped unless
``force=True``.

Tests MUST NOT hit the network — supply a stub HTTP client (``respx`` works
well) when exercising :func:`download`.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import httpx

from wtg_pipeline.config import boundaries_raw_dir, ensure_dir

log = logging.getLogger(__name__)

USER_AGENT = "wtg-pipeline/0.1 (+https://wheretogoforgreatweather.com)"


# Natural Earth 1:50m cultural vectors (zip archives).
NATURAL_EARTH_COUNTRY_URL = (
    "https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip"
)
NATURAL_EARTH_ADMIN1_URL = (
    "https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_1_states_provinces.zip"
)

GEOBOUNDARIES_API = "https://www.geoboundaries.org/api/current/gbOpen"


class HTTPClient(Protocol):
    def get(self, url: str, **kwargs: object) -> httpx.Response: ...


@dataclass(frozen=True)
class BoundaryArtifact:
    name: str
    url: str
    target: Path


def _is_cache_hit(path: Path) -> bool:
    return path.exists() and path.stat().st_size > 0


def _build_default_client() -> httpx.Client:
    return httpx.Client(
        timeout=httpx.Timeout(60.0, connect=10.0),
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    )


def _download_binary(
    client: HTTPClient,
    url: str,
    target: Path,
    *,
    force: bool,
) -> Path:
    if not force and _is_cache_hit(target):
        log.info("cache hit: %s", target.name)
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    log.info("fetching %s", url)
    resp = client.get(url)
    resp.raise_for_status()
    target.write_bytes(resp.content)
    return target


def download_natural_earth(
    *,
    client: HTTPClient | None = None,
    base_dir: Path | None = None,
    force: bool = False,
) -> list[Path]:
    out_dir = ensure_dir((base_dir or boundaries_raw_dir()) / "natural_earth")
    owns_client = client is None
    resolved = client or _build_default_client()
    try:
        artifacts = [
            BoundaryArtifact(
                "country", NATURAL_EARTH_COUNTRY_URL, out_dir / "ne_50m_admin_0_countries.zip"
            ),
            BoundaryArtifact(
                "admin1", NATURAL_EARTH_ADMIN1_URL, out_dir / "ne_50m_admin_1_states_provinces.zip"
            ),
        ]
        return [_download_binary(resolved, a.url, a.target, force=force) for a in artifacts]
    finally:
        if owns_client and hasattr(resolved, "close"):
            resolved.close()  # type: ignore[attr-defined]


def _resolve_geoboundaries_geojson_url(client: HTTPClient, iso3: str) -> str:
    """Return the direct GeoJSON URL for a country's ADM2 layer."""
    url = f"{GEOBOUNDARIES_API}/{iso3}/ADM2/"
    resp = client.get(url)
    resp.raise_for_status()
    payload = resp.json()
    # The API returns either a single object or a list (older responses).
    if isinstance(payload, list):
        if not payload:
            raise ValueError(f"geoBoundaries returned empty list for {iso3} ADM2")
        payload = payload[0]
    if not isinstance(payload, dict):
        raise ValueError(f"unexpected geoBoundaries response shape for {iso3}: {type(payload)}")
    geojson_url = payload.get("gjDownloadURL")
    if not isinstance(geojson_url, str) or not geojson_url:
        raise ValueError(f"geoBoundaries metadata for {iso3} has no gjDownloadURL")
    return geojson_url


def download_geoboundaries_admin2(
    iso3_codes: list[str],
    *,
    client: HTTPClient | None = None,
    base_dir: Path | None = None,
    force: bool = False,
) -> list[Path]:
    """Download ADM2 GeoJSON for each ISO-3 country code."""
    out_dir = ensure_dir((base_dir or boundaries_raw_dir()) / "geoboundaries" / "adm2")
    owns_client = client is None
    resolved = client or _build_default_client()
    written: list[Path] = []
    try:
        total = len(iso3_codes)
        for idx, iso3 in enumerate(iso3_codes, start=1):
            iso3 = iso3.upper()
            target = out_dir / f"{iso3}_ADM2.geojson"
            if not force and _is_cache_hit(target):
                log.info("[%d/%d] cache hit: %s", idx, total, target.name)
                written.append(target)
                continue
            log.info("[%d/%d] resolving %s ADM2", idx, total, iso3)
            geojson_url = _resolve_geoboundaries_geojson_url(resolved, iso3)
            resp = resolved.get(geojson_url)
            resp.raise_for_status()
            target.parent.mkdir(parents=True, exist_ok=True)
            # Validate that the body is JSON before writing.
            try:
                json.loads(resp.text)
            except json.JSONDecodeError as exc:
                raise ValueError(f"geoBoundaries returned non-JSON for {iso3}") from exc
            target.write_text(resp.text, encoding="utf-8")
            written.append(target)
        return written
    finally:
        if owns_client and hasattr(resolved, "close"):
            resolved.close()  # type: ignore[attr-defined]


def default_iso3_roster() -> list[str]:
    """Return the bundled ISO-3166-1 alpha-3 roster (~250 codes)."""
    path = Path(__file__).resolve().parent / "iso3_countries.json"
    codes = json.loads(path.read_text(encoding="utf-8"))
    return [str(c).upper() for c in codes]


def fetch(
    source: str = "all",
    *,
    iso3_codes: list[str] | None = None,
    client: HTTPClient | None = None,
    base_dir: Path | None = None,
    force: bool = False,
) -> list[Path]:
    """CLI-facing dispatcher.

    If ``source`` includes geoBoundaries and no ``iso3_codes`` are supplied,
    the bundled roster is used so ``wtg download boundaries`` works with no
    arguments.
    """
    source = source.lower()
    known = {"all", "naturalearth", "natural_earth", "geoboundaries"}
    if source not in known:
        raise ValueError(f"unknown boundaries source: {source!r}")

    paths: list[Path] = []
    if source in {"all", "naturalearth", "natural_earth"}:
        paths.extend(
            download_natural_earth(client=client, base_dir=base_dir, force=force)
        )
    if source in {"all", "geoboundaries"}:
        codes = iso3_codes if iso3_codes else default_iso3_roster()
        paths.extend(
            download_geoboundaries_admin2(
                codes, client=client, base_dir=base_dir, force=force
            )
        )
    return paths
