"""ERA5 monthly-means downloader (Copernicus CDS).

Fetches one NetCDF per (variable, year) from the
``reanalysis-era5-single-levels-monthly-means`` dataset. Idempotent: a
request whose target already exists non-empty is skipped unless
``force=True``.

Tests MUST mock ``cdsapi.Client`` — never hit the live CDS API.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from wtg_pipeline.config import ensure_dir, era5_raw_dir

log = logging.getLogger(__name__)


# CDS long-name → local filename stem. These are the nine variables the
# product needs: mean temperature, total precipitation, surface solar
# radiation (for sunshine derivation), 10 m wind components + derived speed,
# snow depth, sea-surface temperature, and dewpoint (for relative humidity).
ERA5_VARIABLES: dict[str, str] = {
    "2m_temperature": "t2m",
    "total_precipitation": "tp",
    "surface_solar_radiation_downwards": "ssrd",
    "10m_u_component_of_wind": "u10",
    "10m_v_component_of_wind": "v10",
    "10m_wind_speed": "si10",
    "snow_depth": "sd",
    "sea_surface_temperature": "sst",
    "2m_dewpoint_temperature": "d2m",
}

MONTHS: list[str] = [f"{m:02d}" for m in range(1, 13)]

DEFAULT_DATASET = "reanalysis-era5-single-levels-monthly-means"
DEFAULT_PRODUCT_TYPE = "monthly_averaged_reanalysis"


class CDSClient(Protocol):
    """Structural type matching the subset of ``cdsapi.Client`` we use."""

    def retrieve(self, name: str, request: dict, target: str) -> object: ...


@dataclass(frozen=True)
class ERA5Request:
    variable: str
    year: int
    target: Path

    def to_cds_request(self) -> dict:
        return {
            "product_type": DEFAULT_PRODUCT_TYPE,
            "variable": self.variable,
            "year": str(self.year),
            "month": MONTHS,
            "time": "00:00",
            "format": "netcdf",
        }


def parse_year_range(spec: str) -> list[int]:
    """Parse ``"2016-2025"`` or ``"2020"`` into a sorted list of ints."""
    spec = spec.strip()
    if "-" in spec:
        a, b = spec.split("-", 1)
        start, end = int(a), int(b)
        if end < start:
            raise ValueError(f"invalid range: {spec!r}")
        return list(range(start, end + 1))
    return [int(spec)]


def target_path(variable: str, year: int, base_dir: Path | None = None) -> Path:
    stem = ERA5_VARIABLES.get(variable, variable)
    root = base_dir if base_dir is not None else era5_raw_dir()
    return root / f"{stem}_{year}.nc"


def plan_requests(
    variables: list[str],
    years: list[int],
    base_dir: Path | None = None,
) -> list[ERA5Request]:
    requests: list[ERA5Request] = []
    for variable in variables:
        if variable not in ERA5_VARIABLES:
            raise ValueError(f"unknown ERA5 variable: {variable!r}")
        for year in years:
            requests.append(
                ERA5Request(
                    variable=variable,
                    year=year,
                    target=target_path(variable, year, base_dir=base_dir),
                )
            )
    return requests


def _is_cache_hit(path: Path) -> bool:
    return path.exists() and path.stat().st_size > 0


def download(
    years: list[int],
    variables: list[str] | None = None,
    *,
    client: CDSClient | None = None,
    base_dir: Path | None = None,
    force: bool = False,
) -> list[Path]:
    """Download monthly-mean NetCDFs for (variables × years).

    Returns target paths (cache hits included). If ``client`` is ``None`` a
    real :class:`cdsapi.Client` is constructed — tests must pass a mock.
    """
    if variables is None:
        variables = list(ERA5_VARIABLES.keys())

    out_dir = ensure_dir(base_dir if base_dir is not None else era5_raw_dir())
    plan = plan_requests(variables, years, base_dir=out_dir)

    resolved_client = client if client is not None else _build_default_client()

    written: list[Path] = []
    total = len(plan)
    for idx, req in enumerate(plan, start=1):
        if not force and _is_cache_hit(req.target):
            log.info("[%d/%d] cache hit: %s", idx, total, req.target.name)
            written.append(req.target)
            continue
        log.info(
            "[%d/%d] retrieving %s %d → %s",
            idx,
            total,
            req.variable,
            req.year,
            req.target.name,
        )
        req.target.parent.mkdir(parents=True, exist_ok=True)
        resolved_client.retrieve(DEFAULT_DATASET, req.to_cds_request(), str(req.target))
        written.append(req.target)
    return written


def _build_default_client() -> CDSClient:
    import cdsapi

    return cdsapi.Client()


def fetch(
    years_spec: str = "2016-2025",
    *,
    variables: list[str] | None = None,
    client: CDSClient | None = None,
    base_dir: Path | None = None,
    force: bool = False,
) -> list[Path]:
    """CLI-facing entry point. Parses a year spec and delegates to download()."""
    years = parse_year_range(years_spec)
    return download(
        years,
        variables=variables,
        client=client,
        base_dir=base_dir,
        force=force,
    )
