"""Refuse to ship a level that came out empty.

The premium tier is built from ~3.5 GB of geoBoundaries ADM2 sources that get
reclaimed for disk on the build box once the tiles exist. So "the ADM2
directory is empty" is a routine state there, not an exotic one — and until
these guards, the whole path from that state to a shipped archive was silent:

1. ``_load_admin2_frame`` turned an empty directory into an empty
   GeoDataFrame,
2. ``run_build_geojson`` turned that into a GeoJSON with zero features,
   overwriting a good build's 3.8 GB output,
3. ``run_build_pmtiles`` accepted it because the file *existed*, and
   tippecanoe produced a premium archive with no districts.

`weekly-advisories.sh` calls `rebuild-tiles.sh`, which defaults to both tiers,
so the weekly advisory refresh walked straight into it.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

pytest.importorskip("pandas")

import pandas as pd  # noqa: E402

from wtg_pipeline.pipeline_runner import run_build_pmtiles  # noqa: E402


def test_an_empty_adm2_directory_is_an_error_not_an_empty_frame(tmp_path: Path) -> None:
    gpd = pytest.importorskip("geopandas")
    from wtg_pipeline.pipeline_runner import _load_admin2_frame

    (tmp_path / "geoboundaries" / "adm2").mkdir(parents=True)

    with pytest.raises(FileNotFoundError, match="no \\*_ADM2.geojson"):
        _load_admin2_frame(gpd, tmp_path)


def test_the_error_names_both_ways_out(tmp_path: Path) -> None:
    # Whoever hits this at 03:00 on a Sunday needs to know they can either
    # re-download the sources or build the free tier alone.
    gpd = pytest.importorskip("geopandas")
    from wtg_pipeline.pipeline_runner import _load_admin2_frame

    (tmp_path / "geoboundaries" / "adm2").mkdir(parents=True)

    with pytest.raises(FileNotFoundError) as excinfo:
        _load_admin2_frame(gpd, tmp_path)

    message = str(excinfo.value)
    assert "download boundaries --source geoboundaries" in message
    assert "TIERS=free" in message


class _Geom:
    __geo_interface__ = {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}

    def representative_point(self):
        return self

    @property
    def y(self) -> float:
        return 0.0


def _percentiles(polygon_id: str) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"polygon_id": polygon_id, "variable": v, "month": 1,
             "p10": value * 0.9, "p50": value, "p90": value * 1.1}
            for v, value in (("t2m", 297.15), ("tp", 0.002), ("ssrd", 13_000_000.0))
        ]
    )


def test_a_level_that_joins_to_nothing_refuses_to_write(tmp_path: Path, monkeypatch) -> None:
    """The case that overwrote 3.8 GB of good output with 48 bytes.

    The boundary frame and the percentiles are both non-empty here but share
    no polygon id — the shape an id-vintage mismatch takes, and the shape an
    empty ADM2 directory took before the guard above.
    """
    from wtg_pipeline import pipeline_runner

    monkeypatch.setenv("WTG_PIPELINE_DATA_DIR", str(tmp_path))

    percentiles_dir = tmp_path / "intermediate" / "percentiles"
    percentiles_dir.mkdir(parents=True)
    _percentiles("this-id-is-in-the-percentiles").to_parquet(
        percentiles_dir / "country.parquet", index=False
    )

    frame = pipeline_runner.PolygonFrame(
        level="country",
        gdf=pd.DataFrame(
            {
                "polygon_id": ["but-the-polygon-carries-a-different-one"],
                "iso_a2": ["PE"],
                "name": ["Somewhere"],
                "admin1_code": [""],
                "geometry": [_Geom()],
            }
        ),
        iso_a2_col="iso_a2",
        id_col="polygon_id",
        name_col="name",
        admin1_code_col=None,
    )
    monkeypatch.setattr(pipeline_runner, "_load_boundary_frames", lambda levels: {"country": frame})

    with pytest.raises(RuntimeError, match="zero features"):
        pipeline_runner.run_build_geojson(tier="free", force=True)

    # And crucially, nothing was written — the previous build survives.
    assert not (tmp_path / "final" / "country_free.geojson").exists()


def test_an_existing_but_empty_geojson_is_not_tileable(tmp_path: Path, monkeypatch) -> None:
    """`exists()` was the only check, and an empty layer passes it."""
    monkeypatch.setenv("WTG_PIPELINE_DATA_DIR", str(tmp_path))
    final = tmp_path / "final"
    final.mkdir(parents=True)
    empty = json.dumps({"type": "FeatureCollection", "features": []})
    for level in ("country", "admin1"):
        (final / f"{level}_free.geojson").write_text(empty, encoding="utf-8")

    with pytest.raises(RuntimeError, match="empty FeatureCollection"):
        run_build_pmtiles(tier="free")


def test_a_missing_geojson_still_reports_as_missing(tmp_path: Path, monkeypatch) -> None:
    # The older guard must keep its own message; "empty" and "absent" are
    # different problems with different fixes.
    monkeypatch.setenv("WTG_PIPELINE_DATA_DIR", str(tmp_path))
    (tmp_path / "final").mkdir(parents=True)

    with pytest.raises(FileNotFoundError, match="is missing"):
        run_build_pmtiles(tier="free")
