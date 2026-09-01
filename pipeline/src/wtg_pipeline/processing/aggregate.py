"""Polygon aggregation: ERA5 raster → mean per polygon per month per year.

For each of three administrative levels (country, admin-1, admin-2) and for
each ERA5 variable × (year, month), compute the area-weighted mean over
every polygon and write the result as Parquet.

Uses :mod:`exactextract` — the rule in ``pipeline/CLAUDE.md`` is that no
manual point-in-polygon loops are allowed; exactextract handles fractional
cell coverage correctly and is the fastest option on the CPU.

For country-level outputs, :mod:`country_rules` is applied: suppressed
countries emit no row, and the mainland whitelist filters admin-1 polygons
before the country mean is re-computed from the admin-1 area-weighted
aggregate.

Heavy deps (``xarray``, ``geopandas``, ``exactextract``) are imported
lazily so that tests and tooling that don't need the pipeline math don't
pay the import cost.
"""

from __future__ import annotations

import logging
import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Literal

from wtg_pipeline.config import ensure_dir, intermediate_dir
from wtg_pipeline.processing.country_rules import (
    admin1_contributes,
    is_suppressed,
)
from wtg_pipeline.processing.coverage import build_coverage, normalise_raster

log = logging.getLogger(__name__)

Level = Literal["country", "admin1", "admin2"]
LEVELS: tuple[Level, ...] = ("country", "admin1", "admin2")


@dataclass(frozen=True)
class PolygonFrame:
    """A GeoDataFrame-like payload of polygons for one administrative level.

    Wrapping geopandas keeps the import lazy and lets tests pass a stub.
    """

    level: Level
    # geopandas.GeoDataFrame at runtime; typed as object so the module can
    # be imported without geopandas installed.
    gdf: object
    iso_a2_col: str
    id_col: str
    name_col: str
    admin1_code_col: str | None = None


def _require_geopandas():
    try:
        import geopandas as gpd  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError(
            "geopandas is required for aggregation. Run `uv sync` in pipeline/."
        ) from exc
    return gpd


def _require_xarray():
    try:
        import xarray as xr  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("xarray required; run `uv sync` in pipeline/.") from exc
    return xr


def _require_numpy():
    try:
        import numpy as np  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("numpy required; run `uv sync` in pipeline/.") from exc
    return np


def _require_pandas():
    try:
        import pandas as pd  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("pandas required; run `uv sync` in pipeline/.") from exc
    return pd


def _require_pyarrow():
    try:
        import pyarrow as pa  # type: ignore[import-not-found]
        import pyarrow.parquet as pq  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("pyarrow required; run `uv sync` in pipeline/.") from exc
    return pa, pq


def aggregated_path(level: Level, base_dir: Path | None = None) -> Path:
    root = base_dir if base_dir is not None else intermediate_dir() / "aggregated"
    return ensure_dir(root) / f"{level}.parquet"


def parts_dir(level: Level, base_dir: Path | None = None) -> Path:
    """Directory holding one Parquet part per (variable, year).

    Aggregation writes here first and streams the parts into the combined
    Parquet afterwards, so peak memory is one variable-year rather than the
    whole level. It also makes a run resumable: at admin-2 scale a single pass
    is days long, and losing it to a crash on the last file is not acceptable.
    """
    return aggregated_path(level, base_dir=base_dir).with_suffix(".parts")


def _open_era5_dataset(nc_path: Path):
    """Open an ERA5 NetCDF, trying each available HDF5 binding in turn.

    ``xarray`` defaults to the ``netcdf4`` engine, whose compiled extension
    is not always loadable — it is absent in slim images and can be blocked
    outright by endpoint security policy on developer machines. ``h5netcdf``
    reads the same files through ``h5py``. Both are tried before giving up so
    a missing binding degrades into using the other one rather than failing
    the run.

    ``WTG_NETCDF_ENGINE`` pins a specific engine when a build needs to be
    reproducible against one binding.
    """
    xr = _require_xarray()
    pinned = os.environ.get("WTG_NETCDF_ENGINE")
    engines = [pinned] if pinned else ["netcdf4", "h5netcdf"]

    errors: list[str] = []
    for engine in engines:
        try:
            return xr.open_dataset(nc_path, engine=engine)
        except (ImportError, ValueError) as exc:
            errors.append(f"{engine}: {type(exc).__name__}: {exc}")
    raise RuntimeError(
        f"could not open {nc_path.name} with any NetCDF engine. Install "
        f"`netcdf4` or `h5netcdf`. Attempts:\n  " + "\n  ".join(errors)
    )


