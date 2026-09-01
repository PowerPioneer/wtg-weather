"""ERA5 daily-statistics downloader (Copernicus CDS).

The monthly-means downloader in :mod:`era5` gives one number per month, which
is a 24-hour mean. That is the wrong quantity for a travel-planning product:
a traveller thinks in daytime highs and overnight lows, and a monthly mean of
a monthly mean has no day-to-day spread to show them. This module fetches the
daily statistics those surfaces actually need.

Dataset: ``derived-era5-single-levels-daily-statistics``.

Three properties of that dataset shape this module:

* **It is computed at retrieval time, not archived.** The daily aggregation
  happens while your request is served, so requests are slower than an archived
  lookup and a large one is more likely to time out. Hence the download is
  chunked **by month**, not by year — a failed chunk costs one month, and a
  ten-year run stays resumable at a granularity that matters over a job this
  long.

* **``frequency`` decides whether a daily maximum is real.** At ``6_hourly``
  the sampler can miss the ~14:00 diurnal peak entirely and the "maximum"
  quietly becomes an afternoon-ish sample. Everything here uses ``1_hourly``;
  do not lower it to make a download smaller.

* **``time_zone`` defines where a day starts.** We use ``utc+00:00``
  everywhere, because the alternative is downloading each variable once per
  time zone and mosaicking the result. This is sound for a climatology: a
  24-hour window contains exactly one local afternoon peak and one pre-dawn
  minimum whatever the offset, so the daily max and min are captured
  correctly. The only cost is that roughly one day in thirty is attributed to
  the neighbouring month, which does not survive averaging over ten years.

Tests MUST mock ``cdsapi.Client`` — never hit the live CDS API.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from wtg_pipeline.config import ensure_dir, era5_raw_dir

log = logging.getLogger(__name__)


DEFAULT_DATASET = "derived-era5-single-levels-daily-statistics"
DEFAULT_PRODUCT_TYPE = "reanalysis"

#: Sub-daily sampling used to build each day's statistic. See module docstring:
#: this is a correctness setting, not a size knob.
DEFAULT_FREQUENCY = "1_hourly"

#: Day boundary. See module docstring for why a single global offset is right
#: for a climatology and what it costs.
DEFAULT_TIME_ZONE = "utc+00:00"


@dataclass(frozen=True)
class DailyVariable:
    """One (CDS variable, statistic) pair and the local stem it lands under.

    ``stem`` is what the rest of the pipeline knows the series by — it becomes
    the ``variable`` column in the aggregate, so it has to be stable and
    distinct from the monthly-means codes (``t2m``) that mean something else.
    """

    stem: str
    variable: str
    daily_statistic: str
    note: str


#: The seven daily series the product needs.
#:
#: ``daily_sum`` is only meaningful for accumulated variables, which is why
#: precipitation and solar radiation use it and nothing else does.
#:
#: ``sst`` and ``snow_depth`` are deliberately absent: both are premium map
#: variables, neither is charted with a band, and both are perfectly well
#: served by the existing monthly means.
ERA5_DAILY_VARIABLES: tuple[DailyVariable, ...] = (
    DailyVariable(
        "t2m_max", "2m_temperature", "daily_maximum",
        "the red line, the scored daytime high, the map, and the heat index",
    ),
    DailyVariable(
        "t2m_min", "2m_temperature", "daily_minimum",
        "the blue line and the scored overnight low",
    ),
    DailyVariable(
        "t2m_mean", "2m_temperature", "daily_mean",
        "relative humidity, which needs air temperature alongside dewpoint",
    ),
    DailyVariable(
        "tp_sum", "total_precipitation", "daily_sum",
        "rainfall and the wet-day count",
    ),
    DailyVariable(
        "si10_mean", "10m_wind_speed", "daily_mean",
        "wind, its Beaufort readout and its band",
    ),
    DailyVariable(
        "d2m_mean", "2m_dewpoint_temperature", "daily_mean",
        "relative humidity and its band",
    ),
    DailyVariable(
        "ssrd_sum", "surface_solar_radiation_downwards", "daily_sum",
        "sunshine hours and the sunny-day count",
    ),
)

DAILY_BY_STEM: dict[str, DailyVariable] = {v.stem: v for v in ERA5_DAILY_VARIABLES}

MONTHS: tuple[str, ...] = tuple(f"{m:02d}" for m in range(1, 13))
DAYS: tuple[str, ...] = tuple(f"{d:02d}" for d in range(1, 32))


class CDSClient(Protocol):
    """Structural type matching the subset of ``cdsapi.Client`` we use."""

    def retrieve(self, name: str, request: dict, target: str) -> object: ...


@dataclass(frozen=True)
class ERA5DailyRequest:
    daily: DailyVariable
    year: int
    month: int
    target: Path

    def to_cds_request(self) -> dict:
        return {
            "product_type": DEFAULT_PRODUCT_TYPE,
            "variable": [self.daily.variable],
            "year": str(self.year),
            "month": [f"{self.month:02d}"],
            # Asking for 31 days in a 30-day month is accepted and returns the
            # days that exist, which keeps this table constant.
            "day": list(DAYS),
            "daily_statistic": self.daily.daily_statistic,
            "time_zone": DEFAULT_TIME_ZONE,
            "frequency": DEFAULT_FREQUENCY,
            "data_format": "netcdf",
        }


def target_path(stem: str, year: int, month: int, base_dir: Path | None = None) -> Path:
    """Where one (variable, year, month) chunk lands.

    Monthly rather than yearly because the aggregation is computed while the
    request is served — see the module docstring.
    """
    root = base_dir if base_dir is not None else era5_raw_dir() / "daily"
    return root / f"{stem}_{year}{month:02d}.nc"


def year_paths(stem: str, year: int, base_dir: Path | None = None) -> list[Path]:
    """The twelve chunks that make up one (variable, year), in month order."""
    return [target_path(stem, year, m, base_dir=base_dir) for m in range(1, 13)]


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


def plan_requests(
    stems: list[str],
    years: list[int],
    base_dir: Path | None = None,
) -> list[ERA5DailyRequest]:
    requests: list[ERA5DailyRequest] = []
    for stem in stems:
        if stem not in DAILY_BY_STEM:
            raise ValueError(
                f"unknown daily series: {stem!r}. "
                f"Known: {', '.join(sorted(DAILY_BY_STEM))}"
            )
        daily = DAILY_BY_STEM[stem]
        for year in years:
            for month in range(1, 13):
                requests.append(
                    ERA5DailyRequest(
                        daily=daily,
                        year=year,
                        month=month,
                        target=target_path(stem, year, month, base_dir=base_dir),
                    )
                )
    return requests


def _is_cache_hit(path: Path) -> bool:
    return path.exists() and path.stat().st_size > 0


def download(
    years: list[int],
    stems: list[str] | None = None,
    *,
    client: CDSClient | None = None,
    base_dir: Path | None = None,
    force: bool = False,
) -> list[Path]:
    """Download daily statistics for (variables x years), one month per request.

    Returns every target path, cache hits included. If ``client`` is ``None`` a
    real :class:`cdsapi.Client` is constructed — tests must pass a mock.

    A failed chunk raises. That is deliberate: a silently-skipped month would
    become a hole in the climatology that nothing downstream can detect, and
    the run is resumable, so failing loudly costs only a re-run.
    """
    if stems is None:
        stems = [v.stem for v in ERA5_DAILY_VARIABLES]

    out_dir = ensure_dir(
        base_dir if base_dir is not None else era5_raw_dir() / "daily"
    )
    plan = plan_requests(stems, years, base_dir=out_dir)

    resolved_client = client if client is not None else _build_default_client()

    written: list[Path] = []
    total = len(plan)
    skipped = 0
    for idx, req in enumerate(plan, start=1):
        if not force and _is_cache_hit(req.target):
            skipped += 1
            written.append(req.target)
            # One line per file is 840 lines of noise on a resume; the summary
            # at the end is what a human actually reads.
            log.debug("[%d/%d] cache hit: %s", idx, total, req.target.name)
            continue
        log.info(
            "[%d/%d] retrieving %s %s %d-%02d → %s",
            idx, total, req.daily.variable, req.daily.daily_statistic,
            req.year, req.month, req.target.name,
        )
        req.target.parent.mkdir(parents=True, exist_ok=True)
        # Written under a temp name and renamed, because a chunk is treated as
        # complete purely because it exists and is non-empty — a half-written
        # file would poison every later resume.
        tmp = req.target.with_name(req.target.name + ".tmp")
        resolved_client.retrieve(DEFAULT_DATASET, req.to_cds_request(), str(tmp))
        tmp.replace(req.target)
        written.append(req.target)

    log.info(
        "daily download complete: %d chunk(s), %d already present, %d fetched",
        total, skipped, total - skipped,
    )
    return written


def _build_default_client() -> CDSClient:
    import cdsapi

    return cdsapi.Client()


def fetch(
    years_spec: str = "2016-2025",
    *,
    stems: list[str] | None = None,
    client: CDSClient | None = None,
    base_dir: Path | None = None,
    force: bool = False,
) -> list[Path]:
    """CLI-facing entry point. Parses a year spec and delegates to download()."""
    years = parse_year_range(years_spec)
    return download(
        years,
        stems=stems,
        client=client,
        base_dir=base_dir,
        force=force,
    )
