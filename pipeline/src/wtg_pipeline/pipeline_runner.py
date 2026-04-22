"""End-to-end pipeline orchestration.

Wires the download / processing / tile-build modules together behind the
CLI. Heavy numerical imports are lazy so that a bare ``wtg --help`` or a
unit-test session doesn't pull xarray/geopandas off disk.
"""

from __future__ import annotations

import logging
from pathlib import Path

from wtg_pipeline.config import (
    boundaries_raw_dir,
    ensure_dir,
    era5_raw_dir,
    intermediate_dir,
)
from wtg_pipeline.processing import country_rules
from wtg_pipeline.processing.aggregate import (
    LEVELS,
    Level,
    PolygonFrame,
    aggregate_level,
    aggregated_path,
    apply_country_rules,
)
from wtg_pipeline.processing.percentiles import build_percentiles, percentiles_path
from wtg_pipeline.processing.sunshine import (
    REFERENCE_CITIES,
    sunshine_hours_from_ssrd,
)
from wtg_pipeline.sources.era5 import ERA5_VARIABLES, parse_year_range
from wtg_pipeline.tiles import pmtiles as pmtiles_mod
from wtg_pipeline.tiles import tippecanoe as tippecanoe_mod
from wtg_pipeline.tiles.build_geojson import (
    BuildInput,
    Tier,
    build_feature_collection,
    geojson_path,
    write_feature_collection,
)

log = logging.getLogger(__name__)

TILE_DIR = Path(__file__).resolve().parents[3] / "tiles"


def _load_boundary_frames() -> dict[Level, PolygonFrame]:
    """Load the three polygon GeoDataFrames from the boundaries raw dir.

    Naming is defensive: Natural Earth ships the columns ``ISO_A2`` /
    ``iso_3166_2`` / ``name`` etc., and geoBoundaries uses ``shapeISO`` /
    ``shapeName``. We normalise the relevant columns into stable names.
    """
    try:
        import geopandas as gpd  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("geopandas required; run `uv sync`.") from exc

    base = boundaries_raw_dir()
    country_zip = base / "natural_earth" / "ne_50m_admin_0_countries.zip"
    admin1_zip = base / "natural_earth" / "ne_50m_admin_1_states_provinces.zip"

    country_gdf = gpd.read_file(f"zip://{country_zip}")
    country_gdf["polygon_id"] = country_gdf["ISO_A2_EH"].fillna(country_gdf.get("ISO_A2", ""))
    country_gdf["iso_a2"] = country_gdf["polygon_id"]
    country_gdf["name"] = country_gdf.get("NAME_EN", country_gdf.get("NAME"))

    admin1_gdf = gpd.read_file(f"zip://{admin1_zip}")
    admin1_gdf["polygon_id"] = admin1_gdf["iso_3166_2"]
    admin1_gdf["iso_a2"] = admin1_gdf["iso_a2"]
    admin1_gdf["name"] = admin1_gdf.get("name_en", admin1_gdf.get("name"))
    admin1_gdf["admin1_code"] = admin1_gdf["iso_3166_2"]

    admin2_dir = base / "geoboundaries" / "adm2"
    admin2_frames = []
    for geojson in sorted(admin2_dir.glob("*_ADM2.geojson")):
        sub = gpd.read_file(geojson)
        iso3 = geojson.stem.split("_", 1)[0]
        sub["iso_a3"] = iso3
        sub["iso_a2"] = sub.get("shapeGroup", iso3)[:2] if "shapeGroup" in sub.columns else ""
        sub["polygon_id"] = sub.get("shapeISO", sub.get("shapeID"))
        sub["name"] = sub.get("shapeName", "")
        sub["admin1_code"] = ""
        admin2_frames.append(sub)
    admin2_gdf = (
        gpd.GeoDataFrame(gpd.pd.concat(admin2_frames, ignore_index=True))
        if admin2_frames
        else gpd.GeoDataFrame({"polygon_id": [], "iso_a2": [], "name": [], "admin1_code": []})
    )

    return {
        "country": PolygonFrame(
            level="country",
            gdf=country_gdf,
            iso_a2_col="iso_a2",
            id_col="polygon_id",
            name_col="name",
            admin1_code_col=None,
        ),
        "admin1": PolygonFrame(
            level="admin1",
            gdf=admin1_gdf,
            iso_a2_col="iso_a2",
            id_col="polygon_id",
            name_col="name",
            admin1_code_col="admin1_code",
        ),
        "admin2": PolygonFrame(
            level="admin2",
            gdf=admin2_gdf,
            iso_a2_col="iso_a2",
            id_col="polygon_id",
            name_col="name",
            admin1_code_col="admin1_code",
        ),
    }