def _raster_from_netcdf(nc_path: Path, variable_code: str):
    """Open an ERA5 monthly-means NetCDF and return the DataArray.

    ERA5 monthly means come with dims (time, latitude, longitude). CDS may
    name the variable with either the short code (e.g. ``t2m``) or the long
    CF name; we prefer the short code but fall back to a single-variable
    heuristic.
    """
    ds = _open_era5_dataset(nc_path)
    if variable_code in ds.variables:
        da = ds[variable_code]
    else:
        data_vars = [v for v in ds.data_vars]
        if len(data_vars) != 1:
            ds.close()
            raise ValueError(
                f"{nc_path.name}: cannot pick variable; expected {variable_code!r}, "
                f"got {data_vars!r}"
            )
        da = ds[data_vars[0]]
    return da


def _polygon_attributes(
    polygons: PolygonFrame, order: tuple[str, ...]
) -> tuple[list[str], list[str]]:
    """ISO-2 and admin-1 code per polygon, aligned to ``order``.

    Resolved once per file rather than per polygon per timestep — scanning the
    frame inside the loop is quadratic, which is unnoticeable on a few dozen
    polygons and ruinous on the ~4,600 the 10m admin-1 layer carries, let alone
    49k at admin-2.
    """
    gdf = polygons.gdf
    iso_col = polygons.iso_a2_col
    id_col = polygons.id_col
    a1_col = polygons.admin1_code_col
    has_admin1_col = bool(a1_col) and a1_col in gdf.columns

    attributes: dict[str, tuple[str, str]] = {}
    for attr_row in gdf.itertuples(index=False):
        pid = str(getattr(attr_row, id_col))
        if pid in attributes:
            # Duplicate identities would silently overwrite each other's
            # climate downstream; the loaders are responsible for choosing a
            # unique id column, so surface the breach rather than absorb it.
            raise ValueError(
                f"duplicate polygon id {pid!r} in the {polygons.level} frame — "
                f"{id_col!r} is not unique"
            )
        iso_a2 = str(getattr(attr_row, iso_col, "") or "").upper()
        admin1_code = (
            str(getattr(attr_row, a1_col, "") or "") if has_admin1_col else ""
        )
        attributes[pid] = (iso_a2, admin1_code)

    iso = [attributes.get(pid, ("", ""))[0] for pid in order]
    admin1 = [attributes.get(pid, ("", ""))[1] for pid in order]
    return iso, admin1


def aggregate_variable_year(
    nc_path: Path,
    variable_code: str,
    polygons: PolygonFrame,
    *,
    coverage_base_dir: Path | None = None,
) -> "object":
    """Aggregate one (variable, year) file into per-polygon monthly means.

    Returns a pandas DataFrame with columns
    ``[polygon_id, iso_a2, admin1_code, year, month, variable, value]``.

    The polygon/raster overlap is computed **once** per (level, grid) and
    cached — see :mod:`wtg_pipeline.processing.coverage`. Each timestep is then
    a pair of ``bincount`` calls rather than a fresh exactextract pass, which
    is what makes daily statistics tractable at all: at one geometry pass per
    timestep, 25,550 daily rasters would be weeks of CPU.
    """
    pd = _require_pandas()
    np = _require_numpy()

    da = _raster_from_netcdf(nc_path, variable_code)
    # Once per file, not once per timestep — the longitude sort is the
    # expensive half and the layout must match the cached weights exactly.
    da = normalise_raster(da)

    # ERA5 time coord may be named "time" or "valid_time".
    time_name = "time" if "time" in da.dims else "valid_time"

    matrix = build_coverage(
        level=polygons.level,
        gdf=polygons.gdf,
        id_col=polygons.id_col,
        template2d=da.isel({time_name: 0}),
        base_dir=coverage_base_dir,
    )
    iso, admin1 = _polygon_attributes(polygons, matrix.polygon_ids)

    times = da[time_name].values
    n_times = len(times)
    n_poly = matrix.n_polygons

    values = np.empty(n_times * n_poly, dtype="float64")
    years = np.empty(n_times * n_poly, dtype="int64")
    months = np.empty(n_times * n_poly, dtype="int64")

    for index, t in enumerate(times):
        ts = pd.Timestamp(t)
        start = index * n_poly
        stop = start + n_poly
        values[start:stop] = matrix.means(da.isel({time_name: index}).values)
        years[start:stop] = int(ts.year)
        months[start:stop] = int(ts.month)

    da.close()

    # Built column-wise from arrays rather than row-wise from dicts: a daily
    # variable-year at admin-1 is 1.7M rows, where the per-dict overhead alone
    # would be several hundred megabytes.
    return pd.DataFrame(
        {
            "polygon_id": np.tile(np.asarray(matrix.polygon_ids, dtype=object), n_times),
            "iso_a2": np.tile(np.asarray(iso, dtype=object), n_times),
            "admin1_code": np.tile(np.asarray(admin1, dtype=object), n_times),
            "year": years,
            "month": months,
            "variable": variable_code,
            "value": values,
        }
    )


