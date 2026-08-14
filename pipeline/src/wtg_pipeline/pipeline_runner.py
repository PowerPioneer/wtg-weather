"""End-to-end pipeline orchestration.

Wires the download / processing / tile-build modules together behind the
CLI. Heavy numerical imports are lazy so that a bare ``wtg --help`` or a
unit-test session doesn't pull xarray/geopandas off disk.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable

from wtg_pipeline.config import (
    boundaries_raw_dir,
    ensure_dir,
    era5_raw_dir,
    intermediate_dir,
)
from wtg_pipeline.processing import advisories as advisories_mod
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
from wtg_pipeline.sources import geoboundaries
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

# `{"type": "FeatureCollection", "features": []}` is 48 bytes. Any real layer
# is orders of magnitude larger, so this only ever catches the empty case.
_MIN_GEOJSON_BYTES = 200


def _load_boundary_frames(
    levels: Iterable[Level] = LEVELS,
) -> dict[Level, PolygonFrame]:
    """Load polygon GeoDataFrames for the requested levels only.

    Naming is defensive: Natural Earth ships the columns ``ISO_A2`` /
    ``iso_3166_2`` / ``name`` etc., and geoBoundaries uses ``shapeISO`` /
    ``shapeName``. We normalise the relevant columns into stable names.

    Levels are loaded on demand because admin-2 is expensive and optional:
    geoBoundaries ADM2 is ~3.5 GB across 179 files, and nothing in the free
    tier touches it. Loading it unconditionally made a free-tier build both
    slow and hostage to a data problem in a file it would never read.
    """
    try:
        import geopandas as gpd  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("geopandas required; run `uv sync`.") from exc

    wanted = set(levels)
    base = boundaries_raw_dir()
    frames: dict[Level, PolygonFrame] = {}

    if "country" in wanted:
        country_zip = (
            base / "natural_earth" / geoboundaries.NATURAL_EARTH_COUNTRY_FILENAME
        )
        country_gdf = gpd.read_file(f"zip://{country_zip}")
        country_gdf["iso_a2"] = _normalise_country_iso_a2(country_gdf)
        # ADM0_A3 is populated for every row (including the handful with no
        # ISO-2), so it is the only safe polygon identity here.
        country_gdf["polygon_id"] = country_gdf["ADM0_A3"].astype(str)
        country_gdf["name"] = _coalesce_column(country_gdf, "NAME_EN", "NAME")
        frames["country"] = PolygonFrame(
            level="country",
            gdf=country_gdf,
            iso_a2_col="iso_a2",
            id_col="polygon_id",
            name_col="name",
            admin1_code_col=None,
        )

    if "admin1" in wanted:
        admin1_zip = (
            base / "natural_earth" / geoboundaries.NATURAL_EARTH_ADMIN1_FILENAME
        )
        admin1_gdf = gpd.read_file(f"zip://{admin1_zip}")
        # `iso_3166_2` is NOT unique in the 10m layer — 155 rows share a code
        # with another row (Azerbaijan district/municipality pairs, Australia's
        # Lord Howe Island filed under AU-NSW, and so on). Using it as the
        # polygon identity silently collapses those polygons onto one another
        # during aggregation. `adm1_code` is unique per feature, so identity
        # comes from there and `iso_3166_2` is kept only as the whitelist key.
        admin1_gdf["polygon_id"] = admin1_gdf["adm1_code"].astype(str)
        admin1_gdf["iso_a2"] = admin1_gdf["iso_a2"].astype(str).str.strip().str.upper()
        admin1_gdf["name"] = _coalesce_column(admin1_gdf, "name_en", "name")
        admin1_gdf["admin1_code"] = admin1_gdf["iso_3166_2"].astype(str).str.strip()
        frames["admin1"] = PolygonFrame(
            level="admin1",
            gdf=admin1_gdf,
            iso_a2_col="iso_a2",
            id_col="polygon_id",
            name_col="name",
            admin1_code_col="admin1_code",
        )

    if "admin2" in wanted:
        frames["admin2"] = _load_admin2_frame(gpd, base)

    return frames


def _coalesce_column(gdf: object, primary: str, fallback: str) -> object:
    """First non-null of two columns, as a string Series.

    Natural Earth leaves ``name_en`` null for a handful of units; the local
    ``name`` is always populated.
    """
    columns = getattr(gdf, "columns", [])
    if primary in columns and fallback in columns:
        return gdf[primary].fillna(gdf[fallback]).astype(str)
    if primary in columns:
        return gdf[primary].astype(str)
    return gdf[fallback].astype(str)


def _normalise_country_iso_a2(gdf: object) -> object:
    """Country ISO-2 codes with Natural Earth's ``-99`` sentinel removed.

    NE writes ``-99`` where a polygon has no assigned ISO-3166-1 alpha-2
    code. In the 50m country layer that is Somaliland, Northern Cyprus and
    the Siachen Glacier. Left as-is the sentinel reaches the tiles and the
    web treats ``-99`` as if it were a country: it cannot be routed to a
    country page and it pollutes any ISO-keyed lookup.

    These polygons still carry real climate, so they are kept and painted —
    only the code is blanked, which makes them non-routable rather than
    wrongly routable. ``ISO_A2_EH`` is preferred over ``ISO_A2`` because it
    resolves several disputed territories that ``ISO_A2`` leaves at ``-99``.
    """
    columns = getattr(gdf, "columns", [])
    primary = "ISO_A2_EH" if "ISO_A2_EH" in columns else "ISO_A2"

    def _clean(name: str):
        # Null-check on the raw column, before `astype(str)` turns a genuine
        # null into the string "nan". Namibia's ISO-2 code is the literal
        # "NA", so no string that merely *looks* like a null token may be
        # treated as one.
        column = gdf[name]
        text = column.astype(str).str.strip().str.upper()
        return text.mask(column.isna(), "").where(~text.isin(_MISSING_ISO_TOKENS), "")

    cleaned = _clean(primary)
    if primary == "ISO_A2_EH" and "ISO_A2" in columns:
        cleaned = cleaned.where(cleaned != "", _clean("ISO_A2"))
    dropped = int((cleaned == "").sum())
    if dropped:
        names = gdf.loc[cleaned == "", "NAME_EN"].astype(str).tolist()
        log.warning(
            "%d country polygon(s) have no ISO-3166-1 alpha-2 code and will be "
            "painted but not routable: %s",
            dropped,
            ", ".join(sorted(names)),
        )
    return cleaned


# String tokens Natural Earth uses for "no code here". Deliberately minimal:
# "NA" is Namibia's real ISO-3166-1 alpha-2 code, and "NAN"/"NONE" are only
# ever produced by stringifying a null, which is handled separately.
_MISSING_ISO_TOKENS: frozenset[str] = frozenset({"-99", ""})


@lru_cache(maxsize=1)
def _iso3_to_iso2() -> dict[str, str]:
    """ISO-3 → ISO-2 country codes, sourced from the Natural Earth country layer.

    geoBoundaries identifies countries by ISO-3 while every other level in the
    pipeline keys off ISO-2. Natural Earth carries both, so it is the mapping
    of record here — deriving one from the other by string surgery is wrong for
    a large share of countries.
    """
    try:
        import geopandas as gpd  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("geopandas required; run `uv sync`.") from exc

    zip_path = (
        boundaries_raw_dir()
        / "natural_earth"
        / geoboundaries.NATURAL_EARTH_COUNTRY_FILENAME
    )
    if not zip_path.exists():
        raise FileNotFoundError(
            f"{zip_path} is required to map geoBoundaries ISO-3 codes onto "
            f"ISO-2. Run `wtg download boundaries --source naturalearth`."
        )
    gdf = gpd.read_file(f"zip://{zip_path}")
    iso2 = _normalise_country_iso_a2(gdf)
    return {
        str(a3).upper(): code
        for a3, code in zip(gdf["ADM0_A3"], iso2, strict=True)
        if code
    }


def _admin2_polygon_ids(sub: object, iso3: str) -> object:
    """Stable, unique identity for each geoBoundaries ADM2 feature.

    Prefers ``shapeID`` (populated and unique), falls back to ``shapeISO``,
    and finally synthesises ``{ISO3}-ADM2-{n}`` so that a file with neither
    still aggregates instead of collapsing every polygon onto a blank id.
    """
    candidates = [c for c in ("shapeID", "shapeISO") if c in getattr(sub, "columns", [])]
    ids = None
    for column in candidates:
        values = sub[column].astype(str).str.strip()
        ids = values if ids is None else ids.where(ids != "", values)
    if ids is None:
        ids = sub.index.to_series().map(lambda _: "")
    synthetic = [f"{iso3}-ADM2-{n}" for n in range(len(sub))]
    return ids.where(ids != "", synthetic).astype(str)


def _load_admin2_frame(gpd: object, base: Path) -> PolygonFrame:
    """Concatenate the per-country geoBoundaries ADM2 files into one frame."""
    # geoBoundaries ships single features far larger than GDAL's default
    # per-feature ceiling — PHL_ADM2.geojson is 444 MB and its island
    # multipolygons run to tens of MB each. Without lifting the limit,
    # `read_file` aborts mid-directory with a DataSourceError.
    os.environ["OGR_GEOJSON_MAX_OBJ_SIZE"] = "0"

    admin2_dir = base / "geoboundaries" / "adm2"
    paths = sorted(admin2_dir.glob("*_ADM2.geojson"))
    if not paths:
        # An empty directory used to produce an empty GeoDataFrame, which
        # produced a GeoJSON with zero features, which `run_build_pmtiles`
        # accepted because the file existed — shipping a premium archive with
        # no districts. The sources are ~3.5 GB and get reclaimed for disk on
        # the build box, so "the directory is empty" is a routine state, not
        # an exotic one, and the weekly advisory rebuild walks straight into
        # it. Same call WS-1 made for a missing admin-2 GeoJSON: fail loudly.
        raise FileNotFoundError(
            f"no *_ADM2.geojson under {admin2_dir}. The premium tier is built "
            f"from these; without them the admin-2 layer would be silently "
            f"empty. Run `wtg download boundaries --source geoboundaries`, or "
            f"build the free tier only (`TIERS=free ./infra/scripts/"
            f"rebuild-tiles.sh`)."
        )
    iso3_to_iso2 = _iso3_to_iso2()
    admin2_frames = []
    for index, geojson in enumerate(paths, start=1):
        log.info("[%d/%d] reading %s", index, len(paths), geojson.name)
        sub = gpd.read_file(geojson)  # type: ignore[attr-defined]
        iso3 = geojson.stem.split("_", 1)[0].upper()
        sub["iso_a3"] = iso3

        # geoBoundaries' ISO-2 has to be looked up, not derived. `shapeGroup`
        # holds the ISO-3 code, and truncating that to two characters is wrong
        # for a large share of the world (DNK→DK, CHN→CN, DEU→DE all break).
        iso2 = iso3_to_iso2.get(iso3, "")
        if not iso2:
            log.warning("no ISO-2 mapping for %s; admin-2 rows will be unrouteable", iso3)
        sub["iso_a2"] = iso2

        # `shapeISO` is empty in every geoBoundaries ADM2 file we have — using
        # it as the identity gave every polygon the same blank id, which
        # collapses the whole level onto one row during aggregation.
        # `shapeID` is populated and unique per feature.
        sub["polygon_id"] = _admin2_polygon_ids(sub, iso3)
        sub["name"] = sub["shapeName"].astype(str) if "shapeName" in sub.columns else ""
        sub["admin1_code"] = ""
        admin2_frames.append(sub)

    admin2_gdf = (
        gpd.GeoDataFrame(gpd.pd.concat(admin2_frames, ignore_index=True))  # type: ignore[attr-defined]
        if admin2_frames
        else gpd.GeoDataFrame(  # type: ignore[attr-defined]
            {"polygon_id": [], "iso_a2": [], "name": [], "admin1_code": []}
        )
    )
    return PolygonFrame(
        level="admin2",
        gdf=admin2_gdf,
        iso_a2_col="iso_a2",
        id_col="polygon_id",
        name_col="name",
        admin1_code_col="admin1_code",
    )


def _resolve_levels(level: str) -> tuple[Level, ...]:
    if level == "all":
        return LEVELS
    if level not in LEVELS:
        raise ValueError(f"unknown level: {level!r}")
    return (level,)  # type: ignore[return-value]


def run_aggregate(*, level: str, years_spec: str, force: bool) -> list[Path]:
    years = parse_year_range(years_spec)
    resolved = _resolve_levels(level)
    frames = _load_boundary_frames(resolved)
    variables = list(ERA5_VARIABLES.values())
    nc_dir = era5_raw_dir()

    outputs: list[Path] = []
    for lv in resolved:
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
    if "country" in resolved:
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


@dataclass(frozen=True)
class AdvisoryConsolidation:
    """Result of :func:`run_process_advisories`.

    ``levels_changed`` is the only field a caller should branch on when
    deciding whether to rebuild tiles: ``detail_changed`` also flips when a
    government merely rewords its prose, and a reworded summary is not worth
    a full CDN purge.
    """

    detail_path: Path
    index_path: Path
    detail_changed: bool
    levels_changed: bool
    countries: int
    regions: int
    # {source_id: days behind the freshest source}, empty when all are current.
    stale: dict[str, int]


def run_process_advisories(
    *,
    raw_dir: Path | None = None,
    final_path: Path | None = None,
    index_path: Path | None = None,
) -> AdvisoryConsolidation:
    """Fold the newest scrape from every government into one state.

    Writes ``data/final/advisories.json`` (full detail, for the API) and
    ``data/intermediate/advisories/safety_index.json`` (levels only, for the
    tile build). Neither file is touched when its content is unchanged, so
    the weekly cron can hash the index to decide whether the map actually
    needs rebuilding.
    """
    detail_target = final_path or advisories_mod.advisories_json_path()
    index_target = index_path or advisories_mod.safety_index_path()

    by_source = advisories_mod.load_advisories(raw_dir)
    if not by_source:
        raise FileNotFoundError(
            f"no advisory dumps under {raw_dir or advisories_mod.advisories_raw_dir()}. "
            f"Run `wtg download advisories --source all` first."
        )

    stale = advisories_mod.stale_sources(advisories_mod.latest_source_files(raw_dir))
    for source_id, lag in stale.items():
        # Not fatal: one stale government is better than no advisories at all,
        # and the consensus is a max across the rest. But it must be visible —
        # this went unnoticed for four months.
        log.warning(
            "advisories: %s is %d days behind the freshest source. Its scrape "
            "has been failing and consolidation is using an old dump.",
            source_id,
            lag,
        )

    previous = advisories_mod.read_json(detail_target)
    consolidated = advisories_mod.consolidate(by_source, previous=previous)
    index = advisories_mod.safety_index(consolidated)

    detail_changed = advisories_mod.write_json_if_changed(
        advisories_mod.to_payload(consolidated), detail_target
    )
    levels_changed = advisories_mod.write_json_if_changed(
        advisories_mod.index_payload(index), index_target
    )

    log.info(
        "advisories: %d source(s), %d country level(s), %d subdivision level(s); "
        "detail %s, levels %s",
        len(by_source),
        len(index.by_country),
        len(index.by_region),
        "changed" if detail_changed else "unchanged",
        "changed" if levels_changed else "unchanged",
    )
    return AdvisoryConsolidation(
        detail_path=detail_target,
        index_path=index_target,
        detail_changed=detail_changed,
        levels_changed=levels_changed,
        countries=len(index.by_country),
        regions=len(index.by_region),
        stale=stale,
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

    suppressed = country_rules.SUPPRESSED_COUNTRIES

    # Advisories are optional input. They refresh weekly while the climate
    # data refreshes yearly, so a climate rebuild must not require a scrape
    # to have succeeded — but a build that silently drops them would ship the
    # grey Safety map that RC-5 describes, so say so loudly.
    safety = advisories_mod.load_safety_index()
    if safety is None:
        log.warning(
            "no advisory index at %s — the Safety display mode will paint every "
            "polygon grey. Run `wtg download advisories --source all` followed by "
            "`wtg process advisories` to populate it.",
            advisories_mod.safety_index_path(),
        )
    else:
        log.info("advisory index: %d country level(s)", len(safety.by_country))

    outputs: list[Path] = []
    levels: tuple[Level, ...] = (
        ("country", "admin1", "admin2") if tier == "premium" else ("country", "admin1")
    )
    frames = _load_boundary_frames(levels)
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
        fc = build_feature_collection(
            build_input,
            tier=tier,  # type: ignore[arg-type]
            exclude_iso2=exclude,
            safety=safety,
        )
        if not fc.get("features"):
            # Reaching here means the polygons and the percentiles did not
            # join — an empty boundary frame, or ids from two different
            # vintages. Writing the file anyway is what makes it invisible:
            # `run_build_pmtiles` only checks that the path exists, so an
            # empty FeatureCollection ships as an empty layer and overwrites
            # a good build's output on the way.
            raise RuntimeError(
                f"{lv} produced zero features for the {tier} tier. Its "
                f"percentiles ({perc_path.name}, {len(perc)} rows) did not "
                f"join to any polygon — check that the boundary sources for "
                f"{lv} are present and are the vintage the aggregate was "
                f"built from. Refusing to overwrite {out_path.name} with an "
                f"empty layer."
            )
        write_feature_collection(fc, out_path)
        outputs.append(out_path)

    return outputs


def run_build_pmtiles(*, tier: str) -> Path:
    from wtg_pipeline.tiles.build_geojson import geojson_path as gpath

    tier_typed: Tier = tier  # type: ignore[assignment]
    if tier_typed not in {"free", "premium"}:
        raise ValueError(f"unknown tier: {tier!r}")

    # admin-2 is the premium tier's entire reason to exist. Building premium
    # without it used to warn and continue, which shipped a premium archive
    # that was just the free one at higher zoom — the failure was invisible
    # until someone decoded the tiles. Treat it as fatal instead.
    required: tuple[str, ...] = (
        ("country", "admin1")
        if tier_typed == "free"
        else ("country", "admin1", "admin2")
    )
    layers: list[tuple[str, Path]] = []
    for lv in required:
        path = gpath(tier=tier_typed, level=lv)  # type: ignore[arg-type]
        if not path.exists():
            raise FileNotFoundError(
                f"{path} is missing — cannot build the {tier_typed} tier without "
                f"the {lv} layer. Run `wtg process aggregate --level {lv}`, "
                f"`wtg process percentiles --level {lv}` and "
                f"`wtg build geojson --tier {tier_typed}` first."
            )
        if path.stat().st_size < _MIN_GEOJSON_BYTES:
            # An empty FeatureCollection is 48 bytes and passes `exists()`.
            # Left to run, tippecanoe would happily produce the layer with no
            # features in it — the same silent-empty failure as a missing file,
            # wearing a filename.
            raise RuntimeError(
                f"{path} is {path.stat().st_size} bytes — that is an empty "
                f"FeatureCollection, not a {lv} layer. Rebuild it with "
                f"`wtg build geojson --tier {tier_typed} --force` and fix "
                f"whatever it reports rather than tiling an empty layer."
            )
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
    log.info("=== consolidate advisories ===")
    try:
        run_process_advisories()
    except FileNotFoundError as exc:
        # A missing scrape degrades the Safety mode, not the climate map.
        log.warning("skipping advisories: %s", exc)
    log.info("=== build geojson (free) ===")
    run_build_geojson(tier="free", force=False)
    log.info("=== build pmtiles (free) ===")
    run_build_pmtiles(tier="free")
    log.info("=== build geojson (premium) ===")
    run_build_geojson(tier="premium", force=False)
    log.info("=== build pmtiles (premium) ===")
    run_build_pmtiles(tier="premium")
    log.info("=== publish api data ===")
    # Same inputs as the tiles, different consumer: the SSR country and region
    # pages. Last, because it reads `advisories.json` which the advisory step
    # above writes, and because a failure here costs the pages, not the map.
    from wtg_pipeline.publish.api_data import run_publish_api_data

    run_publish_api_data()
    log.info("done.")
