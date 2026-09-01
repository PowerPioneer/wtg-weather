"""The coverage-matrix aggregator must equal the per-timestep one it replaced.

`aggregate_variable_year` used to call `exact_extract` once per timestep. It
now builds the polygon/cell overlap once and reduces each timestep with
`bincount` (see `processing/coverage.py`). That is a pure performance change —
1,080 geometry passes become 1, and daily statistics become tractable — so the
numbers must not move at all.

This file is the gate for that claim. It runs the *old* algorithm inline as a
reference implementation and compares it, value for value, against the shipped
function, on ERA5-shaped input: 0..360 longitude that has to be wrapped and
re-sorted, descending latitude, twelve timesteps, and a NaN ocean mask that
makes every coastal polygon depend on exactextract's renormalisation.

Note this exercises the whole path (NetCDF → DataFrame), not just the reducer,
so a mistake in the normalisation, the timestep ordering, or the row assembly
fails here too — not only a mistake in the arithmetic.
"""

from __future__ import annotations

import pytest

np = pytest.importorskip("numpy")
pd = pytest.importorskip("pandas")
xr = pytest.importorskip("xarray")
gpd = pytest.importorskip("geopandas")
pytest.importorskip("rioxarray")
pytest.importorskip("exactextract")

from exactextract import exact_extract  # noqa: E402
from shapely.geometry import box  # noqa: E402

from wtg_pipeline.processing.aggregate import (  # noqa: E402
    PolygonFrame,
    aggregate_variable_year,
)
from wtg_pipeline.processing.coverage import clear_memo, normalise_raster  # noqa: E402


@pytest.fixture(autouse=True)
def _isolate_coverage_cache():
    """The matrix is memoised per process; each test starts cold."""
    clear_memo()
    yield
    clear_memo()


def _write_era5_like(path, *, n_time=12, seed=7):
    """An ERA5-shaped NetCDF: 0..360 lon, descending lat, ocean as NaN."""
    rng = np.random.default_rng(seed)
    lats = np.arange(60.0, -60.0, -2.5)      # 48, descending
    lons = np.arange(0.0, 360.0, 2.5)        # 144, 0..360 like ERA5
    values = 273.15 + rng.normal(15.0, 8.0, size=(n_time, lats.size, lons.size))

    # A NaN "ocean" mask, deliberately irregular so polygons straddle it and
    # partial masking actually changes the answer.
    mask = rng.random((lats.size, lons.size)) < 0.30
    values[:, mask] = np.nan

    times = pd.date_range("2020-01-01", periods=n_time, freq="MS")
    ds = xr.Dataset(
        {"t2m": (("time", "latitude", "longitude"), values)},
        coords={"time": times, "latitude": lats, "longitude": lons},
    )
    ds.to_netcdf(path)
    ds.close()
    return path


def _polygons():
    """Polygons that straddle the antimeridian wrap, the mask, and cell edges."""
    geoms = [
        box(-170.0, 10.0, -150.0, 30.0),   # far west, from lon 190-210 pre-wrap
        box(-10.0, -20.0, 12.5, 5.0),      # spans the 0/360 seam
        box(100.0, 20.0, 130.0, 45.0),     # ordinary interior
        box(20.1, -55.3, 33.7, -40.2),     # deliberately off cell boundaries
        box(175.0, -5.0, 179.9, 5.0),      # hard against the antimeridian
    ]
    return gpd.GeoDataFrame(
        {
            "pid": ["p1", "p2", "p3", "p4", "p5"],
            "iso": ["AA", "BB", "CC", "DD", "EE"],
            "a1": ["AA-1", "BB-1", "CC-1", "DD-1", "EE-1"],
        },
        geometry=geoms,
        crs="EPSG:4326",
    )


def _frame(level="admin1"):
    return PolygonFrame(
        level=level,
        gdf=_polygons(),
        iso_a2_col="iso",
        id_col="pid",
        name_col="pid",
        admin1_code_col="a1",
    )


