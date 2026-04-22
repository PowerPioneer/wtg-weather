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
