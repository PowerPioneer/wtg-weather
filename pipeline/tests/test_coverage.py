"""The cached coverage matrix must equal exactextract, especially over masks.

This file exists for one reason: :meth:`CoverageMatrix.means` reimplements
exactextract's ``mean`` operation, and the reimplementation is only safe while
it agrees with the original on masked cells. ERA5 carries NaN over ocean, so
every coastal polygon in the product depends on that agreement.

The two failure modes worth naming, because both produce plausible-looking
maps rather than errors:

* letting a NaN into the weighted sum poisons the whole polygon to NaN;
* zero-filling NaN before the sum drags every coastal polygon toward zero.

Both are caught by ``test_matches_exactextract_with_nan``.
"""

from __future__ import annotations

import pytest

np = pytest.importorskip("numpy")
xr = pytest.importorskip("xarray")
gpd = pytest.importorskip("geopandas")
pytest.importorskip("rioxarray")
pytest.importorskip("exactextract")

from exactextract import exact_extract  # noqa: E402
from shapely.geometry import box  # noqa: E402

from wtg_pipeline.processing.coverage import (  # noqa: E402
    GridSpec,
    build_coverage,
    normalise_raster,
    polygon_digest,
)

# A 10x10 degree grid with descending latitude, like ERA5.
LATS = np.arange(10.0, 0.0, -1.0) + 0.5
LONS = np.arange(0.0, 10.0, 1.0) + 0.5
BASE = np.arange(100, dtype="float64").reshape(10, 10)


def _raster(values):
    """A normalised DataArray on the fixture grid."""
    da = xr.DataArray(
        np.asarray(values, dtype="float64"),
        coords={"y": LATS, "x": LONS},
        dims=("y", "x"),
    )
    return da.rio.write_crs("EPSG:4326", inplace=False)


def _polygons():
    return gpd.GeoDataFrame(
        {"pid": ["a", "b", "c"]},
        geometry=[
            box(0.2, 0.2, 3.4, 3.4),   # partial cells on every edge
            box(4.0, 5.0, 7.0, 8.0),   # exactly on cell boundaries
            box(8.5, 1.0, 9.9, 2.0),   # two cells, both partial
        ],
        crs="EPSG:4326",
    )


def _truth(values):
    frame = exact_extract(
        rast=_raster(values),
        vec=_polygons(),
        ops=["mean"],
        include_cols=["pid"],
        output="pandas",
    )
    return frame["mean"].to_numpy()


def _matrix(tmp_path):
    return build_coverage(
        level="test",
        gdf=_polygons(),
        id_col="pid",
        template2d=_raster(BASE),
        base_dir=tmp_path,
    )


def test_matches_exactextract_clean(tmp_path):
    matrix = _matrix(tmp_path)
    assert matrix.polygon_ids == ("a", "b", "c")
    np.testing.assert_allclose(matrix.means(BASE), _truth(BASE), rtol=0, atol=1e-12)


def test_matches_exactextract_with_nan(tmp_path):
    """Scattered masked cells — the ocean case, and the whole point of the file."""
    values = np.where((np.arange(100).reshape(10, 10) % 7) == 0, np.nan, BASE)
    matrix = _matrix(tmp_path)
    mine = matrix.means(values)

    np.testing.assert_allclose(mine, _truth(values), rtol=0, atol=1e-12)

    # And explicitly *not* the two wrong answers, so a future rewrite that
    # reintroduces either one fails here rather than on a map six months later.
    assert np.all(np.isfinite(mine)), "a NaN cell poisoned an otherwise valid polygon"
    naive_zero_fill = matrix.means(np.nan_to_num(values, nan=0.0))
    assert not np.allclose(mine, naive_zero_fill), "zero-filling must not be equivalent"


def test_fully_masked_polygon_is_nan_not_zero(tmp_path):
    """A polygon with no valid cell yields NaN, exactly as exactextract does."""
    values = BASE.copy()
    values[9, 8] = np.nan
    values[9, 9] = np.nan  # both of polygon "c"'s cells

    matrix = _matrix(tmp_path)
    mine = matrix.means(values)
    truth = _truth(values)

    assert np.isnan(mine[2]) and np.isnan(truth[2])
    np.testing.assert_allclose(mine[:2], truth[:2], rtol=0, atol=1e-12)


