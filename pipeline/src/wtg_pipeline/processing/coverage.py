"""Cached polygon/raster coverage weights — the thing that makes daily data possible.

Aggregation used to call :func:`exactextract.exact_extract` once per timestep.
That recomputes, from scratch and for every single raster, an answer that
depends only on two things which never change during a run: the polygon set
and the raster grid. On monthly means that waste was affordable — 9 variables
× 10 years × 12 months is 1,080 passes. On daily statistics it is not: 7
variables × 10 years × 365 days is 25,550 passes, which at admin-2 scale is
weeks of CPU.

So the coverage is computed **once** per ``(level, grid)`` and cached, both in
memory and on disk. Each subsequent raster is reduced with two
:func:`numpy.bincount` calls, which is milliseconds rather than minutes.

Reproducing exactextract's ``mean`` exactly
-------------------------------------------

The subtle part, and the reason this module has its own test file:
exactextract's ``mean`` **ignores masked cells and renormalises the coverage
fractions over the ones that remain**. ERA5 carries NaN over ocean for several
variables, so this is not a corner case — it decides the value of every
coastal polygon.

A naive ``weights @ values`` lets one NaN poison a whole polygon. A naive
``np.nan_to_num`` before the product is worse: it silently drags every coastal
polygon toward zero, which looks entirely plausible on a map and is wrong.

The correct reduction is therefore a *ratio of two* weighted sums, both taken
over the valid cells only::

    mean_p = Σ(w_i · x_i  over valid i in p) / Σ(w_i  over valid i in p)

which is what :meth:`CoverageMatrix.means` computes. A polygon whose cells are
all masked yields NaN, matching exactextract rather than yielding 0.
``test_coverage.py`` pins this against exact_extract itself, including the
all-masked case.

Grid normalisation
------------------

ERA5 ships longitude as 0..360. The old code wrapped it to -180..180 and
re-sorted per timestep; that reordering changes the raveled cell order, so the
weights and the values must be built against the *same* normalised layout.
:func:`normalise_raster` is the single place that happens, and it is applied
once per file rather than once per timestep.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from pathlib import Path

from wtg_pipeline.config import ensure_dir, intermediate_dir

log = logging.getLogger(__name__)


def _require_numpy():
    try:
        import numpy as np  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("numpy required; run `uv sync` in pipeline/.") from exc
    return np


def _require_exactextract():
    try:
        from exactextract import exact_extract  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("exactextract required; run `uv sync` in pipeline/.") from exc
    return exact_extract


def coverage_cache_dir(base_dir: Path | None = None) -> Path:
    root = base_dir if base_dir is not None else intermediate_dir() / "coverage"
    return ensure_dir(root)


def normalise_raster(da):
    """Put an ERA5 DataArray on the layout the coverage weights are built for.

    Wraps longitude from 0..360 to -180..180 and re-sorts, renames the ERA5
    dimension names to the ``x``/``y`` exactextract expects, and stamps
    EPSG:4326 so it can locate cells geographically.

    Safe to call on a 2D slice or on a full ``(time, latitude, longitude)``
    array — call it once per file, not once per timestep, because the sort is
    the expensive part.
    """
    import rioxarray  # noqa: F401  — registers the .rio accessor

    rast = da
    if "longitude" in rast.dims and float(rast["longitude"].max()) > 180.0:
        rast = rast.assign_coords(
            longitude=(((rast["longitude"] + 180) % 360) - 180)
        ).sortby("longitude")
    rename = {}
    if "longitude" in rast.dims:
        rename["longitude"] = "x"
    if "latitude" in rast.dims:
        rename["latitude"] = "y"
    if rename:
        rast = rast.rename(rename)
    return rast.rio.write_crs("EPSG:4326", inplace=False)


@dataclass(frozen=True)
class GridSpec:
    """Identity of the raster grid the weights were built against.

    ``digest`` covers the actual coordinate values, not just the shape, so a
    grid that happens to be the same size but differently positioned cannot
    silently reuse another grid's weights.
    """

    ny: int
    nx: int
    digest: str

    @classmethod
    def from_raster(cls, rast2d) -> "GridSpec":
        np = _require_numpy()
        y = np.asarray(rast2d["y"].values, dtype="float64")
        x = np.asarray(rast2d["x"].values, dtype="float64")
        h = hashlib.blake2b(digest_size=16)
        h.update(y.tobytes())
        h.update(b"|")
        h.update(x.tobytes())
        return cls(ny=int(y.size), nx=int(x.size), digest=h.hexdigest())

    @property
    def n_cells(self) -> int:
        return self.ny * self.nx


@dataclass(frozen=True)
class CoverageMatrix:
    """Sparse polygon×cell coverage, stored as three parallel flat arrays.

    ``poly_index[k]``, ``cell_index[k]`` and ``weight[k]`` describe one
    (polygon, cell) overlap. ``cell_index`` indexes into the *raveled*
    normalised raster, so reduction is a pair of ``bincount`` calls with no
    reshaping.

    Stored this way rather than as a scipy sparse matrix because scipy is not
    a dependency of this pipeline and ``bincount`` expresses the masked
    renormalisation more directly than a matrix product would.
    """

    polygon_ids: tuple[str, ...]
    poly_index: object  # np.ndarray[int64]
    cell_index: object  # np.ndarray[int64]
    weight: object      # np.ndarray[float64]
    grid: GridSpec

    @property
    def n_polygons(self) -> int:
        return len(self.polygon_ids)

    def means(self, values2d) -> object:
        """Area-weighted mean per polygon, ignoring masked cells.

        ``values2d`` must be on the normalised grid this matrix was built for.
        Returns a float64 array aligned to :attr:`polygon_ids`; a polygon whose
        cells are entirely masked yields NaN.
        """
        np = _require_numpy()
        flat = np.asarray(values2d, dtype="float64").ravel()
        if flat.size != self.grid.n_cells:
            raise ValueError(
                f"raster has {flat.size} cells but the coverage matrix was built "
                f"for {self.grid.n_cells} ({self.grid.ny}×{self.grid.nx}) — the "
                f"grid changed, or the raster was not passed through "
                f"normalise_raster()"
            )
        picked = flat[self.cell_index]
        valid = np.isfinite(picked)
        n = self.n_polygons
        numerator = np.bincount(
            self.poly_index,
            weights=np.where(valid, self.weight * picked, 0.0),
            minlength=n,
        )
        denominator = np.bincount(
            self.poly_index,
            weights=np.where(valid, self.weight, 0.0),
            minlength=n,
        )
        with np.errstate(invalid="ignore", divide="ignore"):
            return np.where(denominator > 0.0, numerator / denominator, np.nan)

    def means_by_id(self, values2d) -> dict[str, float]:
        """:meth:`means` as the ``{polygon_id: value}`` mapping callers expect."""
        values = self.means(values2d)
        return {pid: float(v) for pid, v in zip(self.polygon_ids, values)}


def polygon_digest(gdf, id_col: str) -> str:
    """Content hash of a polygon frame — identities *and* geometries.

    Both halves matter. Hashing only the ids would happily reuse weights after
    a boundary-vintage change that moved every border while keeping the codes;
    hashing only the geometry would miss a re-labelling that changes which row
    a weight belongs to.
    """
    np = _require_numpy()
    h = hashlib.blake2b(digest_size=16)
    ids = np.asarray([str(v) for v in gdf[id_col].to_numpy()], dtype=object)
    for value in ids:
        h.update(value.encode("utf-8"))
        h.update(b"\x00")
    h.update(b"|geom|")
    for wkb in gdf.geometry.to_wkb():
        h.update(hashlib.blake2b(wkb, digest_size=8).digest())
    return h.hexdigest()


def _cache_path(level: str, poly_digest: str, grid: GridSpec, base_dir: Path | None) -> Path:
    name = f"{level}_{poly_digest}_{grid.digest}_{grid.ny}x{grid.nx}.npz"
    return coverage_cache_dir(base_dir) / name


# One aggregation run opens ~70 files that all share a grid and a polygon set.
# The disk cache alone would decompress the same arrays 70 times; this keeps
# the built matrix for the life of the process. Keyed by the same name the
# disk cache uses, so it cannot collide across levels or grids.
_MEMO: dict[str, "CoverageMatrix"] = {}


def clear_memo() -> None:
    """Drop the in-process coverage cache. For tests and long-lived callers."""
    _MEMO.clear()


def build_coverage(
    *,
    level: str,
    gdf,
    id_col: str,
    template2d,
    base_dir: Path | None = None,
    use_cache: bool = True,
) -> CoverageMatrix:
    """Coverage weights for one (level, grid), from cache when possible.

    ``template2d`` is any single normalised timestep of the rasters that will
    be reduced — it is read for its grid only, never for its values.
    """
    np = _require_numpy()

    grid = GridSpec.from_raster(template2d)
    digest = polygon_digest(gdf, id_col)
    path = _cache_path(level, digest, grid, base_dir)

    if use_cache and str(path) in _MEMO:
        return _MEMO[str(path)]

    if use_cache and path.exists() and path.stat().st_size > 0:
        with np.load(path, allow_pickle=False) as data:
            log.info(
                "coverage cache hit: %s (%d polygons, %d pairs)",
                path.name,
                data["polygon_ids"].size,
                data["weight"].size,
            )
            cached = CoverageMatrix(
                polygon_ids=tuple(str(v) for v in data["polygon_ids"]),
                poly_index=data["poly_index"],
                cell_index=data["cell_index"],
                weight=data["weight"],
                grid=grid,
            )
        _MEMO[str(path)] = cached
        return cached

    exact_extract = _require_exactextract()
    log.info(
        "building coverage for %s: %d polygons over a %d×%d grid "
        "(one-off; every raster after this is a bincount)",
        level,
        len(gdf),
        grid.ny,
        grid.nx,
    )

    frame = exact_extract(
        rast=template2d,
        vec=gdf,
        ops=["cell_id", "coverage"],
        include_cols=[id_col],
        output="pandas",
    )

    polygon_ids: list[str] = []
    poly_chunks: list[object] = []
    cell_chunks: list[object] = []
    weight_chunks: list[object] = []

    for position, row in enumerate(frame.itertuples(index=False)):
        polygon_ids.append(str(getattr(row, id_col)))
        cells = np.asarray(row.cell_id, dtype="int64")
        weights = np.asarray(row.coverage, dtype="float64")
        if cells.size == 0:
            # A polygon smaller than a cell and falling entirely between cell
            # centres still has to occupy a row, or every polygon after it
            # shifts. It will reduce to NaN, which is the honest answer.
            continue
        poly_chunks.append(np.full(cells.size, position, dtype="int64"))
        cell_chunks.append(cells)
        weight_chunks.append(weights)

    if not poly_chunks:
        raise RuntimeError(
            f"no polygon in the {level} frame overlaps the raster grid — "
            f"check the boundary layer and the raster extent"
        )

    matrix = CoverageMatrix(
        polygon_ids=tuple(polygon_ids),
        poly_index=np.concatenate(poly_chunks),
        cell_index=np.concatenate(cell_chunks),
        weight=np.concatenate(weight_chunks),
        grid=grid,
    )

    if use_cache:
        # Written to a temp name and renamed, so a killed run cannot leave a
        # half-written cache that the next one would trust. Note savez appends
        # ".npz" to a *path* that lacks it — hence the open handle, which it
        # writes to verbatim.
        tmp = path.with_name(path.name + ".tmp")
        with tmp.open("wb") as handle:
            np.savez_compressed(
                handle,
                polygon_ids=np.asarray(matrix.polygon_ids, dtype="U"),
                poly_index=matrix.poly_index,
                cell_index=matrix.cell_index,
                weight=matrix.weight,
            )
        tmp.replace(path)
        log.info(
            "cached coverage → %s (%d pairs, %.1f MB)",
            path.name,
            matrix.weight.size,
            path.stat().st_size / 1e6,
        )
        _MEMO[str(path)] = matrix

    return matrix