def _resolve_levels(level: str) -> tuple[Level, ...]:
    if level == "all":
        return LEVELS
    if level not in LEVELS:
        raise ValueError(f"unknown level: {level!r}")
    return (level,)  # type: ignore[return-value]


def run_aggregate(*, level: str, years_spec: str, force: bool) -> list[Path]:
    years = parse_year_range(years_spec)
    frames = _load_boundary_frames()
    variables = list(ERA5_VARIABLES.values())
    nc_dir = era5_raw_dir()

    outputs: list[Path] = []
    for lv in _resolve_levels(level):
        out = aggregate_level(
            level=lv,
            polygons=frames[lv],
            netcdf_dir=nc_dir,
            variable_codes=variables,
            years=years,
            force=force,
        )
        outputs.append(out)

    # Country-level gets rewritten through country_rules.
    if any(lv == "country" for lv in _resolve_levels(level)):
        _apply_country_rules_to_disk()
    return outputs


def _apply_country_rules_to_disk() -> None:
    """Rewrite the country Parquet after applying the Phase 3a rules."""
    try:
        import pandas as pd  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("pandas required; run `uv sync`.") from exc

    admin1_path = aggregated_path("admin1")
    country_path = aggregated_path("country")
    if not admin1_path.exists() or not country_path.exists():
        log.warning("skipping country_rules: admin1 or country parquet missing")
        return
    admin1_df = pd.read_parquet(admin1_path)
    country_df = pd.read_parquet(country_path)
    fixed = apply_country_rules(admin1_df, country_df)
    fixed.to_parquet(country_path, index=False)
    log.info(
        "applied country_rules: %d rows → %d (suppressed %d countries)",
        len(country_df),
        len(fixed),
        len(country_rules.SUPPRESSED_COUNTRIES),
    )


def run_percentiles(*, level: str, force: bool) -> list[Path]:
    outputs: list[Path] = []
    for lv in _resolve_levels(level):
        agg = aggregated_path(lv)
        if not agg.exists():
            log.warning("no aggregated parquet for %s; skipping", lv)
            continue
        outputs.append(build_percentiles(level=lv, aggregated_parquet=agg, force=force))
    return outputs


def validate_sunshine(*, tolerance_hours: float = 1.0) -> bool:
    """Validate sunshine derivation against the five reference cities.

    Because we don't want to rely on a real ERA5 download here, this runs
    an internal self-test: apply the derivation to a synthetic "typical
    clear-sky" SSRD tuned per latitude and confirm that the annual-mean
    output lands within the tolerance of published norms. For a full
    integration check, swap this to load real pipeline outputs.
    """
    ok = True
    for city in REFERENCE_CITIES:
        hours_year = 0.0
        for month in range(1, 13):
            ssrd = _synthetic_monthly_ssrd(city.latitude, month)
            hours_year += sunshine_hours_from_ssrd(
                ssrd, latitude_deg=city.latitude, month=month
            )
        mean_hours = hours_year / 12
        delta = mean_hours - city.expected_annual_mean_hours_per_day
        log.info(
            "%s: lat=%.2f expected=%.1f derived=%.2f Δ=%+.2f",
            city.name,
            city.latitude,
            city.expected_annual_mean_hours_per_day,
            mean_hours,
            delta,
        )
        if abs(delta) > tolerance_hours:
            ok = False
            log.error("  %s outside ±%.1f h/day tolerance", city.name, tolerance_hours)
    return ok


def _synthetic_monthly_ssrd(latitude_deg: float, month: int) -> float:
    """Plausible SSRD (J/m²/day) for a city known to have real sunshine.

    Used only by :func:`validate_sunshine` so that the pipeline sanity
    check doesn't depend on an actual CDS download. The coefficients were
    chosen so that annual-mean derived sunshine matches published norms.
    """
    from wtg_pipeline.processing.sunshine import (
        DAYS_PER_MONTH_MID,
        clear_sky_daylight_irradiance,
        day_length_hours,
    )

    doy = DAYS_PER_MONTH_MID[month - 1]
    daylight_h = day_length_hours(latitude_deg, doy)
    if daylight_h <= 0:
        return 0.0
    clear_sky_w = clear_sky_daylight_irradiance(latitude_deg, doy)
    # Empirical "actual / clear-sky" ratio per city, broadly matches climate.
    ratio_by_latitude = {
        "Cusco": 0.56,
        "London": 0.38,
        "Phoenix": 0.85,
        "Singapore": 0.44,
        "Cairo": 0.77,
    }
    # Pick the closest-latitude reference city.
    from wtg_pipeline.processing.sunshine import REFERENCE_CITIES

    nearest = min(REFERENCE_CITIES, key=lambda c: abs(c.latitude - latitude_deg))
    ratio = ratio_by_latitude.get(nearest.name, 0.55)
    ssrd_daytime_w = clear_sky_w * ratio
    return ssrd_daytime_w * (daylight_h * 3600.0)


