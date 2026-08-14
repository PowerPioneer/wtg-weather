#!/usr/bin/env python3
"""Fail if a PMTiles archive is not complete on disk.

`rebuild-tiles.sh` used to accept any non-empty output (`[[ -s ]]`), which is
how a partially written archive reached production twice: `pmtiles convert`
hit ENOSPC part-way through, leaving a file that was large, structurally
valid at the front, and missing most of its tile data.

`pmtiles verify` does not help here. It checks the directory structure, which
lives in the first few kilobytes, so it passes on a truncated file — measured:
a 39,866,203-byte archive cut to 24,000,000 bytes still verified clean.

The PMTiles v3 header records where the tile data ends. Comparing that against
the real file size is what actually detects a short write.

Usage: verify-pmtiles.py <archive.pmtiles>
Exit 0 if complete, 1 otherwise (reason on stderr).
"""

from __future__ import annotations

import struct
import sys
from pathlib import Path

HEADER_BYTES = 127
MAGIC = b"PMTiles"
# Byte offsets of the two uint64 fields we need, per the PMTiles v3 spec.
TILE_DATA_OFFSET = 56
TILE_DATA_LENGTH = 64


def check(path: Path) -> str | None:
    """Return an error string, or None when the archive looks complete."""
    try:
        size = path.stat().st_size
    except OSError as exc:
        return f"cannot stat: {exc}"

    if size < HEADER_BYTES:
        return f"only {size} bytes; smaller than a PMTiles header"

    with path.open("rb") as handle:
        header = handle.read(HEADER_BYTES)

    if header[:7] != MAGIC:
        return f"bad magic {header[:7]!r}; not a PMTiles archive"

    version = header[7]
    if version != 3:
        # Only v3 is produced here; refuse to guess at another layout rather
        # than read the wrong offsets and report a bogus verdict.
        return f"unsupported spec version {version}"

    data_offset = struct.unpack_from("<Q", header, TILE_DATA_OFFSET)[0]
    data_length = struct.unpack_from("<Q", header, TILE_DATA_LENGTH)[0]
    expected = data_offset + data_length

    if size < expected:
        short = expected - size
        return (
            f"truncated: header declares tile data ending at {expected} bytes "
            f"but the file is {size} ({short} bytes short)"
        )
    return None


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(f"usage: {Path(argv[0]).name} <archive.pmtiles>", file=sys.stderr)
        return 2

    path = Path(argv[1])
    problem = check(path)
    if problem is not None:
        print(f"{path}: {problem}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
