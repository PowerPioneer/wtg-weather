"""Convert ``.mbtiles`` → ``.pmtiles`` using the ``pmtiles`` CLI.

PMTiles is the single-file tile format served directly by MapLibre via the
``pmtiles://`` protocol. Once converted the mbtiles intermediate can be
discarded.
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
from pathlib import Path

log = logging.getLogger(__name__)


def convert(mbtiles: Path, pmtiles: Path, *, pmtiles_bin: str = "pmtiles") -> Path:
    """Run ``pmtiles convert <mbtiles> <pmtiles>``.

    The ``pmtiles`` CLI lives under ``go-pmtiles`` (``pmtiles convert``).
    Expected to be on PATH. Output directory is created if necessary.
    """
    if shutil.which(pmtiles_bin) is None:
        raise RuntimeError(
            f"{pmtiles_bin} not found on PATH. Install from "
            "https://github.com/protomaps/go-pmtiles/releases."
        )
    if not mbtiles.exists():
        raise FileNotFoundError(mbtiles)

    pmtiles.parent.mkdir(parents=True, exist_ok=True)
    if pmtiles.exists():
        pmtiles.unlink()
    cmd = [pmtiles_bin, "convert", str(mbtiles), str(pmtiles)]
    log.info("running: %s", " ".join(cmd))
    subprocess.run(cmd, check=True)
    if not pmtiles.exists():
        raise RuntimeError(f"pmtiles produced no output at {pmtiles}")
    return pmtiles


def show(pmtiles: Path, *, pmtiles_bin: str = "pmtiles") -> dict:
    """Run ``pmtiles show --json <pmtiles>`` and return the parsed metadata.

    Used in the post-build smoke test to verify that an artifact is readable
    (fulfils "both PMTiles files must open in the pmtiles CLI").
    """
    if shutil.which(pmtiles_bin) is None:
        raise RuntimeError(f"{pmtiles_bin} not found on PATH.")
    result = subprocess.run(
        [pmtiles_bin, "show", "--json", str(pmtiles)],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)
