"""ERA5 daily-mean 10 m wind speed, derived from hourly wind components.

Why this is not just another row in :mod:`era5_daily`
-----------------------------------------------------
``derived-era5-single-levels-daily-statistics`` computes its days from ERA5
*hourly* single-level fields, and ERA5 does not archive a 10 m wind speed
hourly — only its u and v components. The monthly means carry ``si10``
because ECMWF derives it while averaging; nothing does that for a day. Asking
the daily product for ``10m_wind_speed`` fails in MARS (``Ambiguous :
10m_wind_speed could be AEROSOL TYPE 10 MIXING RATIO or …``), on every
attempt, which is how Pass B found out on 2026-09-24.

So this module fetches u10 and v10 from ``reanalysis-era5-single-levels`` and
takes the daily mean of the **speed**, sqrt(u² + v²), per timestep. It must
never be the speed of the daily-mean vector: winds that turn during the day —
a sea breeze, a mountain valley — cancel in a vector mean and would read as
calm. ``test_era5_wind.py`` pins that.

Shape of the request
--------------------
* **6-hourly, not hourly.** Four samples a day at 00/06/12/18 UTC. Hourly u+v
  at 0.25° is ~70 GB per year; six-hourly is a sixth of that and lands on the
  root disk one year at a time. Four evenly spaced samples average a diurnal
  cycle without bias to first order; what they cannot do is find a daily
  *maximum*, and nothing here asks them to.
* **Native 0.25° grid.** The output matches the daily-statistics files cell
  for cell, so aggregation reuses the cached coverage matrix instead of
  building a second one for a coarser grid.
* **One request per year**, both components together — ten requests for the
  decade. The CDS throttle counts requests (see :mod:`era5_daily`).

The output is written as ``si10_mean_<year>.nc`` beside the daily-statistics
files, with the same dims (``valid_time`` at 00:00 UTC per day, ``latitude``,
``longitude``). Everything downstream — ``have_complete_year``, the watchdog,
aggregation — therefore treats it as one more daily series. The raw 6-hourly
file is deleted once its year is derived.

Tests MUST mock ``cdsapi.Client`` — never hit the live CDS API.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from wtg_pipeline.config import ensure_dir, era5_raw_dir
from wtg_pipeline.sources.era5_daily import (
    MONTHS,
    DAYS,
    CDSClient,
    have_complete_year,
    retrieve_with_retry,
    target_path,
)

log = logging.getLogger(__name__)

DATASET = "reanalysis-era5-single-levels"
STEM = "si10_mean"
OUTPUT_VARIABLE = "si10"
COMPONENTS: tuple[str, ...] = ("10m_u_component_of_wind", "10m_v_component_of_wind")
TIMES: tuple[str, ...] = ("00:00", "06:00", "12:00", "18:00")


def raw_path(year: int, base_dir: Path) -> Path:
    """Where the 6-hourly u/v year lands before it is reduced to daily means."""
    return base_dir / "hourly_uv" / f"uv10_{year}.nc"


def cds_request(year: int) -> dict:
    return {
        "product_type": ["reanalysis"],
        "variable": list(COMPONENTS),
        "year": [str(year)],
        "month": list(MONTHS),
        "day": list(DAYS),
        "time": list(TIMES),
        "data_format": "netcdf",
        "download_format": "unarchived",
    }


def _open(path: Path):
    from wtg_pipeline.processing.aggregate import _open_era5_dataset

    return _open_era5_dataset(path)


def _write_netcdf(ds: object, path: Path, encoding: dict) -> None:
    pinned = os.environ.get("WTG_NETCDF_ENGINE")
    engines = [pinned] if pinned else ["netcdf4", "h5netcdf"]
    errors: list[str] = []
    for engine in engines:
        try:
            ds.to_netcdf(path, engine=engine, encoding=encoding)  # type: ignore[attr-defined]
            return
        except (ImportError, ValueError) as exc:
            errors.append(f"{engine}: {exc}")
    raise RuntimeError(f"could not write {path.name}: " + "; ".join(errors))


def derive_daily_mean(raw: Path, target: Path) -> Path:
    """Reduce a 6-hourly u/v file to one daily-mean wind speed per cell.

    Reads one day at a time, so peak memory is four timesteps of each
    component plus the output year (~1.5 GB at 0.25°). Every day must carry
    exactly ``len(TIMES)`` samples: a short day is a truncated download, and a
    mean over fewer samples would be a biased day nothing downstream detects.
    """
    import numpy as np
    import pandas as pd
    import xarray as xr

    with raw.open("rb") as fh:
        magic = fh.read(2)
    if magic == b"PK":
        raise ValueError(
            f"{raw.name} is a zip archive, not NetCDF — CDS split the request; "
            "check `download_format`"
        )

    ds = _open(raw)
    try:
        time_name = "valid_time" if "valid_time" in ds.dims else "time"
        u = ds["u10"]
        v = ds["v10"]
        stamps = pd.DatetimeIndex(ds[time_name].values)
        days = stamps.normalize().unique().sort_values()
        lat = ds["latitude"].values
        lon = ds["longitude"].values

        out = np.empty((len(days), len(lat), len(lon)), dtype=np.float32)
        for i, day in enumerate(days):
            idx = np.nonzero(stamps.normalize() == day)[0]
            if len(idx) != len(TIMES):
                raise ValueError(
                    f"{raw.name}: {day.date()} has {len(idx)} samples, "
                    f"expected {len(TIMES)} — truncated download?"
                )
            uu = u.isel({time_name: idx}).values.astype(np.float64)
            vv = v.isel({time_name: idx}).values.astype(np.float64)
            out[i] = np.sqrt(uu * uu + vv * vv).mean(axis=0)
    finally:
        ds.close()

    result = xr.Dataset(
        {
            OUTPUT_VARIABLE: (
                ("valid_time", "latitude", "longitude"),
                out,
                {
                    "units": "m s**-1",
                    "long_name": "10 metre wind speed, daily mean of 6-hourly speeds",
                },
            )
        },
        coords={"valid_time": days.values, "latitude": lat, "longitude": lon},
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_name(target.name + ".tmp")
    _write_netcdf(
        result, tmp, {OUTPUT_VARIABLE: {"zlib": True, "complevel": 4}}
    )
    tmp.replace(target)
    return target


def download(
    years: list[int],
    *,
    client: CDSClient | None = None,
    base_dir: Path | None = None,
    force: bool = False,
) -> list[Path]:
    """Fetch and derive ``si10_mean`` for each year. Resumable per year.

    A raw file that is already on disk (a run killed during derivation) is
    derived without re-downloading it.
    """
    out_dir = ensure_dir(
        base_dir if base_dir is not None else era5_raw_dir() / "daily"
    )
    resolved = client
    written: list[Path] = []
    for idx, year in enumerate(years, start=1):
        target = target_path(STEM, year, None, base_dir=out_dir)
        if not force and have_complete_year(STEM, year, base_dir=out_dir):
            written.append(target)
            continue

        raw = raw_path(year, out_dir)
        if force or not (raw.exists() and raw.stat().st_size > 0):
            if resolved is None:
                import cdsapi

                resolved = cdsapi.Client()
            raw.parent.mkdir(parents=True, exist_ok=True)
            log.info(
                "[%d/%d] retrieving u10+v10 6-hourly %d → %s",
                idx, len(years), year, raw.name,
            )
            tmp = raw.with_name(raw.name + ".tmp")
            retrieve_with_retry(resolved, DATASET, cds_request(year), tmp)
            tmp.replace(raw)

        log.info("[%d/%d] deriving daily mean wind %d → %s", idx, len(years), year, target.name)
        derive_daily_mean(raw, target)
        raw.unlink()
        written.append(target)
    return written


def fetch(
    years_spec: str = "2016-2025",
    *,
    client: CDSClient | None = None,
    base_dir: Path | None = None,
    force: bool = False,
) -> list[Path]:
    """CLI-facing entry point."""
    from wtg_pipeline.sources.era5_daily import parse_year_range

    return download(
        parse_year_range(years_spec), client=client, base_dir=base_dir, force=force
    )