def test_cache_round_trip_is_identical(tmp_path):
    first = _matrix(tmp_path)
    second = _matrix(tmp_path)  # served from the .npz this time

    assert second.polygon_ids == first.polygon_ids
    np.testing.assert_array_equal(second.poly_index, first.poly_index)
    np.testing.assert_array_equal(second.cell_index, first.cell_index)
    np.testing.assert_allclose(second.weight, first.weight, rtol=0, atol=0)
    np.testing.assert_allclose(second.means(BASE), first.means(BASE), rtol=0, atol=0)

    cached = list(tmp_path.glob("*.npz"))
    assert len(cached) == 1, "a second build should reuse the cache, not add to it"


def test_moved_geometry_invalidates_the_cache(tmp_path):
    """A boundary vintage that moves borders must not reuse the old weights."""
    original = _polygons()
    moved = original.copy()
    moved.loc[0, "geometry"] = box(0.2, 0.2, 5.4, 5.4)

    assert polygon_digest(original, "pid") != polygon_digest(moved, "pid")

    build_coverage(level="test", gdf=original, id_col="pid",
                   template2d=_raster(BASE), base_dir=tmp_path)
    build_coverage(level="test", gdf=moved, id_col="pid",
                   template2d=_raster(BASE), base_dir=tmp_path)

    assert len(list(tmp_path.glob("*.npz"))) == 2


def test_relabelled_polygons_invalidate_the_cache(tmp_path):
    """Same shapes, different ids — the rows would otherwise be mislabelled."""
    original = _polygons()
    relabelled = original.copy()
    relabelled["pid"] = ["a", "b", "z"]
    assert polygon_digest(original, "pid") != polygon_digest(relabelled, "pid")


def test_wrong_grid_is_refused_not_reshaped(tmp_path):
    matrix = _matrix(tmp_path)
    with pytest.raises(ValueError, match="grid changed"):
        matrix.means(np.zeros((5, 5)))


def test_normalise_raster_wraps_longitude():
    """ERA5 ships 0..360; the weights are built on -180..180, so this must move."""
    lons = np.array([0.0, 90.0, 180.0, 270.0])
    da = xr.DataArray(
        np.arange(8, dtype="float64").reshape(2, 4),
        coords={"latitude": np.array([10.0, 9.0]), "longitude": lons},
        dims=("latitude", "longitude"),
    )
    out = normalise_raster(da)

    assert out.dims == ("y", "x")
    np.testing.assert_allclose(out["x"].values, [-180.0, -90.0, 0.0, 90.0])
    # 270° becomes -90° and sorts to the front, carrying its value with it.
    assert float(out.isel(y=0, x=1)) == 3.0


def test_normalise_raster_is_idempotent():
    """It runs once per file; a second pass on already-normalised data is a no-op."""
    da = xr.DataArray(
        np.arange(8, dtype="float64").reshape(2, 4),
        coords={"latitude": np.array([10.0, 9.0]), "longitude": np.array([0.0, 90.0, 180.0, 270.0])},
        dims=("latitude", "longitude"),
    )
    once = normalise_raster(da)
    twice = normalise_raster(once)
    np.testing.assert_array_equal(once.values, twice.values)
    np.testing.assert_allclose(once["x"].values, twice["x"].values)


def test_grid_spec_distinguishes_shifted_grids():
    """Same shape, different position — must not share a cache entry."""
    a = GridSpec.from_raster(_raster(BASE))
    shifted = xr.DataArray(
        BASE, coords={"y": LATS + 0.25, "x": LONS}, dims=("y", "x")
    ).rio.write_crs("EPSG:4326", inplace=False)
    b = GridSpec.from_raster(shifted)

    assert (a.ny, a.nx) == (b.ny, b.nx)
    assert a.digest != b.digest