def aggregate_level(
    *,
    level: Level,
    polygons: PolygonFrame,
    netcdf_dir: Path,
    variable_codes: Iterable[str],
    years: Iterable[int],
    force: bool = False,
    base_dir: Path | None = None,
) -> Path:
    """Aggregate every (variable, year) file for one admin level and write Parquet.

    Each (variable, year) is written to its own part under :func:`parts_dir`
    and the parts are streamed into the combined Parquet at the end, so peak
    memory is a single variable-year instead of the whole level. At admin-2
    scale the difference is decisive: 49k polygons over 90 variable-years is
    ~53 million rows, which does not fit in this server's RAM as one frame.

    Caching, in precedence order:

    * ``force=True`` — discard any existing parts and recompute everything.
      Required whenever the *inputs* change (boundary vintage, polygon
      identity), because a part is keyed only by variable and year and cannot
      tell that the polygons underneath it moved.
    * output already present — cache hit, returned untouched.
    * output absent but parts present — resume, skipping completed parts.
      This is the crash-recovery path for multi-day runs.
    """
    out_path = aggregated_path(level, base_dir=base_dir)
    if not force and out_path.exists() and out_path.stat().st_size > 0:
        log.info("cache hit: %s", out_path.name)
        return out_path

    parts = parts_dir(level, base_dir=base_dir)
    if force and parts.exists():
        # A stale part is indistinguishable from a fresh one, so `--force`
        # has to clear them or it would quietly aggregate over old polygons.
        shutil.rmtree(parts)
        log.info("force: cleared %s", parts.name)
    parts.mkdir(parents=True, exist_ok=True)

    var_list = list(variable_codes)
    year_list = list(years)
    total = len(var_list) * len(year_list)
    written: list[Path] = []
    idx = 0
    for variable in var_list:
        for year in year_list:
            idx += 1
            part_path = parts / f"{variable}_{year}.parquet"
            if part_path.exists() and part_path.stat().st_size > 0:
                log.info("[%d/%d] resume: %s already done", idx, total, part_path.name)
                written.append(part_path)
                continue

            nc_path = netcdf_dir / f"{variable}_{year}.nc"
            if not nc_path.exists():
                log.warning("missing %s; skipping", nc_path)
                continue

            log.info("[%d/%d] aggregating %s %d → %s", idx, total, variable, year, level)
            df = aggregate_variable_year(nc_path, variable, polygons)
            # Write to a temp name first: a part is treated as complete purely
            # because it exists, so a half-written file would poison a resume.
            tmp_path = part_path.with_suffix(".parquet.tmp")
            df.to_parquet(tmp_path, index=False)
            tmp_path.replace(part_path)
            log.info("[%d/%d] wrote %s (%d rows)", idx, total, part_path.name, len(df))
            del df
            written.append(part_path)

    if not written:
        raise RuntimeError(f"no NetCDF inputs matched for level={level!r}")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    rows = combine_parts(written, out_path)
    log.info("wrote %s (%d rows from %d parts)", out_path, rows, len(written))
    shutil.rmtree(parts, ignore_errors=True)
    return out_path


