"""`tiles.pmtiles.convert` replaces the served archive atomically.

The target is the file Caddy serves. It used to be deleted first and converted
into, so a conversion that failed — or was OOM-killed — left the map with a
truncated archive or none. `pmtiles` itself is mocked: the property under test
is what happens to the files around it.
"""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

import pytest

from wtg_pipeline.tiles import pmtiles as pmtiles_mod

OLD = b"PMTiles-old-archive"
NEW = b"PMTiles-new-archive"


@pytest.fixture
def paths(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[Path, Path]:
    monkeypatch.setattr(pmtiles_mod.shutil, "which", lambda _: "/usr/bin/pmtiles")
    mbtiles = tmp_path / "free.mbtiles"
    mbtiles.write_bytes(b"mbtiles")
    served = tmp_path / "tiles" / "free.pmtiles"
    served.parent.mkdir()
    served.write_bytes(OLD)
    return mbtiles, served


def _fake_convert(
    monkeypatch: pytest.MonkeyPatch, *, write: bytes | None, fail: bool
) -> list[list[str]]:
    calls: list[list[str]] = []

    def run(cmd: list[str], check: bool = False, **_: Any) -> None:
        calls.append(cmd)
        out = Path(cmd[-1])
        if write is not None:
            out.write_bytes(write)
        if fail:
            raise subprocess.CalledProcessError(1, cmd)

    monkeypatch.setattr(pmtiles_mod.subprocess, "run", run)
    return calls


def test_success_replaces_the_archive(
    paths: tuple[Path, Path], monkeypatch: pytest.MonkeyPatch
) -> None:
    mbtiles, served = paths
    calls = _fake_convert(monkeypatch, write=NEW, fail=False)

    assert pmtiles_mod.convert(mbtiles, served) == served
    assert served.read_bytes() == NEW
    # Converted beside the archive, never into it.
    assert Path(calls[0][-1]) != served
    assert Path(calls[0][-1]).parent == served.parent
    assert list(served.parent.iterdir()) == [served]


def test_failure_leaves_the_served_archive_untouched(
    paths: tuple[Path, Path], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Including the half-written output a dying `pmtiles convert` leaves."""
    mbtiles, served = paths
    _fake_convert(monkeypatch, write=b"PMTiles-trunc", fail=True)

    with pytest.raises(subprocess.CalledProcessError):
        pmtiles_mod.convert(mbtiles, served)
    assert served.read_bytes() == OLD
    assert list(served.parent.iterdir()) == [served]


def test_no_output_is_an_error_and_keeps_the_archive(
    paths: tuple[Path, Path], monkeypatch: pytest.MonkeyPatch
) -> None:
    mbtiles, served = paths
    _fake_convert(monkeypatch, write=None, fail=False)

    with pytest.raises(RuntimeError, match="no output"):
        pmtiles_mod.convert(mbtiles, served)
    assert served.read_bytes() == OLD


def test_a_stale_partial_from_a_killed_run_is_discarded(
    paths: tuple[Path, Path], monkeypatch: pytest.MonkeyPatch
) -> None:
    """A SIGKILL skips every cleanup, so the next run must not trip over it."""
    mbtiles, served = paths
    stale = served.with_name(served.name + ".tmp")
    stale.write_bytes(b"left-by-oom-kill")
    _fake_convert(monkeypatch, write=NEW, fail=False)

    pmtiles_mod.convert(mbtiles, served)
    assert served.read_bytes() == NEW
    assert not stale.exists()
