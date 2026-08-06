"""Batched aggregation and percentile computation.

Both stages used to materialise a whole admin level in memory at once. At
country and admin-1 scale that was merely wasteful; at admin-2 scale it is
~53 million rows (49k polygons x 12 months x 90 variable-years), which does
not fit in the production server's RAM. These tests pin the streaming
behaviour and — just as importantly — the resume semantics, because an
admin-2 pass runs for days and must survive a crash.
"""

from __future__ import annotations

from pathlib import Path

import pytest

pd = pytest.importorskip("pandas")
pytest.importorskip("pyarrow")

from wtg_pipeline.processing.aggregate import (  # noqa: E402
    aggregate_level,
    aggregated_path,
    combine_parts,
    parts_dir,
)
from wtg_pipeline.processing.percentiles import (  # noqa: E402
    build_percentiles,
    percentiles_path,
)

COLUMNS = ["polygon_id", "iso_a2", "admin1_code", "year", "month", "variable", "value"]


def _rows(variable: str, year: int, polygons: int = 2):
    return pd.DataFrame(
        [
            {
                "polygon_id": f"p{p}",
                "iso_a2": "PE",
                "admin1_code": "",
                "year": year,
                "month": month,
                "variable": variable,
                "value": float(p * 10 + month + year - 2020),
            }
            for p in range(polygons)
            for month in (1, 2)
        ],
        columns=COLUMNS,
    )


class _StubPolygons:
    """Stands in for a PolygonFrame; aggregation is faked out per file."""

    level = "admin2"


def _fake_aggregate(monkeypatch, calls: list[str]):
    import wtg_pipeline.processing.aggregate as agg

    def fake(nc_path: Path, variable_code: str, polygons: object):
        calls.append(nc_path.name)
        year = int(nc_path.stem.split("_")[-1])
        return _rows(variable_code, year)

    monkeypatch.setattr(agg, "aggregate_variable_year", fake)


def _make_netcdfs(tmp_path: Path, variables: list[str], years: list[int]) -> Path:
    nc_dir = tmp_path / "era5"
    nc_dir.mkdir()
    for v in variables:
        for y in years:
            (nc_dir / f"{v}_{y}.nc").write_bytes(b"stub")
    return nc_dir


def test_combine_parts_streams_without_loading_everything(tmp_path: Path) -> None:
    parts = []
    for i in range(3):
        p = tmp_path / f"part{i}.parquet"
        _rows("t2m", 2020 + i).to_parquet(p, index=False)
        parts.append(p)

    out = tmp_path / "combined.parquet"
    rows = combine_parts(parts, out)

    assert rows == 12
    combined = pd.read_parquet(out)
    assert len(combined) == 12
    assert sorted(combined["year"].unique()) == [2020, 2021, 2022]
    assert list(combined.columns) == COLUMNS


def test_aggregate_level_writes_one_part_per_variable_year(
    tmp_path: Path, monkeypatch
) -> None:
    calls: list[str] = []
    _fake_aggregate(monkeypatch, calls)
    nc_dir = _make_netcdfs(tmp_path, ["t2m", "tp"], [2020, 2021])
    base = tmp_path / "agg"

    out = aggregate_level(
        level="admin2",
        polygons=_StubPolygons(),
        netcdf_dir=nc_dir,
        variable_codes=["t2m", "tp"],
        years=[2020, 2021],
        base_dir=base,
    )

    assert out == aggregated_path("admin2", base_dir=base)
    # 4 files x (2 polygons x 2 months) rows
    assert len(pd.read_parquet(out)) == 4 * 4
    assert len(calls) == 4
    # Parts are cleaned up once they are safely combined.
    assert not parts_dir("admin2", base_dir=base).exists()


def test_aggregate_level_resumes_from_completed_parts(
    tmp_path: Path, monkeypatch
) -> None:
    """The crash-recovery path: an admin-2 run is days long."""
    calls: list[str] = []
    _fake_aggregate(monkeypatch, calls)
    nc_dir = _make_netcdfs(tmp_path, ["t2m"], [2020, 2021])
    base = tmp_path / "agg"

    # Simulate a run that completed one part and then died before combining.
    parts = parts_dir("admin2", base_dir=base)
    parts.mkdir(parents=True, exist_ok=True)
    _rows("t2m", 2020).to_parquet(parts / "t2m_2020.parquet", index=False)

    aggregate_level(
        level="admin2",
        polygons=_StubPolygons(),
        netcdf_dir=nc_dir,
        variable_codes=["t2m"],
        years=[2020, 2021],
        base_dir=base,
    )

    # Only the missing year was recomputed.
    assert calls == ["t2m_2021.nc"]


def test_force_discards_stale_parts(tmp_path: Path, monkeypatch) -> None:
    """`--force` must not honour parts computed against older polygons.

    A part is keyed by variable and year only, so it cannot tell that the
    boundary vintage underneath it changed — which is exactly how a stale
    aggregate cache hid a boundary-source fix once already.
    """
    calls: list[str] = []
    _fake_aggregate(monkeypatch, calls)
    nc_dir = _make_netcdfs(tmp_path, ["t2m"], [2020])
    base = tmp_path / "agg"

    parts = parts_dir("admin2", base_dir=base)
    parts.mkdir(parents=True, exist_ok=True)
    _rows("t2m", 1999).to_parquet(parts / "t2m_2020.parquet", index=False)

    aggregate_level(
        level="admin2",
        polygons=_StubPolygons(),
        netcdf_dir=nc_dir,
        variable_codes=["t2m"],
        years=[2020],
        base_dir=base,
        force=True,
    )

    assert calls == ["t2m_2020.nc"]
    assert 1999 not in set(pd.read_parquet(aggregated_path("admin2", base_dir=base))["year"])


def test_percentiles_processes_one_variable_at_a_time(tmp_path: Path) -> None:
    source = tmp_path / "in"
    source.mkdir()
    agg = source / "admin2.parquet"
    pd.concat(
        [_rows(v, y) for v in ("t2m", "tp", "si10") for y in (2020, 2021, 2022)],
        ignore_index=True,
    ).to_parquet(agg, index=False)

    dest = tmp_path / "out"
    out = build_percentiles(level="admin2", aggregated_parquet=agg, base_dir=dest)

    assert out == percentiles_path("admin2", base_dir=dest)
    result = pd.read_parquet(out)
    # 2 polygons x 2 months x 3 variables, one row each.
    assert len(result) == 12
    assert sorted(result["variable"].unique()) == ["si10", "t2m", "tp"]
    assert set(result.columns) >= {"p10", "p50", "p90", "n_years"}
    assert (result["n_years"] == 3).all()


def test_percentiles_values_match_a_single_pass(tmp_path: Path) -> None:
    """Batching must not change the numbers it produces."""
    from wtg_pipeline.processing.percentiles import compute_percentiles

    frame = pd.concat(
        [_rows(v, y) for v in ("t2m", "tp") for y in (2020, 2021, 2022)],
        ignore_index=True,
    )
    source = tmp_path / "in"
    source.mkdir()
    agg = source / "admin2.parquet"
    frame.to_parquet(agg, index=False)

    batched = pd.read_parquet(
        build_percentiles(
            level="admin2", aggregated_parquet=agg, base_dir=tmp_path / "out"
        )
    )
    single = compute_percentiles(frame)

    key = ["polygon_id", "month", "variable"]
    merged = batched.sort_values(key).reset_index(drop=True)
    expected = single.sort_values(key).reset_index(drop=True)
    for col in ("p10", "p50", "p90", "n_years"):
        assert merged[col].tolist() == pytest.approx(expected[col].tolist())
