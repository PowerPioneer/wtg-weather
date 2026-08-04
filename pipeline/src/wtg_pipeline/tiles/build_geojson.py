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

Units
-----

The percentiles Parquet carries **raw ERA5 SI units** (Kelvin, m/day, m/s,
m). Everything this module emits is in the display units the web's legend
stops and the default preference ranges assume — see
:mod:`wtg_pipeline.processing.units`. Converting here rather than during
aggregation is deliberate: every conversion is linear or monotonic, so it
commutes with the mean/percentile steps upstream and the expensive cached
aggregates stay valid when the conversions change.

Three emitted variables are derived rather than aggregated: ``sun_hours``
from ``ssrd``, ``rh`` from ``t2m`` + ``d2m``, and ``heat`` from ``t2m`` +
``rh``. Their ERA5 inputs are read but not themselves emitted.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Literal

from wtg_pipeline.config import ensure_dir, final_dir
from wtg_pipeline.processing.scoring import (
    DEFAULT_PREFERENCES,
    polygon_score,
)
from wtg_pipeline.processing.sunshine import sunshine_hours_from_ssrd
from wtg_pipeline.processing.units import (
    heat_index_c,
    kelvin_to_celsius,
    m_per_day_to_mm_per_day,
    m_s_to_km_h,
    m_to_cm,
    relative_humidity_pct,
)

log = logging.getLogger(__name__)

Tier = Literal["free", "premium"]
Level = Literal["country", "admin1", "admin2"]

# Variables *emitted* per tier, in display units. `sun_hours`, `rh` and
# `heat` are derived (see SOURCE_VARIABLES for what has to be read to
# produce them).
FREE_VARIABLES: tuple[str, ...] = ("t2m", "tp", "sun_hours")
PREMIUM_VARIABLES: tuple[str, ...] = (
    "t2m",
    "tp",
    "sun_hours",
    "si10",  # wind speed
    "sd",  # snow depth
    "sst",  # sea surface temp
    "rh",  # relative humidity (derived from t2m + d2m)
    "heat",  # heat index (derived from t2m + rh)
)

# Raw ERA5 variable codes that must be read out of the percentiles frame to
# produce the emitted set above. `ssrd` and `d2m` are inputs only — they are
# never written to the tiles.
FREE_SOURCE_VARIABLES: tuple[str, ...] = ("t2m", "tp", "ssrd")
PREMIUM_SOURCE_VARIABLES: tuple[str, ...] = (
    "t2m",
    "tp",
    "ssrd",
    "si10",
    "sd",
    "sst",
    "d2m",
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
    "heat": "heat",
}

# ERA5 SI → display units. Variables absent from this map are emitted as-is
# (or are derived, and so never reach it).
UNIT_CONVERSIONS: dict[str, Callable[[float], float]] = {
    "t2m": kelvin_to_celsius,
    "sst": kelvin_to_celsius,
    "d2m": kelvin_to_celsius,
    "tp": m_per_day_to_mm_per_day,
    "si10": m_s_to_km_h,
    "sd": m_to_cm,
}

# Read to derive other variables, never emitted themselves.
INTERMEDIATE_VARIABLES: frozenset[str] = frozenset({"ssrd", "d2m"})

PERCENTILE_STATS: tuple[str, ...] = ("p10", "p50", "p90")

# The variables `polygon_score` consults, in the units it expects.
SCORED_VARIABLES: tuple[str, ...] = ("t2m", "tp", "sun_hours")

# Pipeline `polygon_score` returns 0..3; the web's preferences mode bins on a
# 0..100 scale (see web/src/lib/scoring.ts SCORE_BINS). These centroids place
# each bucket squarely inside the corresponding web bin (avoid <50, acceptable
# 50-69, good 70-84, perfect ≥85).
SCORE_TO_PREF: dict[int, int] = {0: 25, 1: 60, 2: 75, 3: 90}


def variables_for_tier(tier: Tier) -> tuple[str, ...]:
    """Variables the tier emits, in display units."""
    if tier == "free":
        return FREE_VARIABLES
    if tier == "premium":
        return PREMIUM_VARIABLES
    raise ValueError(f"unknown tier: {tier!r}")


def source_variables_for_tier(tier: Tier) -> tuple[str, ...]:
    """Raw ERA5 codes the tier must read out of the percentiles frame."""
    if tier == "free":
        return FREE_SOURCE_VARIABLES
    if tier == "premium":
        return PREMIUM_SOURCE_VARIABLES
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


def _representative_latitude(geometry: object) -> float:
    """Latitude of a point guaranteed to lie inside the polygon.

    Feeds the sunshine derivation, which is latitude-dependent. Falls back
    to the equator if the geometry cannot produce one — that biases only
    sunshine hours, and only for a polygon that is already malformed.
    """
    for accessor in ("representative_point", "centroid"):
        try:
            point = getattr(geometry, accessor)
            resolved = point() if callable(point) else point
            return float(resolved.y)
        except (AttributeError, TypeError, ValueError):
            continue
    return 0.0


def _emitted_variable(source_variable: str) -> str:
    """Name the emitted variable derives from / is renamed to."""
    return "sun_hours" if source_variable == "ssrd" else source_variable


