"""Convert ``.mbtiles`` → ``.pmtiles`` using the ``pmtiles`` CLI.

PMTiles is the single-file tile format served directly by MapLibre via the
``pmtiles://`` protocol. Once converted the mbtiles intermediate can be
discarded.
"""

from __future__ import annotations

import json
import logging
import os
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

    # Converted beside the target and renamed over it, never written in place.
    # `pmtiles` is the archive Caddy is serving: deleting it first and
    # converting into it left the map with a missing, then a growing, file for
    # the whole conversion — and an OOM kill part-way (the documented failure
    # mode on this box) left it truncated, past the reach of
    # `rebuild-tiles.sh`'s rollback, which only runs on failures it sees.
    # Same directory, so the rename is atomic on the same filesystem.
    pmtiles.parent.mkdir(parents=True, exist_ok=True)
    partial = pmtiles.with_name(pmtiles.name + ".tmp")
    partial.unlink(missing_ok=True)
    cmd = [pmtiles_bin, "convert", str(mbtiles), str(partial)]
    log.info("running: %s", " ".join(cmd))
    try:
        subprocess.run(cmd, check=True)
        if not partial.exists():
            raise RuntimeError(f"pmtiles produced no output at {partial}")
    except BaseException:
        partial.unlink(missing_ok=True)
        raise
    os.replace(partial, pmtiles)
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
