"""Per-polygon 10/50/90 percentiles across a rolling 10-year window.

Input: the aggregated Parquet from :mod:`aggregate` — one value per
(polygon, year, month, variable).

Output: Parquet with columns
``[polygon_id, iso_a2, admin1_code, month, variable, p10, p50, p90, n_years]``.

The p50 is the long-run climatological "typical" value; p10/p90 bound the
normal variability. n_years is retained so the downstream confidence layer
can mark polygons with thin samples.
"""

from __future__ import annotations

import logging
from pathlib import Path

from wtg_pipeline.config import ensure_dir, intermediate_dir

log = logging.getLogger(__name__)


def percentiles_path(level: str, base_dir: Path | None = None) -> Path:
    root = base_dir if base_dir is not None else intermediate_dir() / "percentiles"
    return ensure_dir(root) / f"{level}.parquet"


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


def compute_percentiles(aggregated_df: "object") -> "object":
    """Compute p10/p50/p90 per (polygon, month, variable) across all years.

    NaN years are dropped before percentile calc; n_years reflects the
    surviving count. Uses numpy's linear interpolation.
    """
    pd = _require_pandas()
    np = _require_numpy()

    def _q(series: "object") -> "object":
        arr = np.asarray(series.dropna(), dtype=float)
        if arr.size == 0:
            return pd.Series({"p10": np.nan, "p50": np.nan, "p90": np.nan, "n_years": 0})
        p10, p50, p90 = np.percentile(arr, [10, 50, 90])
        return pd.Series({"p10": float(p10), "p50": float(p50), "p90": float(p90), "n_years": int(arr.size)})

    grouped = aggregated_df.groupby(
        ["polygon_id", "iso_a2", "admin1_code", "month", "variable"],
        dropna=False,
    )["value"].apply(_q)
    return grouped.unstack().reset_index()


def build_percentiles(
    *,
    level: str,
    aggregated_parquet: Path,
    force: bool = False,
    base_dir: Path | None = None,
) -> Path:
    """Read the aggregated Parquet and write the percentiles Parquet."""
    pd = _require_pandas()
    out = percentiles_path(level, base_dir=base_dir)
    if not force and out.exists() and out.stat().st_size > 0:
        log.info("cache hit: %s", out.name)
        return out

    log.info("computing percentiles for %s from %s", level, aggregated_parquet.name)
    df = pd.read_parquet(aggregated_parquet)
    result = compute_percentiles(df)
    out.parent.mkdir(parents=True, exist_ok=True)
    result.to_parquet(out, index=False)
    log.info("wrote %s (%d rows)", out, len(result))
    return out
