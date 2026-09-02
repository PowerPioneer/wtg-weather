#!/usr/bin/env python
"""Measure how much of a level's area actually survives into the built tiles.

Tippecanoe silently loses polygons. It names the tiles it thins explicitly —
"Going to try keeping the sparsest 36.84%" — but that message accounts for only
some of the loss, and nothing at all reports the rest. On the 2026-08-30 build,
tile 6/32/21 carried 92 of the 189 Dutch municipalities that intersect it and
left 32.8% of the country with no admin-2 polygon, without a single line in the
log. That reached the map as holes: the admin-1 layer stopped at zoom 6.5, so
map zoom 6.5-6.99 — served from those z6 tiles — had admin-2 as its only fill.

So this compares the *rendered* geometry against the source boundaries, per
tile, per zoom, and reports the fraction of source area that no feature covers.
It is the check that turns "some regions disappear when I zoom" into a number.

    uv run python scripts/audit_tile_coverage.py --iso NLD --level admin2
    uv run python scripts/audit_tile_coverage.py --iso NLD --level admin1 --zooms 3-9

A few points of uncovered area are normal and does not move with zoom: the
admin-1 layer is Natural Earth and the admin-2 source is geoBoundaries, and the
two disagree about whether the IJsselmeer is land. Loss that *appears* at one
zoom and is gone at the next is the failure this looks for.

Needs `tippecanoe-decode` on PATH — it ships with tippecanoe.
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

# Uncovered fraction at or above which a zoom is called a failure. Well clear
# of the few points of dataset disagreement, well under the 32.8% that started
# this.
DEFAULT_THRESHOLD = 5.0


def tile_bbox(z: int, x: int, y: int):
    from shapely.geometry import box

    def lon(tx: int) -> float:
        return tx / 2**z * 360.0 - 180.0

    def lat(ty: int) -> float:
        n = math.pi * (1.0 - 2.0 * ty / 2**z)
        return math.degrees(math.atan(math.sinh(n)))

    return box(lon(x), lat(y + 1), lon(x + 1), lat(y))

def covering_tile(z: int, lon: float, lat: float) -> tuple[int, int]:
    """The z/x/y tile containing a point, in the usual XYZ scheme."""
    x = int((lon + 180.0) / 360.0 * 2**z)
    lat_rad = math.radians(lat)
    y = int(
        (1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi)
        / 2.0
        * 2**z
    )
    return x, y


def tile_geometries(mbtiles: Path, z: int, x: int, y: int, layer: str):
    """Every geometry the built tile carries for one layer, or ``[]``."""
    from shapely.geometry import shape

    proc = subprocess.run(
        ["tippecanoe-decode", str(mbtiles), str(z), str(x), str(y)],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0 or not proc.stdout.strip():
        return []
    try:
        decoded = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return []
    out = []
    for tile_layer in decoded.get("features", []):
        props = tile_layer.get("properties") or {}
        if props.get("layer") != layer:
            continue
        for feature in tile_layer.get("features", []):
            try:
                out.append(shape(feature["geometry"]).buffer(0))
            except Exception:  # noqa: BLE001 - a bad ring is a skip, not a stop
                continue
    return out


def parse_zooms(spec: str) -> list[int]:
    if "-" in spec:
        lo, hi = spec.split("-", 1)
        return list(range(int(lo), int(hi) + 1))
    return [int(part) for part in spec.split(",") if part]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--iso", required=True, help="ISO-3 code, e.g. NLD")
    parser.add_argument("--level", default="admin2", choices=["admin1", "admin2"])
    parser.add_argument("--tier", default="premium", choices=["free", "premium"])
    parser.add_argument("--zooms", default="5-9")
    parser.add_argument(
        "--threshold",
        type=float,
        default=DEFAULT_THRESHOLD,
        help=f"uncovered %% that fails the audit (default {DEFAULT_THRESHOLD})",
    )
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    args = parser.parse_args(argv)

    import geopandas as gpd
    from shapely.ops import unary_union

    mbtiles = args.data_dir / "intermediate" / "mbtiles" / f"{args.tier}.mbtiles"
    if not mbtiles.exists():
        print(f"no {mbtiles} — build the tiles first", file=sys.stderr)
        return 2

    source = (
        args.data_dir
        / "raw"
        / "geoboundaries"
        / "geoboundaries"
        / "adm2"
        / f"{args.iso}_ADM2.geojson"
    )
    if not source.exists():
        print(f"no boundary source at {source}", file=sys.stderr)
        return 2

    frame = gpd.read_file(source)
    truth = unary_union(frame.geometry.values.tolist())
    lon, lat = truth.centroid.x, truth.centroid.y

    worst = 0.0
    print(f"{args.iso} {args.level} ({args.tier})  source polygons: {len(frame)}")
    for z in parse_zooms(args.zooms):
        x, y = covering_tile(z, lon, lat)
        window = truth.intersection(tile_bbox(z, x, y))
        if window.is_empty or window.area == 0:
            continue
        geoms = tile_geometries(mbtiles, z, x, y, args.level)
        covered = unary_union(geoms) if geoms else None
        uncovered = (
            100.0
            if covered is None
            else window.difference(covered).area / window.area * 100.0
        )
        worst = max(worst, uncovered)
        flag = "  FAIL" if uncovered >= args.threshold else ""
        print(
            f"  z{z}/{x}/{y}: {len(geoms):5d} geoms in tile, "
            f"{uncovered:5.1f}% of source area uncovered{flag}"
        )

    if worst >= args.threshold:
        print(
            f"\nTILE_COVERAGE_LOSS level={args.level} tier={args.tier} "
            f"worst={worst:.1f}% threshold={args.threshold:.1f}% — the tiles are "
            f"missing area the source has. Anything rendering {args.level} as its "
            f"only fill at that zoom shows the gap as background.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