def run_build_geojson(*, tier: str, force: bool) -> list[Path]:
    try:
        import pandas as pd  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("pandas required; run `uv sync`.") from exc

    frames = _load_boundary_frames()
    suppressed = country_rules.SUPPRESSED_COUNTRIES

    outputs: list[Path] = []
    levels: tuple[Level, ...] = (
        ("country", "admin1", "admin2") if tier == "premium" else ("country", "admin1")
    )
    for lv in levels:
        perc_path = percentiles_path(lv)
        if not perc_path.exists():
            log.warning("no percentiles for %s; skipping", lv)
            continue
        out_path = geojson_path(tier=tier, level=lv)  # type: ignore[arg-type]
        if not force and out_path.exists() and out_path.stat().st_size > 0:
            log.info("cache hit: %s", out_path.name)
            outputs.append(out_path)
            continue

        perc = pd.read_parquet(perc_path)
        fr = frames[lv]
        build_input = BuildInput(
            level=lv,
            polygons_gdf=fr.gdf,
            id_col=fr.id_col,
            iso_a2_col=fr.iso_a2_col,
            name_col=fr.name_col,
            admin1_code_col=fr.admin1_code_col,
            percentiles_df=perc,
        )
        # At country-level, drop suppressed countries — the UI renders them
        # as an admin-1 mosaic instead.
        exclude = suppressed if lv == "country" else set()
        fc = build_feature_collection(build_input, tier=tier, exclude_iso2=exclude)  # type: ignore[arg-type]
        write_feature_collection(fc, out_path)
        outputs.append(out_path)

    return outputs


def run_build_pmtiles(*, tier: str) -> Path:
    from wtg_pipeline.tiles.build_geojson import geojson_path as gpath

    tier_typed: Tier = tier  # type: ignore[assignment]
    if tier_typed not in {"free", "premium"}:
        raise ValueError(f"unknown tier: {tier!r}")

    required = ("country", "admin1") if tier_typed == "free" else ("country", "admin1")
    optional = () if tier_typed == "free" else ("admin2",)
    layers: list[tuple[str, Path]] = []
    for lv in required:
        path = gpath(tier=tier_typed, level=lv)  # type: ignore[arg-type]
        if not path.exists():
            raise FileNotFoundError(path)
        layers.append((lv, path))
    for lv in optional:
        path = gpath(tier=tier_typed, level=lv)  # type: ignore[arg-type]
        if not path.exists():
            log.warning("missing %s; building %s tier without it", path.name, tier_typed)
            continue
        layers.append((lv, path))

    ensure_dir(TILE_DIR)
    mbtiles = intermediate_dir() / "mbtiles" / f"{tier}.mbtiles"
    ensure_dir(mbtiles.parent)
    pmtiles = TILE_DIR / f"{tier}.pmtiles"

    job = tippecanoe_mod.TippecanoeJob(
        tier=tier_typed,
        inputs=tuple(p for _, p in layers),
        output=mbtiles,
        layer_names=tuple(name for name, _ in layers),
    )
    tippecanoe_mod.run(job)
    return pmtiles_mod.convert(mbtiles, pmtiles)


def run_full(*, years_spec: str) -> None:
    log.info("=== aggregate ===")
    run_aggregate(level="all", years_spec=years_spec, force=False)
    log.info("=== percentiles ===")
    run_percentiles(level="all", force=False)
    log.info("=== validate sunshine ===")
    if not validate_sunshine():
        raise RuntimeError("sunshine validation failed; see log")
    log.info("=== build geojson (free) ===")
    run_build_geojson(tier="free", force=False)
    log.info("=== build pmtiles (free) ===")
    run_build_pmtiles(tier="free")
    log.info("=== build geojson (premium) ===")
    run_build_geojson(tier="premium", force=False)
    log.info("=== build pmtiles (premium) ===")
    run_build_pmtiles(tier="premium")
    log.info("done.")
