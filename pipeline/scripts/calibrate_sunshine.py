#!/usr/bin/env python
"""Fit the Ångström–Prescott coefficients against true WMO sunshine duration.

``processing/sunshine.py`` models sunshine as ``n/N = (Kt - a) / b`` and ships
the standard global coefficients ``a=0.25, b=0.50``. Those are known to fit
poorly at high latitudes, where both drift with climate. This script replaces
them with numbers fitted to the real definition.

The real definition is hours during which **direct normal** irradiance exceeds
120 W/m², which ERA5 does not publish but which is computable from hourly
``fdir`` (direct radiation on a horizontal plane) by dividing out the solar
zenith angle. Doing that globally would mean ~87,600 fields and hundreds of
gigabytes; doing it at a few dozen sites for one year is a rounding error, and
a slope fitted from a well-spread sample is what the model needs.

Usage
-----

    uv run python scripts/calibrate_sunshine.py --year 2023
    uv run python scripts/calibrate_sunshine.py --year 2023 --write

``--write`` updates ``sunshine_coefficients.json`` next to the module, which
``processing/sunshine.py`` picks up if present. Without it the script only
reports, so you can look at the fit before adopting it.

Downloads land in ``data/raw/era5/calibration/`` and are cached; re-running is
a no-op unless ``--force``.
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from wtg_pipeline.config import ensure_dir, era5_raw_dir  # noqa: E402
from wtg_pipeline.processing.sunshine import (  # noqa: E402
    LATITUDE_BANDS,
    band_for_latitude,
    clearness_index,
    day_length_hours,
    fit_angstrom_prescott,
    wmo_sunshine_hours,
)

log = logging.getLogger("calibrate_sunshine")

DATASET = "reanalysis-era5-single-levels"

#: Direct radiation for the WMO count; total for the clearness index.
VARIABLES = (
    "total_sky_direct_solar_radiation_at_surface",
    "surface_solar_radiation_downwards",
)


@dataclass(frozen=True)
class Site:
    name: str
    latitude: float
    longitude: float

    @property
    def band(self) -> str:
        """Derived, never hand-written — the band boundaries live in one place
        and a site cannot end up fitted into one band and applied from another."""
        return band_for_latitude(self.latitude)


#: Chosen for spread in **both** latitude and cloudiness, because the fit needs
#: variation in n/N to determine a slope at all — see `fit_angstrom_prescott`,
#: which refuses a sample drawn from a single climate. A set of sunny
#: low-latitude cities would produce a confident-looking fit carrying no
#: information.
SITES: tuple[Site, ...] = (
    Site("Tromso", 69.65, 18.96),
    Site("Reykjavik", 64.15, -21.94),
    Site("Edinburgh", 55.95, -3.19),
    Site("Berlin", 52.52, 13.40),
    Site("London", 51.51, -0.13),
    Site("Madrid", 40.42, -3.70),
    Site("Phoenix", 33.45, -112.07),
    Site("Cairo", 30.04, 31.24),
    Site("Delhi", 28.61, 77.21),
    Site("Bangkok", 13.76, 100.50),
    Site("Singapore", 1.35, 103.82),
    Site("Nairobi", -1.29, 36.82),
    Site("Cusco", -13.53, -71.97),
    Site("Santiago", -33.45, -70.67),
    Site("Wellington", -41.29, 174.78),
)

BANDS = tuple(name for name, _limit in LATITUDE_BANDS)


def calibration_dir(base_dir: Path | None = None) -> Path:
    root = base_dir if base_dir is not None else era5_raw_dir() / "calibration"
    return ensure_dir(root)


def target_path(site: Site, year: int, base_dir: Path | None = None) -> Path:
    return calibration_dir(base_dir) / f"{site.name.lower()}_{year}.nc"


def download_site(site: Site, year: int, *, client, base_dir=None, force=False) -> Path:
    """One year of hourly fdir + ssrd over a small box around one site."""
    path = target_path(site, year, base_dir)
    if not force and path.exists() and path.stat().st_size > 0:
        log.info("cache hit: %s", path.name)
        return path

    half = 0.25  # a box just larger than one 0.25° cell
    request = {
        "product_type": "reanalysis",
        "variable": list(VARIABLES),
        "year": str(year),
        "month": [f"{m:02d}" for m in range(1, 13)],
        "day": [f"{d:02d}" for d in range(1, 32)],
        "time": [f"{h:02d}:00" for h in range(24)],
        "area": [
            site.latitude + half,
            site.longitude - half,
            site.latitude - half,
            site.longitude + half,
        ],
        "data_format": "netcdf",
    }
    log.info("retrieving %s %d (hourly, 2 vars)", site.name, year)
    tmp = path.with_name(path.name + ".tmp")
    client.retrieve(DATASET, request, str(tmp))
    tmp.replace(path)
    return path


def samples_for_site(path: Path, site: Site) -> list[tuple[float, float]]:
    """``(Kt, n/N)`` pairs, one per day, from one site's hourly NetCDF."""
    import numpy as np
    import pandas as pd
    import xarray as xr

    ds = xr.open_dataset(path)
    try:
        fdir = _pick(ds, ("fdir", "total_sky_direct_solar_radiation_at_surface"))
        ssrd = _pick(ds, ("ssrd", "surface_solar_radiation_downwards"))

        # Average the little box down to one series; it is one or two cells.
        spatial = [d for d in fdir.dims if d not in ("time", "valid_time")]
        fdir = fdir.mean(dim=spatial)
        ssrd = ssrd.mean(dim=spatial)

        time_name = "time" if "time" in fdir.dims else "valid_time"
        times = pd.to_datetime(fdir[time_name].values)
        fdir_values = np.asarray(fdir.values, dtype="float64")
        ssrd_values = np.asarray(ssrd.values, dtype="float64")
    finally:
        ds.close()

    frame = pd.DataFrame(
        {"time": times, "fdir": fdir_values, "ssrd": ssrd_values}
    ).dropna()
    frame["date"] = frame["time"].dt.floor("D")

    samples: list[tuple[float, float]] = []
    for date, group in frame.groupby("date"):
        if len(group) != 24:
            continue  # a partial day would bias both terms
        group = group.sort_values("time")
        doy = int(date.dayofyear)

        daylight = day_length_hours(site.latitude, doy)
        if daylight <= 0:
            continue

        hours = wmo_sunshine_hours(
            list(group["fdir"]),
            latitude_deg=site.latitude,
            longitude_deg=site.longitude,
            day_of_year=doy,
        )
        kt = clearness_index(
            float(group["ssrd"].sum()),
            latitude_deg=site.latitude,
            day_of_year=doy,
        )
        fraction = min(1.0, hours / daylight)
        samples.append((kt, fraction))

    return samples