def _converter(source_variable: str, *, latitude: float, month: int) -> Callable[[float], float]:
    """Return the SI → display-unit transform for one variable.

    ``ssrd`` is the interesting case: the transform is the full sunshine
    derivation, which depends on where and when the polygon is. It is
    monotonic in SSRD for a fixed (latitude, month), so applying it to
    p10/p50/p90 independently preserves their ordering.
    """
    if source_variable == "ssrd":
        return lambda value: sunshine_hours_from_ssrd(
            value, latitude_deg=latitude, month=month
        )
    return UNIT_CONVERSIONS.get(source_variable, lambda value: value)


def _widen_percentiles_for_polygon(
    poly_percentiles: "object",
    variables: tuple[str, ...],
    *,
    latitude: float = 0.0,
) -> dict[str, float]:
    """Turn long-format percentiles for one polygon into the flat props dict.

    ``variables`` are raw ERA5 codes (see :data:`FREE_SOURCE_VARIABLES`).
    Values arrive in SI units and are converted to display units on the way
    out; ``ssrd`` becomes ``sun_hours``, and ``d2m`` is consumed to derive
    ``rh`` / ``heat`` without being emitted itself.

    Output keys follow the ``{variable}_{stat}_{mm}`` pattern for p10/p50/p90.
    Additionally, the p50 is mirrored under the short alias `<alias>_<mm>`
    that the web's map paint expressions read directly.

    ``latitude`` is the polygon's representative latitude, needed for the
    sunshine derivation.
    """
    props: dict[str, float] = {}
    # p50s in display units, kept for the two-variable derivations below.
    t2m_c_by_month: dict[int, float] = {}
    d2m_c_by_month: dict[int, float] = {}

    for row in poly_percentiles.itertuples(index=False):
        var = row.variable
        if var not in variables:
            continue
        month = int(row.month)
        month_str = f"{month:02d}"
        emitted = _emitted_variable(var)
        convert = _converter(var, latitude=latitude, month=month)

        for stat in PERCENTILE_STATS:
            value = getattr(row, stat, None)
            if value is None or value != value:  # NaN check
                continue
            converted = convert(float(value))
            if emitted not in INTERMEDIATE_VARIABLES:
                props[f"{emitted}_{stat}_{month_str}"] = converted
            if stat != "p50":
                continue
            alias = WEB_PROP_ALIAS.get(emitted)
            if alias is not None:
                props[f"{alias}_{month_str}"] = converted
            if var == "t2m":
                t2m_c_by_month[month] = converted
            elif var == "d2m":
                d2m_c_by_month[month] = converted

    _add_derived_humidity_and_heat(props, t2m_c_by_month, d2m_c_by_month)
    return props


def _add_derived_humidity_and_heat(
    props: dict[str, float],
    t2m_c_by_month: dict[int, float],
    d2m_c_by_month: dict[int, float],
) -> None:
    """Derive `rh` / `heat` from the p50 temperature and dewpoint.

    First-order: the median of a two-variable function is not the function
    of the two medians. For humidity and apparent temperature the error is
    small relative to the legend's bin width, and the alternative — carrying
    every year through to this stage — would mean re-plumbing the whole
    percentile step for two premium display modes.
    """
    for month, t2m_c in t2m_c_by_month.items():
        d2m_c = d2m_c_by_month.get(month)
        if d2m_c is None:
            continue
        month_str = f"{month:02d}"
        rh = relative_humidity_pct(t2m_c, d2m_c)
        props[f"rh_p50_{month_str}"] = rh
        props[f"{WEB_PROP_ALIAS['rh']}_{month_str}"] = rh
        heat = heat_index_c(t2m_c, rh)
        props[f"heat_p50_{month_str}"] = heat
        props[f"{WEB_PROP_ALIAS['heat']}_{month_str}"] = heat


def score_props(converted: dict[str, float]) -> dict[str, int]:
    """Per-month `score_<mm>` / `pref_<mm>` from converted p50 values.

    Reads back out of the props dict produced by
    :func:`_widen_percentiles_for_polygon` so the score is computed from
    exactly the display-unit values the map paints. Scoring raw ERA5 SI
    units against :data:`DEFAULT_PREFERENCES` collapses every polygon on
    Earth into the same bucket — the map then renders as one flat colour.
    """
    props: dict[str, int] = {}
    for month in range(1, 13):
        month_str = f"{month:02d}"
        values = {
            variable: converted[f"{variable}_p50_{month_str}"]
            for variable in SCORED_VARIABLES
            if f"{variable}_p50_{month_str}" in converted
        }
        score = _score_row(values)
        props[f"score_{month_str}"] = score
        # `pref_<mm>` is what the web's `preferences` display mode reads;
        # rebase the 0..3 bucket onto the 0..100 web score scale.
        props[f"pref_{month_str}"] = SCORE_TO_PREF[score]
    return props


def build_feature_collection(
    build_input: BuildInput,
    *,
    tier: Tier,
    exclude_iso2: set[str] | None = None,
) -> dict:
    """Return a GeoJSON FeatureCollection dict for one (tier, level)."""
    pd, _gpd = _require_pandas_and_gpd()
    source_variables = source_variables_for_tier(tier)
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

        geometry = getattr(row, "geometry", None)
        if geometry is None:
            continue

        props: dict[str, object] = {
            "id": pid,
            "iso_a2": iso_a2,
            "admin1_code": admin1_code,
            "name": name,
            "level": build_input.level,
        }
        converted = _widen_percentiles_for_polygon(
            poly_perc, source_variables, latitude=_representative_latitude(geometry)
        )
        props.update(converted)

        props.update(score_props(converted))
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