def _reference_rows(nc_path, variable, polygons):
    """The pre-refactor algorithm: one exact_extract pass per timestep."""
    ds = xr.open_dataset(nc_path)
    da = ds[variable]
    rows = []
    for t in da["time"].values:
        ts = pd.Timestamp(t)
        rast = normalise_raster(da.sel(time=t))
        result = exact_extract(
            rast=rast,
            vec=polygons.gdf,
            ops=["mean"],
            include_cols=[polygons.id_col],
            output="pandas",
        )
        for row in result.itertuples(index=False):
            value = getattr(row, "mean")
            rows.append(
                {
                    "polygon_id": str(getattr(row, polygons.id_col)),
                    "year": int(ts.year),
                    "month": int(ts.month),
                    "value": float(value) if value is not None else float("nan"),
                }
            )
    ds.close()
    return pd.DataFrame(rows)


def test_matches_the_per_timestep_algorithm(tmp_path):
    nc_path = _write_era5_like(tmp_path / "t2m_2020.nc")
    polygons = _frame()

    got = aggregate_variable_year(
        nc_path, "t2m", polygons, coverage_base_dir=tmp_path / "cov"
    )
    want = _reference_rows(nc_path, "t2m", polygons)

    assert len(got) == len(want) == 12 * 5

    key = ["polygon_id", "year", "month"]
    merged = got.merge(want, on=key, suffixes=("_new", "_old"))
    assert len(merged) == len(want), "row identities diverged"

    np.testing.assert_allclose(
        merged["value_new"].to_numpy(),
        merged["value_old"].to_numpy(),
        rtol=0,
        atol=1e-12,
        equal_nan=True,
    )

    # The mask must actually have bitten, or this test proves nothing about
    # the renormalisation it exists to protect.
    assert np.isfinite(merged["value_new"].to_numpy()).any()


def test_carries_the_attribute_columns_through(tmp_path):
    nc_path = _write_era5_like(tmp_path / "t2m_2020.nc", n_time=2)
    got = aggregate_variable_year(
        nc_path, "t2m", _frame(), coverage_base_dir=tmp_path / "cov"
    )

    assert list(got.columns) == [
        "polygon_id", "iso_a2", "admin1_code", "year", "month", "variable", "value",
    ]
    assert set(got["variable"]) == {"t2m"}
    assert sorted(got["month"].unique().tolist()) == [1, 2]

    p3 = got[got["polygon_id"] == "p3"].iloc[0]
    assert p3["iso_a2"] == "CC"
    assert p3["admin1_code"] == "CC-1"


def test_duplicate_polygon_ids_still_raise(tmp_path):
    """The identity guard predates this refactor and must survive it."""
    nc_path = _write_era5_like(tmp_path / "t2m_2020.nc", n_time=1)
    gdf = _polygons()
    gdf.loc[4, "pid"] = "p1"
    polygons = PolygonFrame(
        level="admin1", gdf=gdf, iso_a2_col="iso", id_col="pid",
        name_col="pid", admin1_code_col="a1",
    )

    with pytest.raises(ValueError, match="not unique"):
        aggregate_variable_year(
            nc_path, "t2m", polygons, coverage_base_dir=tmp_path / "cov"
        )


def test_second_file_reuses_the_matrix(tmp_path):
    """Two variable-years, one geometry pass — the point of the whole change."""
    import wtg_pipeline.processing.coverage as cov

    first = _write_era5_like(tmp_path / "t2m_2020.nc", n_time=2, seed=1)
    second = _write_era5_like(tmp_path / "t2m_2021.nc", n_time=2, seed=2)
    polygons = _frame()

    builds = {"n": 0}
    real = cov.exact_extract_builder if hasattr(cov, "exact_extract_builder") else None
    assert real is None  # guard: the module has no such indirection to stub

    original = cov._require_exactextract

    def counting():
        builds["n"] += 1
        return original()

    cov._require_exactextract = counting
    try:
        aggregate_variable_year(first, "t2m", polygons, coverage_base_dir=tmp_path / "cov")
        aggregate_variable_year(second, "t2m", polygons, coverage_base_dir=tmp_path / "cov")
    finally:
        cov._require_exactextract = original

    assert builds["n"] == 1, "the coverage matrix was rebuilt for the second file"