def _pick(ds, names: tuple[str, ...]):
    for name in names:
        if name in ds.variables:
            return ds[name]
    raise KeyError(f"none of {names} in {list(ds.data_vars)}")


def report(by_band: dict[str, list[tuple[float, float]]]) -> dict:
    """Fit globally and per band, and say how well each fits."""
    everything = [pair for pairs in by_band.values() for pair in pairs]
    result: dict = {"n_samples": len(everything), "bands": {}}

    a, b = fit_angstrom_prescott(everything)
    result["global"] = {"a": round(a, 4), "b": round(b, 4), "n": len(everything)}
    log.info("global: a=%.4f b=%.4f  (n=%d)", a, b, len(everything))

    for band in BANDS:
        pairs = by_band.get(band, [])
        if len(pairs) < 100:
            log.warning("band %s has only %d samples; skipping", band, len(pairs))
            continue
        ba, bb = fit_angstrom_prescott(pairs)
        rmse = _rmse(pairs, ba, bb)
        result["bands"][band] = {
            "a": round(ba, 4), "b": round(bb, 4), "n": len(pairs), "rmse": round(rmse, 4)
        }
        log.info("  %-12s a=%.4f b=%.4f  n=%-6d rmse=%.4f", band, ba, bb, len(pairs), rmse)

    return result


def _rmse(pairs, a: float, b: float) -> float:
    total = 0.0
    for kt, fraction in pairs:
        predicted = a + b * fraction
        total += (kt - predicted) ** 2
    return math.sqrt(total / len(pairs))


def coefficients_path() -> Path:
    import wtg_pipeline.processing.sunshine as sunshine_mod

    return Path(sunshine_mod.__file__).with_name("sunshine_coefficients.json")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, default=2023)
    parser.add_argument("--write", action="store_true", help="Adopt the fitted values.")
    parser.add_argument("--force", action="store_true", help="Re-download cache hits.")
    parser.add_argument("--offline", action="store_true",
                        help="Fit from whatever is already downloaded.")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO, format="%(asctime)sZ %(levelname)s %(message)s"
    )

    client = None
    if not args.offline:
        import cdsapi

        client = cdsapi.Client()

    by_band: dict[str, list[tuple[float, float]]] = {band: [] for band in BANDS}
    for site in SITES:
        path = target_path(site, args.year)
        if not args.offline:
            path = download_site(site, args.year, client=client, force=args.force)
        if not path.exists():
            log.warning("%s: no data at %s; skipping", site.name, path.name)
            continue
        pairs = samples_for_site(path, site)
        log.info("%-12s %d usable days", site.name, len(pairs))
        by_band[site.band].extend(pairs)

    if not any(by_band.values()):
        log.error("no samples; nothing to fit")
        return 1

    result = report(by_band)
    result["year"] = args.year
    result["definition"] = (
        "WMO sunshine duration: hours with direct normal irradiance > 120 W/m2, "
        "from ERA5 hourly fdir divided by cos(solar zenith)."
    )

    print(json.dumps(result, indent=2))

    if args.write:
        out = coefficients_path()
        out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        log.info("wrote %s — processing/sunshine.py will read it on next import", out)
    else:
        log.info("dry run; pass --write to adopt these coefficients")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