def combine_parts(parts: list[Path], out_path: Path) -> int:
    """Stream Parquet parts into one file without materialising them all.

    Returns the total row count. Uses a single writer over row-group batches,
    so memory stays at one batch regardless of how much total data there is.
    """
    pa, pq = _require_pyarrow()

    writer = None
    rows = 0
    tmp_out = out_path.with_suffix(".parquet.tmp")
    try:
        for part in parts:
            parquet_file = pq.ParquetFile(part)
            for batch in parquet_file.iter_batches(batch_size=250_000):
                table = pa.Table.from_batches([batch])
                if writer is None:
                    writer = pq.ParquetWriter(tmp_out, table.schema)
                else:
                    # Parts are produced by one code path so the schema is
                    # stable, but Arrow can pick a different string width per
                    # file; align rather than fail the whole run at the end.
                    table = table.cast(writer.schema)
                writer.write_table(table)
                rows += batch.num_rows
    finally:
        if writer is not None:
            writer.close()

    if writer is None:
        raise RuntimeError(f"no rows found across {len(parts)} part file(s)")
    tmp_out.replace(out_path)
    return rows


def apply_country_rules(admin1_df: "object", country_df: "object") -> "object":
    """Rebuild country-level aggregates from admin-1 subject to country rules.

    Args:
        admin1_df: pandas DataFrame with columns
            ``[polygon_id, iso_a2, admin1_code, year, month, variable, value]``
            for the admin-1 level.
        country_df: country-level DataFrame produced by naive aggregation —
            used only as a source of ISO-2 codes not present in admin1_df.

    Returns:
        A new country-level DataFrame where:
          * suppressed countries (:data:`SUPPRESSED_COUNTRIES`) are dropped;
          * countries with a :data:`MAINLAND_WHITELIST` entry are recomputed
            as the simple mean across the whitelisted admin-1 polygons
            (area-weighting here is not re-applied — the admin-1 polygons
            already carry area-weighted means; this is a first-order fix
            that is good enough for all current whitelisted countries since
            their mainland admin-1 polygons are similar in order-of-area).
    """
    pd = _require_pandas()

    kept = country_df[~country_df["iso_a2"].apply(is_suppressed)].copy()
    isos_needing_recompute = {
        iso for iso in kept["iso_a2"].unique() if iso in _whitelist_countries()
    }
    if not isos_needing_recompute:
        return kept

    # Drop rows for whitelisted countries that came from naive country
    # aggregation; recompute from admin-1.
    kept = kept[~kept["iso_a2"].isin(isos_needing_recompute)]

    # A recomputed row has to keep the *country layer's* polygon id, which is
    # not the ISO-2 code — downstream, `build_feature_collection` joins
    # percentiles to geometry on that id, so a recomputed country carrying the
    # wrong id silently loses all of its climate and drops out of the tiles.
    polygon_id_by_iso = (
        country_df.drop_duplicates("iso_a2")
        .set_index("iso_a2")["polygon_id"]
        .to_dict()
    )

    recomputed: list[object] = []
    fallback_isos: list[str] = []
    for iso in isos_needing_recompute:
        country_admin1 = admin1_df[admin1_df["iso_a2"] == iso]
        if country_admin1.empty:
            # Admin-1 data is missing entirely (e.g. NE 50m only ships
            # subdivisions for the largest countries). Fall back to the
            # naive country aggregate rather than dropping — its bias is
            # bounded by the size of the overseas territories and typically
            # smaller than dropping the country altogether.
            log.warning(
                "no admin-1 rows for %s; falling back to naive country aggregate",
                iso,
            )
            fallback_isos.append(iso)
            continue
        mask = country_admin1.apply(
            lambda r: admin1_contributes(r["iso_a2"], str(r["admin1_code"])),
            axis=1,
        )
        filtered = country_admin1[mask]
        if filtered.empty:
            log.warning(
                "all admin-1 polygons filtered out for %s; falling back to naive aggregate",
                iso,
            )
            fallback_isos.append(iso)
            continue
        grouped = (
            filtered.groupby(["iso_a2", "year", "month", "variable"], as_index=False)[
                "value"
            ].mean()
        )
        grouped["polygon_id"] = polygon_id_by_iso.get(iso, iso)
        grouped["admin1_code"] = ""
        recomputed.append(grouped)

    if fallback_isos:
        # Re-introduce the naive country rows for these ISOs.
        fallback = country_df[country_df["iso_a2"].isin(fallback_isos)].copy()
        recomputed.append(fallback)

    if recomputed:
        result = pd.concat([kept, *recomputed], ignore_index=True)
    else:
        result = kept
    return result


def _whitelist_countries() -> frozenset[str]:
    from wtg_pipeline.processing.country_rules import MAINLAND_WHITELIST

    return frozenset(MAINLAND_WHITELIST.keys())
