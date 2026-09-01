"""Per-polygon climate statistics across the ten-year window.

Two shapes, because the inputs differ and so do the questions they answer.

Monthly (the original)
----------------------

Input is one value per (polygon, year, month). Output is ``p10/p50/p90`` across
the ten annual samples — *interannual* variability, i.e. "how much does January
2019 differ from January 2023?".

That is a real quantity but it is not the one the product needs, and it was
being presented as one that it is not: the country pages published ``t2m_p10``
and ``t2m_p90`` as ``tMin``/``tMax`` and printed them as a bare "15.8 – 28.4 °C"
temperature range, which every reader takes for a daily high and low. It is
also narrow by construction — averaging over a month destroys nearly all the
variance, leaving 2–4 °C — so the chart band looked broken.

Daily (what the rebuild uses)
-----------------------------

Input is one value per (polygon, year, month, day). Output per (polygon, month,
variable) is ``mean``, ``p50``, ``p5``, ``p95``, ``n_days`` and ``n_years``,
where the percentiles are taken over **days pooled across the whole window** —
roughly 300 samples for a 30-day month over ten years, rather than ten.

The distinction matters more than it sounds. p5/p95 of ten annual means is
effectively the min and max of ten numbers: it moves month to month for no
physical reason. Over ~300 daily samples it is a statistic.

Two derived counts ride along, because both are thresholds on *daily* values
and so cannot be recovered from percentiles afterwards:

* ``wet_days`` — mean days per month at or above the WMO's 1.0 mm;
* ``sunny_days`` — mean days per month reaching 70 % of possible daylight.

``sunny_days`` needs each polygon's latitude, which is why aggregation now
writes a latitude sidecar next to its Parquet.

Units
-----

Everything stays in ERA5 SI here, exactly as before; ``build_geojson`` converts
on the way out. The one exception is ``sun_hours``, which is *derived* rather
than converted: sunshine is a non-linear function of SSRD, so the mean of the
converted daily values is not the conversion of the mean. It is therefore
computed per day and reduced here, and emitted as its own variable.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Mapping

from wtg_pipeline.config import ensure_dir, intermediate_dir
from wtg_pipeline.processing.sunshine import (
    SUNNY_DAY_FRACTION,
    WET_DAY_MM,
    day_length_hours,
    sunshine_hours_for_day,
)

log = logging.getLogger(__name__)

#: Columns the daily output carries. `p10`/`p90` are gone: nothing reads them
#: any more and keeping them would invite a consumer to treat a within-month
#: spread as the interannual one it used to be.
DAILY_COLUMNS = (
    "polygon_id", "iso_a2", "admin1_code", "month", "variable",
    "mean", "p50", "p5", "p95", "n_days", "n_years",
)

#: Source variable → the variable name emitted for its derived daily count.
COUNT_VARIABLES = {"tp_sum": "wet_days", "ssrd_sum": "sunny_days"}

#: SSRD is consumed to produce sun_hours and the sunny-day count; the raw
#: joule figure is of no use to any consumer.
DERIVED_FROM_SSRD = "sun_hours"

#: ERA5 ships precipitation as a depth in metres.
WET_DAY_METRES = WET_DAY_MM / 1000.0


def percentiles_path(level: str, base_dir: Path | None = None) -> Path:
    root = base_dir if base_dir is not None else intermediate_dir() / "percentiles"
    return ensure_dir(root) / f"{level}.parquet"


def latitudes_path(level: str, base_dir: Path | None = None) -> Path:
    """Sidecar mapping polygon_id → representative latitude.

    Written by aggregation, which already holds the boundary frames. Loading
    them again here would mean paying for the admin-2 read twice, which
    `_load_boundary_frames` goes out of its way to avoid.
    """
    root = base_dir if base_dir is not None else intermediate_dir() / "aggregated"
    return ensure_dir(root) / f"{level}_latitudes.json"


def load_latitudes(level: str, base_dir: Path | None = None) -> dict[str, float]:
    path = latitudes_path(level, base_dir=base_dir)
    if not path.exists():
        return {}
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        log.warning("could not read %s; sunny-day counts will be skipped", path.name)
        return {}
    return {str(k): float(v) for k, v in loaded.items()}


def _require_pandas():
    try:
        import pandas as pd  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("pandas required; run `uv sync`.") from exc
    return pd


def _require_numpy():
    try:
        import numpy as np  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("numpy required; run `uv sync`.") from exc
    return np


def _require_pyarrow():
    try:
        import pyarrow as pa  # type: ignore[import-not-found]
        import pyarrow.parquet as pq  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("pyarrow required; run `uv sync`.") from exc
    return pa, pq


# ── Monthly (unchanged behaviour) ────────────────────────────────────


def compute_percentiles(aggregated_df: "object") -> "object":
    """Interannual p10/p50/p90 per (polygon, month, variable).

    Kept for the monthly-means path. NaN years are dropped before the
    percentile calc; n_years reflects the surviving count.
    """
    pd = _require_pandas()
    np = _require_numpy()

    def _q(series: "object") -> "object":
        arr = np.asarray(series.dropna(), dtype=float)
        if arr.size == 0:
            return pd.Series({"p10": np.nan, "p50": np.nan, "p90": np.nan, "n_years": 0})
        p10, p50, p90 = np.percentile(arr, [10, 50, 90])
        return pd.Series(
            {"p10": float(p10), "p50": float(p50), "p90": float(p90), "n_years": int(arr.size)}
        )

    grouped = aggregated_df.groupby(
        ["polygon_id", "iso_a2", "admin1_code", "month", "variable"],
        dropna=False,
    )["value"].apply(_q)
    return grouped.unstack().reset_index()


# ── Daily ────────────────────────────────────────────────────────────


def compute_daily_statistics(
    daily_df: "object",
    *,
    variable: str,
    latitudes: Mapping[str, float] | None = None,
) -> "object":
    """Within-month statistics for one variable of a daily aggregate.

    Returns a frame with :data:`DAILY_COLUMNS`, possibly for more than one
    emitted variable: ``ssrd_sum`` yields both ``sun_hours`` and
    ``sunny_days``, and ``tp_sum`` yields ``tp_sum`` and ``wet_days``.
    """
    pd = _require_pandas()
    np = _require_numpy()

    if "day" not in daily_df.columns:
        raise ValueError(
            f"{variable!r} has no `day` column — this is a monthly aggregate. "
            f"Use compute_percentiles, or re-run aggregation with daily=True."
        )

    frame = daily_df.dropna(subset=["value"]).copy()
    if frame.empty:
        return pd.DataFrame(columns=list(DAILY_COLUMNS))

    emitted = DERIVED_FROM_SSRD if variable == "ssrd_sum" else variable
    outputs = []

    if variable == "ssrd_sum":
        # Sunshine is non-linear in SSRD, so it has to be derived per day and
        # reduced afterwards — converting the reduced value would be wrong.
        lat_by_id = dict(latitudes or {})
        if not lat_by_id:
            log.warning(
                "no latitudes available; sunshine cannot be derived for %s", variable
            )
            return pd.DataFrame(columns=list(DAILY_COLUMNS))

        doy = _day_of_year(frame, pd)
        lats = frame["polygon_id"].map(lat_by_id)
        known = lats.notna()
        if not known.all():
            log.warning(
                "%d/%d daily rows have no latitude; dropped from sunshine",
                int((~known).sum()), len(frame),
            )
        frame = frame[known].copy()
        doy = doy[known]
        lats = lats[known]

        frame["value"] = [
            sunshine_hours_for_day(v, latitude_deg=la, day_of_year=int(d))
            for v, la, d in zip(frame["value"], lats, doy)
        ]
        frame["_daylight"] = [
            day_length_hours(la, int(d)) for la, d in zip(lats, doy)
        ]
        frame["_flag"] = (
            frame["_daylight"] > 0
        ) & (frame["value"] >= SUNNY_DAY_FRACTION * frame["_daylight"])
    elif variable == "tp_sum":
        frame["_flag"] = frame["value"] >= WET_DAY_METRES

    outputs.append(_reduce(frame, emitted, pd, np))

    count_name = COUNT_VARIABLES.get(variable)
    if count_name is not None and "_flag" in frame.columns:
        outputs.append(_reduce_count(frame, count_name, pd, np))

    return pd.concat(outputs, ignore_index=True)


def _day_of_year(frame, pd):
    """Day-of-year from the (year, month, day) triple."""
    return pd.to_datetime(
        dict(year=frame["year"], month=frame["month"], day=frame["day"]),
        errors="coerce",
    ).dt.dayofyear


def _reduce(frame, emitted: str, pd, np):
    keys = ["polygon_id", "iso_a2", "admin1_code", "month"]
    grouped = frame.groupby(keys, dropna=False)

    stats = grouped["value"].agg(
        mean="mean",
        p50=lambda s: float(np.percentile(s, 50)) if len(s) else np.nan,
        p5=lambda s: float(np.percentile(s, 5)) if len(s) else np.nan,
        p95=lambda s: float(np.percentile(s, 95)) if len(s) else np.nan,
        n_days="size",
    )
    stats["n_years"] = grouped["year"].nunique()
    stats = stats.reset_index()
    stats["variable"] = emitted
    return stats[list(DAILY_COLUMNS)]


def _reduce_count(frame, count_name: str, pd, np):
    """Mean number of flagged days per month, averaged over the years.

    Per *year* first, then averaged — so a month present in eight years and a
    month present in ten are on the same scale, and a partially-downloaded
    year cannot inflate a count.
    """
    per_year = (
        frame.groupby(["polygon_id", "iso_a2", "admin1_code", "month", "year"],
                      dropna=False)["_flag"]
        .sum()
        .reset_index()
    )
    keys = ["polygon_id", "iso_a2", "admin1_code", "month"]
    grouped = per_year.groupby(keys, dropna=False)

    stats = grouped["_flag"].agg(
        mean="mean",
        p50=lambda s: float(np.percentile(s, 50)) if len(s) else np.nan,
        p5=lambda s: float(np.percentile(s, 5)) if len(s) else np.nan,
        p95=lambda s: float(np.percentile(s, 95)) if len(s) else np.nan,
    )
    stats["n_years"] = grouped["year"].nunique()
    stats["n_days"] = (
        frame.groupby(keys, dropna=False)["value"].size().reindex(stats.index)
    )
    stats = stats.reset_index()
    stats["variable"] = count_name
    return stats[list(DAILY_COLUMNS)]


# ── Driver ───────────────────────────────────────────────────────────


def build_percentiles(
    *,
    level: str,
    aggregated_parquet: Path,
    force: bool = False,
    base_dir: Path | None = None,
    daily: bool | None = None,
    latitudes: Mapping[str, float] | None = None,
) -> Path:
    """Read the aggregated Parquet and write the statistics Parquet.

    ``daily`` is detected from the input rather than declared: a daily
    aggregate carries a ``day`` column and a monthly one does not. Passing the
    wrong flag would either crash or, worse, compute an interannual band and
    label it a within-month one — so the input decides, and the flag is only
    for forcing the issue in a test.
    """
    pd = _require_pandas()
    out = percentiles_path(level, base_dir=base_dir)
    if not force and out.exists() and out.stat().st_size > 0:
        log.info("cache hit: %s", out.name)
        return out

    if daily is None:
        daily = _has_day_column(aggregated_parquet)

    if daily and latitudes is None:
        latitudes = load_latitudes(level)

    out.parent.mkdir(parents=True, exist_ok=True)
    log.info(
        "computing %s statistics for %s from %s",
        "daily within-month" if daily else "interannual",
        level,
        aggregated_parquet.name,
    )

    # Percentile groups are keyed by (polygon, month, variable), so no group
    # ever spans two variables — the work splits cleanly one variable at a
    # time. Reading the whole aggregate at once is what this avoids: at
    # admin-2 scale it is ~53 million rows monthly and far more daily.
    variables = _distinct_variables(aggregated_parquet)
    log.info("  %d variable(s) to process one at a time", len(variables))

    pa, pq = _require_pyarrow()
    writer = None
    rows = 0
    tmp_out = out.with_suffix(".parquet.tmp")
    try:
        for index, variable in enumerate(variables, start=1):
            chunk = pd.read_parquet(
                aggregated_parquet, filters=[("variable", "==", variable)]
            )
            if chunk.empty:
                continue
            if daily:
                result = compute_daily_statistics(
                    chunk, variable=variable, latitudes=latitudes
                )
            else:
                result = compute_percentiles(chunk)
            del chunk
            if result.empty:
                continue
            table = pa.Table.from_pandas(result, preserve_index=False)
            if writer is None:
                writer = pq.ParquetWriter(tmp_out, table.schema)
            else:
                table = table.cast(writer.schema)
            writer.write_table(table)
            rows += len(result)
            log.info(
                "  [%d/%d] %s → %d rows (%d total)",
                index, len(variables), variable, len(result), rows,
            )
            del result
    finally:
        if writer is not None:
            writer.close()

    if writer is None:
        raise RuntimeError(f"no rows in {aggregated_parquet}")
    tmp_out.replace(out)
    log.info("wrote %s (%d rows)", out, rows)
    return out


def _has_day_column(aggregated_parquet: Path) -> bool:
    """Whether the aggregate is daily, read from the schema alone."""
    _pa, pq = _require_pyarrow()
    return "day" in pq.ParquetFile(aggregated_parquet).schema_arrow.names


def _distinct_variables(aggregated_parquet: Path) -> list[str]:
    """Variable codes present in the aggregate, read without loading values."""
    _pa, pq = _require_pyarrow()
    column = pq.read_table(aggregated_parquet, columns=["variable"])["variable"]
    return sorted({str(v) for v in column.to_pylist() if v is not None})
