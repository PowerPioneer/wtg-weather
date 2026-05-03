"""Stitch polygon geometries together with percentiles + default scores.

Inputs:
  * the boundary GeoDataFrames (country / admin1 / admin2),
  * the percentiles Parquet per level from :mod:`processing.percentiles`,
  * the post-country-rules admin-1 mean that substitutes for country
    polygons whose country is on the suppression list (so a suppressed
    country's country-level row is dropped but its admin-1 polygons carry
    the country label at country zoom — rendered as a mosaic by the web).

Outputs: one GeoJSON FeatureCollection per tier.

Feature property schema (one per polygon)::

    {
        "id": "...",
        "iso_a2": "PE",
        "admin1_code": "PE-CUS" | "",
        "name": "Cusco",
        "level": "admin1",
        "t2m_p50_01": 12.3, "t2m_p50_02": 12.5, ..., "t2m_p50_12": 11.8,
        "tp_p50_01": 150.0, ...,
        "sun_hours_p50_01": 6.5, ...,
        "score_01": 2, "score_02": 2, ..., "score_12": 3,
    }

Free tier keeps temperature, precipitation, sunshine (core three). Premium
adds wind, snow, SST, humidity, plus admin-2 level.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from wtg_pipeline.config import ensure_dir, final_dir
from wtg_pipeline.processing.scoring import (
    DEFAULT_PREFERENCES,
    polygon_score,
)

log = logging.getLogger(__name__)

Tier = Literal["free", "premium"]
Level = Literal["country", "admin1", "admin2"]

FREE_VARIABLES: tuple[str, ...] = ("t2m", "tp", "sun_hours")
PREMIUM_VARIABLES: tuple[str, ...] = (
    "t2m",
    "tp",
    "sun_hours",
    "si10",  # wind speed
    "sd",  # snow depth
    "sst",  # sea surface temp
    "rh",  # relative humidity
)

# Short property aliases consumed by the web's display-mode catalog
# (see web/src/lib/display-modes.ts — `prop` field). The pipeline emits
# `<variable>_p50_<mm>` for analytical use AND `<alias>_<mm>` for the map
# paint expressions. Keep both in sync if a new mode ships on the web.
WEB_PROP_ALIAS: dict[str, str] = {
    "t2m": "t",
    "tp": "r",
    "sun_hours": "s",
    "si10": "w",
    "sd": "snow",
    "sst": "sst",
    "rh": "hum",
}

# Pipeline `polygon_score` returns 0..3; the web's preferences mode bins on a
# 0..100 scale (see web/src/lib/scoring.ts SCORE_BINS). These centroids place
# each bucket squarely inside the corresponding web bin (avoid <50, acceptable
# 50-69, good 70-84, perfect ≥85).
SCORE_TO_PREF: dict[int, int] = {0: 25, 1: 60, 2: 75, 3: 90}


def variables_for_tier(tier: Tier) -> tuple[str, ...]:
    if tier == "free":
        return FREE_VARIABLES
    if tier == "premium":
        return PREMIUM_VARIABLES
    raise ValueError(f"unknown tier: {tier!r}")


def geojson_path(tier: Tier, level: Level, base_dir: Path | None = None) -> Path:
    root = base_dir if base_dir is not None else final_dir()
    return ensure_dir(root) / f"{level}_{tier}.geojson"


@dataclass(frozen=True)
class BuildInput:
    level: Level
    polygons_gdf: object  # geopandas.GeoDataFrame
    id_col: str
    iso_a2_col: str
    name_col: str
    admin1_code_col: str | None
    percentiles_df: object  # pandas.DataFrame


def _require_pandas_and_gpd():
    try:
        import pandas as pd  # type: ignore[import-not-found]
        import geopandas as gpd  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("pandas/geopandas required; run `uv sync`.") from exc
    return pd, gpd


def _score_row(values_by_var: dict[str, float]) -> int:
    # Cast to the right key alias the scoring module expects.
    return polygon_score(values_by_var, DEFAULT_PREFERENCES)  # type: ignore[arg-type]


def _widen_percentiles_for_polygon(
    poly_percentiles: "object", variables: tuple[str, ...]
) -> dict[str, float]:
    """Turn long-format percentiles for one polygon into the flat props dict.

    Output keys follow the ``{variable}_{stat}_{mm}`` pattern for p10/p50/p90.
    Additionally, the p50 is mirrored under the short alias `<alias>_<mm>`
    that the web's map paint expressions read directly.
    """
    props: dict[str, float] = {}
    for row in poly_percentiles.itertuples(index=False):
        var = row.variable
        if var not in variables:
            continue
        month_str = f"{int(row.month):02d}"
        for stat in ("p10", "p50", "p90"):
            value = getattr(row, stat, None)
            if value is None or value != value:  # NaN check
                continue
            props[f"{var}_{stat}_{month_str}"] = float(value)
        p50 = getattr(row, "p50", None)
        if p50 is not None and p50 == p50:
            alias = WEB_PROP_ALIAS.get(var)
            if alias is not None:
                props[f"{alias}_{month_str}"] = float(p50)
    return props


def build_feature_collection(
    build_input: BuildInput,
    *,
    tier: Tier,
    exclude_iso2: set[str] | None = None,
) -> dict:
    """Return a GeoJSON FeatureCollection dict for one (tier, level)."""
    pd, _gpd = _require_pandas_and_gpd()
    variables = variables_for_tier(tier)
    exclude = exclude_iso2 or set()

    gdf = build_input.polygons_gdf
    id_col = build_input.id_col
    iso_col = build_input.iso_a2_col
    name_col = build_input.name_col
    a1_col = build_input.admin1_code_col

    perc = build_input.percentiles_df
    perc_by_polygon: dict[str, "object"] = {
        str(pid): group for pid, group in perc.groupby("polygon_id")
    }

    features: list[dict] = []
    for row in gdf.itertuples(index=False):
        pid = str(getattr(row, id_col))
        iso_a2 = str(getattr(row, iso_col, "") or "").upper()
        if iso_a2 in exclude:
            continue
        name = str(getattr(row, name_col, "") or "")
        admin1_code = str(getattr(row, a1_col, "") or "") if a1_col else ""

        poly_perc = perc_by_polygon.get(pid)
        if poly_perc is None or len(poly_perc) == 0:
            # No climate data — skip to keep tiles tight.
            continue

        props: dict[str, object] = {
            "id": pid,
            "iso_a2": iso_a2,
            "admin1_code": admin1_code,
            "name": name,
            "level": build_input.level,
        }
        props.update(_widen_percentiles_for_polygon(poly_perc, variables))

        # Per-month default score driven by p50 of the tier's variables.
        by_month: dict[int, dict[str, float]] = {}
        for r in poly_perc.itertuples(index=False):
            v = r.variable
            if v not in variables:
                continue
            month = int(r.month)
            p50 = getattr(r, "p50", None)
            if p50 is None or p50 != p50:
                continue
            by_month.setdefault(month, {})[v] = float(p50)
        for month in range(1, 13):
            values = by_month.get(month, {})
            score = _score_row(values)
            props[f"score_{month:02d}"] = score
            # `pref_<mm>` is what the web's `preferences` display mode reads;
            # rebase the 0..3 bucket onto the 0..100 web score scale.
            props[f"pref_{month:02d}"] = SCORE_TO_PREF[score]

        geometry = getattr(row, "geometry", None)
        if geometry is None:
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": geometry.__geo_interface__,
                "properties": props,
            }
        )

    return {"type": "FeatureCollection", "features": features}


def write_feature_collection(fc: dict, path: Path) -> Path:
    import json

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(fc), encoding="utf-8")
    log.info("wrote %s (%d features)", path, len(fc.get("features", [])))
    return path
