from __future__ import annotations

import os
from pathlib import Path


def _pkg_root() -> Path:
    return Path(__file__).resolve().parent


def _repo_root() -> Path:
    return _pkg_root().parent.parent.parent


def data_root() -> Path:
    override = os.environ.get("WTG_PIPELINE_DATA_DIR")
    if override:
        return Path(override)
    return _repo_root() / "pipeline" / "data"


def raw_dir() -> Path:
    return data_root() / "raw"


def intermediate_dir() -> Path:
    return data_root() / "intermediate"


def final_dir() -> Path:
    return data_root() / "final"


def era5_raw_dir() -> Path:
    return raw_dir() / "era5"


def boundaries_raw_dir() -> Path:
    return raw_dir() / "geoboundaries"


def advisories_raw_dir() -> Path:
    return raw_dir() / "advisories"


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


# How old a source's newest dump may be before `wtg process advisories` calls
# it stale. Three weeks: the scrape is weekly, so this tolerates two missed
# runs (a failed cron, a government site down for a fortnight) before it
# complains, and still notices long before a snapshot is a season old.
#
# This is the *absolute* threshold, measured against the clock. It is the one
# that catches the failure mode where every source is equally out of date —
# nothing has run at all — which the relative check in
# `processing.advisories.stale_sources` deliberately cannot see.
ADVISORY_STALE_AFTER_DAYS = 21


def advisory_stale_after_days() -> int:
    """The absolute staleness threshold in days, overridable by environment.

    ``WTG_ADVISORY_STALE_DAYS`` exists so the box that runs the scrape on a
    different cadence than this repo assumes can say so without a code change.
    A value that is not a positive integer is ignored, loudly enough to find
    in the log but without failing the run: a typo'd threshold must not cost
    the whole consolidation.
    """
    raw = os.environ.get("WTG_ADVISORY_STALE_DAYS")
    if raw is None or not raw.strip():
        return ADVISORY_STALE_AFTER_DAYS
    try:
        value = int(raw)
    except ValueError:
        value = 0
    if value <= 0:
        import logging

        logging.getLogger(__name__).warning(
            "WTG_ADVISORY_STALE_DAYS=%r is not a positive integer; using %d",
            raw,
            ADVISORY_STALE_AFTER_DAYS,
        )
        return ADVISORY_STALE_AFTER_DAYS
    return value
