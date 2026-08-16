"""Build the per-country JSON bundle the API serves to the SSR pages.

Why a file bundle and not a database
------------------------------------

``FEATURE_GAP_PLAN.md`` § WS-5 offered two routes: load the pipeline's outputs
into Postgres at deploy time, or mount them read-only into the API container.
The mount wins here for a reason that is structural rather than aesthetic — the
pipeline runs on the **host** (``uv``, per ``pipeline/CLAUDE.md``) while
Postgres is on an internal-only Docker network that ``infra/CLAUDE.md``
forbids exposing to the host. A ``wtg publish api-data`` that wrote to Postgres
would first have to punch a hole through that rule.

So this step writes a directory, ``docker-compose.yml`` mounts it read-only at
``/srv/wtg-data``, and the API reads it the same way Caddy reads ``./tiles``.
The data is world-readable reference data that changes yearly (climate) or
weekly (advisories); it has no rows to update, no transactions, and no
per-user state.

What comes out
--------------

::

    data/final/api/
      index.json              every published country: slug, name, iso2, region
      countries/<slug>.json   one payload per country

``index.json`` is load-bearing beyond discovery: the web generates its static
route tree from it, so the set of generated pages is *exactly* the set the API
can answer for. Driving `generateStaticParams` off the country registry
instead would emit a page for every ISO-2 code a polygon can carry, and
`dynamicParams = false` turns each one the pipeline has no climate for into a
build-time 404.

What is in a payload, and what is deliberately not
--------------------------------------------------

Present, because the pipeline knows it:

* the 12-month climatology (p50) with p10/p90 bands for temperature, straight
  out of the percentiles Parquet and through the *same* unit conversions the
  tiles use (:func:`widen_percentiles_for_polygon`), so a country page and the
  map cannot disagree about what April looks like;
* per-month and best-month scores from :func:`polygon_score` against
  :data:`DEFAULT_PREFERENCES` — the identical rule the web's ``preferenceScore``
  reproduces and ``scoring.test.ts`` pins;
* every admin-1 region with its own temperature, rain and sunshine series;
* the advisory state from ``advisories.json``;
* capital and timezone from Natural Earth's populated-places layer, and land
  area computed from the country's own geometry.

Absent, because it would have to be invented:

* the four **premium** variables (snow, SST, heat index, humidity). Country
  pages are statically generated and therefore identical for every visitor, so
  a premium series in the payload is a premium series in the public HTML. The
  pipeline already treats the tier boundary as a file boundary; this is the
  same boundary drawn on the same reasoning.
* local-language names, currency and official languages. Natural Earth carries
  none of them, and a hand-kept table would drift from the boundary vintage.

The prose fields — ``summary``, ``monthNotes``, the best-month and related-country
captions — are generated from the numbers above, mechanically and
deterministically. They read drier than editorial copy, and that is the trade:
every sentence is checkable against the series printed on the same page.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Sequence

from wtg_pipeline.config import boundaries_raw_dir, ensure_dir, final_dir
from wtg_pipeline.processing.advisories import (
    LEVEL_LABELS,
    advisories_json_path,
    read_json,
    write_json_if_changed,
)
from wtg_pipeline.processing.country_registry import (
    build_registry,
    registry_rows_from_gdf,
    slugify,
)
from wtg_pipeline.processing.country_rules import SUPPRESSED_COUNTRIES
from wtg_pipeline.processing.scoring import DEFAULT_PREFERENCES, polygon_score
from wtg_pipeline.sources import geoboundaries
from wtg_pipeline.tiles.build_geojson import (
    FREE_SOURCE_VARIABLES,
    SCORE_TO_PREF,
    representative_latitude,
    widen_percentiles_for_polygon,
)

log = logging.getLogger(__name__)

MONTH_LABELS: tuple[str, ...] = (
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
)
MONTH_NAMES: tuple[str, ...] = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)
# Non-leap lengths. Used only to turn the pipeline's mm/day into the mm/month
# the country page prints; a leap day is well inside the noise of a ten-year
# median and would make the output depend on which year it was published.
DAYS_IN_MONTH: tuple[int, ...] = (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)

# Equal-area projection for land area. EPSG:6933 (WGS 84 / NSIDC EASE-Grid 2.0
# Global) is metre-based and equal-area, so a polygon's area is comparable
# anywhere on Earth — which computing it in EPSG:4326 degrees is not.
EQUAL_AREA_CRS = "EPSG:6933"

# The scrapers' ids, as a reader would name the government. `SafetySection` in
# the web maps these onto two-letter codes.
SOURCE_DISPLAY_NAMES: dict[str, str] = {
    "us_state": "United States",
    "uk_fcdo": "United Kingdom",
    "canada": "Canada",
    "australia": "Australia",
    "germany": "Germany",
    "netherlands": "Netherlands",
}

# How far apart two countries' climates are allowed to be before they stop
# being useful "related" links. Distances are in the normalised units of
# `_climate_distance`; ~1.0 is "a couple of degrees and a shower apart".
MAX_RELATED = 6

# A payload needs all three scored variables for all twelve months. A country
# with a hole in its series would render charts with gaps and score months it
# has no data for, which is worse than not having the page.
REQUIRED_ALIASES: tuple[str, ...] = ("t", "r", "s")


def api_dir(base_dir: Path | None = None) -> Path:
    root = base_dir if base_dir is not None else final_dir()
    return ensure_dir(root / "api")


def countries_dir(base_dir: Path | None = None) -> Path:
    return ensure_dir(api_dir(base_dir) / "countries")


def index_path(base_dir: Path | None = None) -> Path:
    return api_dir(base_dir) / "index.json"


@dataclass(frozen=True)
class PublishResult:
    index: Path
    directory: Path
    published: int
    skipped: tuple[str, ...]
    changed: int
    pruned: int


@dataclass
class PolygonClimate:
    """One polygon's 12-month series, in the units the web renders."""

    t: list[float]
    t_min: list[float]
    t_max: list[float]
    rain_day: list[float]
    sun: list[float]
    wind: list[float] | None

    def scores(self) -> list[int]:
        """0–100 per month, by the pipeline rule the web reproduces."""
        out: list[int] = []
        for i in range(12):
            bucket = polygon_score(
                {
                    "t2m": self.t[i],
                    "tp": self.rain_day[i],
                    "sun_hours": self.sun[i],
                },  # type: ignore[arg-type]
                DEFAULT_PREFERENCES,
            )
            out.append(SCORE_TO_PREF[bucket])
        return out

    def rain_month(self) -> list[float]:
        return [self.rain_day[i] * DAYS_IN_MONTH[i] for i in range(12)]


# ─── percentiles → series ────────────────────────────────────────────────


def _twelve(props: Mapping[str, float], key: str) -> list[float] | None:
    """A complete 12-month series under ``key``, or ``None`` if any month is missing."""
    values: list[float] = []
    for month in range(1, 13):
        value = props.get(f"{key}_{month:02d}")
        if value is None or not math.isfinite(float(value)):
            return None
        values.append(round(float(value), 3))
    return values


def polygon_climate(props: Mapping[str, float]) -> PolygonClimate | None:
    """Turn one polygon's widened percentile props into a series, or ``None``.

    ``None`` means the polygon does not carry a complete set of the three
    scored variables — it is dropped rather than published with holes.
    """
    t = _twelve(props, "t")
    rain = _twelve(props, "r")
    sun = _twelve(props, "s")
    if t is None or rain is None or sun is None:
        return None
    return PolygonClimate(
        t=t,
        # The bands are a nicety, not a requirement: a polygon with a p50 but
        # no p10/p90 still charts, it just charts without a shaded band.
        t_min=_twelve(props, "t2m_p10") or list(t),
        t_max=_twelve(props, "t2m_p90") or list(t),
        rain_day=rain,
        sun=sun,
        wind=_twelve(props, "w"),
    )


def _widen(percentiles_by_polygon: Mapping[str, object], polygon_id: str, latitude: float):
    group = percentiles_by_polygon.get(polygon_id)
    if group is None:
        return None
    return widen_percentiles_for_polygon(group, FREE_SOURCE_VARIABLES, latitude=latitude)


def _mean_series(series: Sequence[Sequence[float]]) -> list[float]:
    count = len(series)
    return [round(sum(s[i] for s in series) / count, 3) for i in range(12)]


def mean_climate(parts: Sequence[PolygonClimate]) -> PolygonClimate:
    """Unweighted mean of several polygons' series.

    Used only for the ten :data:`SUPPRESSED_COUNTRIES`. Those countries carry no
    country-level row at all — ``apply_country_rules`` drops them, because a
    single national colour for Russia or Argentina is a lie the map should not
    tell. A country *page* still has to print something, and the mean of the
    country's own admin-1 units is both the honest construction and the one the
    map's mosaic is already showing; the generated summary says so.
    """
    return PolygonClimate(
        t=_mean_series([p.t for p in parts]),
        t_min=_mean_series([p.t_min for p in parts]),
        t_max=_mean_series([p.t_max for p in parts]),
        rain_day=_mean_series([p.rain_day for p in parts]),
        sun=_mean_series([p.sun for p in parts]),
        wind=(
            _mean_series([p.wind for p in parts if p.wind is not None])
            if all(p.wind is not None for p in parts)
            else None
        ),
    )


# ─── reference attributes ────────────────────────────────────────────────


def _column(gdf: object, *candidates: str) -> str | None:
    """First matching column name, case-insensitively."""
    columns = {str(c).upper(): str(c) for c in getattr(gdf, "columns", [])}
    for candidate in candidates:
        hit = columns.get(candidate.upper())
        if hit is not None:
            return hit
    return None


def load_capitals(zip_path: Path | None = None) -> dict[str, tuple[str, str]]:
    """``ADM0_A3 → (capital name, IANA timezone)`` from Natural Earth places.

    Returns an empty mapping when the layer is absent or shaped unexpectedly.
    Nothing downstream requires it: a country whose capital cannot be resolved
    simply omits those two rows from its page, which is the whole reason this
    is allowed to fail quietly.
    """
    target = zip_path or (
        boundaries_raw_dir()
        / "natural_earth"
        / geoboundaries.NATURAL_EARTH_PLACES_FILENAME
    )
    if not target.exists():
        log.warning(
            "%s is missing — country pages will omit capital and timezone. "
            "Run `wtg download boundaries --source naturalearth`.",
            target,
        )
        return {}

    import geopandas as gpd  # type: ignore[import-not-found]

    gdf = gpd.read_file(f"zip://{target}")
    a3_col = _column(gdf, "ADM0_A3", "SOV_A3")
    name_col = _column(gdf, "NAME_EN", "NAME")
    class_col = _column(gdf, "FEATURECLA")
    tz_col = _column(gdf, "TIMEZONE")
    if a3_col is None or name_col is None:
        log.warning("%s has no usable country/name columns; skipping capitals", target.name)
        return {}

    out: dict[str, tuple[str, str]] = {}
    for row in gdf.to_dict("records"):
        feature_class = str(row.get(class_col, "") or "") if class_col else ""
        # "Admin-0 capital" is the seat of government; "Admin-0 capital alt" is
        # a second one (Bolivia, South Africa) and "Admin-0 region capital" is
        # not a national capital at all.
        if class_col is not None and feature_class != "Admin-0 capital":
            continue
        a3 = str(row.get(a3_col, "") or "").strip().upper()
        name = str(row.get(name_col, "") or "").strip()
        if not a3 or not name or a3 in out:
            continue
        timezone = str(row.get(tz_col, "") or "").strip() if tz_col else ""
        out[a3] = (name, timezone)
    log.info("capitals: resolved %d of %d place(s)", len(out), len(gdf))
    return out


def land_areas_km2(country_gdf: object, *, id_col: str = "polygon_id") -> dict[str, float]:
    """``polygon_id`` → land area in km², via an equal-area reprojection.

    Keyed by the polygon's own id rather than by row position: the boundary
    frame is filtered and re-ordered upstream, and an area silently attached
    to the wrong country is the kind of error nobody would catch by reading
    the page.
    """
    try:
        projected = country_gdf.to_crs(EQUAL_AREA_CRS)  # type: ignore[attr-defined]
        areas = projected.area
    except Exception as exc:  # pragma: no cover - depends on the PROJ install
        log.warning("could not reproject to %s (%s); areas omitted", EQUAL_AREA_CRS, exc)
        return {}
    return {
        str(polygon_id): float(value) / 1e6
        for polygon_id, value in zip(country_gdf[id_col], areas)  # type: ignore[index]
    }


def format_area(area_km2: float | None) -> str | None:
    if area_km2 is None or not math.isfinite(area_km2) or area_km2 <= 0:
        return None
    return f"{round(area_km2):,} km²"


# ─── generated prose ─────────────────────────────────────────────────────


def _preference_phrase() -> str:
    """The default preferences, spelled out from the table rather than retyped."""
    by_variable = {p.variable: p for p in DEFAULT_PREFERENCES}
    temp = by_variable.get("t2m")
    rain = by_variable.get("tp")
    sun = by_variable.get("sun_hours")
    parts: list[str] = []
    if temp is not None:
        parts.append(f"{temp.lo:.0f}–{temp.hi:.0f} °C")
    if rain is not None:
        parts.append(f"under {rain.hi:g} mm of rain a day")
    if sun is not None:
        parts.append(f"at least {sun.lo:g} hours of sun")
    return ", ".join(parts)


def possessive(name: str) -> str:
    """``Peru`` → ``Peru's``, ``United States`` → ``United States'``.

    Not a nicety: roughly twenty country names end in *s* — the United States,
    the Netherlands, the Philippines, the Maldives, the Bahamas — and the naive
    form put "United States's national averages" at the top of each of their
    pages.
    """
    return f"{name}'" if name.endswith(("s", "S")) else f"{name}'s"


def _extreme(values: Sequence[float], *, highest: bool) -> tuple[int, float]:
    index = max(range(12), key=lambda i: values[i]) if highest else min(range(12), key=lambda i: values[i])
    return index, values[index]


def build_summary(
    *,
    name: str,
    climate: PolygonClimate,
    best_months: Sequence[int],
    region_count: int,
    region_temp_span: tuple[float, float] | None,
    from_regions: bool,
) -> str:
    """A factual paragraph, assembled from the series on the same page."""
    rain_month = climate.rain_month()
    warm_i, warm_v = _extreme(climate.t, highest=True)
    cool_i, cool_v = _extreme(climate.t, highest=False)
    wet_i, wet_v = _extreme(rain_month, highest=True)
    dry_i, dry_v = _extreme(rain_month, highest=False)
    sun_lo = min(climate.sun)
    sun_hi = max(climate.sun)

    # A country whose warmest and coldest months round to the same figure
    # genuinely has no seasonal swing worth naming; saying "from 26 °C in
    # January to 26 °C in January" reads as a bug in the sentence rather than a
    # fact about the tropics.
    subject = possessive(name)
    if warm_i == cool_i or f"{warm_v:.0f}" == f"{cool_v:.0f}":
        temperature = f"{subject} national average holds near {warm_v:.0f} °C all year"
    else:
        temperature = (
            f"{subject} national averages run from {cool_v:.0f} °C in "
            f"{MONTH_NAMES[cool_i]} to {warm_v:.0f} °C in {MONTH_NAMES[warm_i]}"
        )
    if wet_i == dry_i or f"{wet_v:.0f}" == f"{dry_v:.0f}":
        rainfall = f"around {wet_v:.0f} mm of rain a month"
    else:
        rainfall = (
            f"rainfall between {dry_v:.0f} mm in {MONTH_NAMES[dry_i]} and "
            f"{wet_v:.0f} mm in {MONTH_NAMES[wet_i]}"
        )
    sunshine = (
        f"{sun_lo:.1f} hours of sun a day"
        if f"{sun_lo:.1f}" == f"{sun_hi:.1f}"
        else f"{sun_lo:.1f}–{sun_hi:.1f} hours of sun a day"
    )
    sentences = [f"{temperature}, with {rainfall} and {sunshine}."]
    if best_months:
        named = [MONTH_NAMES[i] for i in best_months]
        listed = named[0] if len(named) == 1 else ", ".join(named[:-1]) + f" and {named[-1]}"
        sentences.append(
            f"Against the default preferences ({_preference_phrase()}), "
            f"the strongest months are {listed}."
        )
    if region_count and region_temp_span is not None:
        low, high = region_temp_span
        sentences.append(
            f"Its {region_count} regions span {low:.0f}–{high:.0f} °C in annual mean "
            f"temperature, so the national figure hides a good deal."
        )
    if from_regions:
        sentences.append(
            f"{name} is large enough that the map paints it as a mosaic of its "
            f"regions rather than one national colour; the figures above are the "
            f"mean of those regions."
        )
    return " ".join(sentences)


def build_month_notes(climate: PolygonClimate) -> dict[str, str]:
    rain_month = climate.rain_month()
    return {
        MONTH_LABELS[i]: (
            f"Around {climate.t[i]:.0f} °C with {rain_month[i]:.0f} mm of rain "
            f"and {climate.sun[i]:.1f} hours of sun a day."
        )
        for i in range(12)
    }


def build_best_months(climate: PolygonClimate, scores: Sequence[int], limit: int = 3):
    """Top months by score, earliest-first on a tie — the web's own rule."""
    order = sorted(range(12), key=lambda i: (-scores[i], i))[:limit]
    rain_month = climate.rain_month()
    return [
        {
            "month": MONTH_NAMES[i],
            "score": scores[i],
            "note": (
                f"{climate.t[i]:.0f} °C · {rain_month[i]:.0f} mm · "
                f"{climate.sun[i]:.1f} h sun"
            ),
        }
        for i in order
    ], order


# ─── related countries ───────────────────────────────────────────────────


def _climate_distance(a: PolygonClimate, b: PolygonClimate) -> float:
    """Normalised distance between two 12-month climates.

    The divisors are "one noticeable step" per variable — 5 °C, 2 mm/day,
    2 h/day — so no single variable dominates simply by having a larger
    numeric range.
    """
    total = 0.0
    for i in range(12):
        total += ((a.t[i] - b.t[i]) / 5.0) ** 2
        total += ((a.rain_day[i] - b.rain_day[i]) / 2.0) ** 2
        total += ((a.sun[i] - b.sun[i]) / 2.0) ** 2
    return math.sqrt(total / 36.0)


def build_related(
    slug: str,
    entries: Mapping[str, dict[str, object]],
) -> list[dict[str, object]]:
    """Nearest climates on the same continent — the page's internal links.

    Same-continent because the links exist for a reader deciding *where in this
    part of the world*, and for the crawler's benefit in tying a region's pages
    together. Falls back to the whole world for a country that is alone on its
    continent in the published set.
    """
    me = entries[slug]
    my_climate: PolygonClimate = me["_climate"]  # type: ignore[assignment]
    pool = [
        other
        for other_slug, other in entries.items()
        if other_slug != slug and other["region"] == me["region"]
    ]
    if len(pool) < MAX_RELATED:
        pool = [other for other_slug, other in entries.items() if other_slug != slug]

    ranked = sorted(
        pool,
        key=lambda other: (
            _climate_distance(my_climate, other["_climate"]),  # type: ignore[arg-type]
            str(other["name"]),
        ),
    )[:MAX_RELATED]

    out: list[dict[str, object]] = []
    for other in ranked:
        climate: PolygonClimate = other["_climate"]  # type: ignore[assignment]
        best: Sequence[int] = other["_best_order"]  # type: ignore[assignment]
        low, high = min(climate.t), max(climate.t)
        month = MONTH_NAMES[best[0]] if best else ""
        out.append(
            {
                "slug": other["slug"],
                "name": other["name"],
                "sub": f"{low:.0f}–{high:.0f} °C" + (f" · best in {month}" if month else ""),
                "score": max(other["_scores"]),  # type: ignore[arg-type]
            }
        )
    return out


# ─── advisories ──────────────────────────────────────────────────────────


def _date_only(value: object) -> str:
    text = str(value or "")
    return text[:10] if len(text) >= 10 else text


def advisory_summaries(payload: Mapping[str, object] | None) -> dict[str, dict[str, object]]:
    """``advisories.json`` → the ``AdvisorySummary`` shape, keyed by ISO-2.

    A country whose entry has no country-wide ``level`` is omitted: WS-4's
    rule is that a resolved carve-out alone does not make a national claim,
    and the page should say nothing rather than assert "normal precautions"
    on nobody's authority.
    """
    if not payload:
        return {}
    countries = payload.get("countries")
    if not isinstance(countries, list):
        return {}

    out: dict[str, dict[str, object]] = {}
    for entry in countries:
        if not isinstance(entry, dict):
            continue
        iso2 = str(entry.get("iso2", "")).strip().upper()
        level = entry.get("level")
        if not iso2 or not isinstance(level, int):
            continue
        sources = []
        latest = ""
        raw_sources = entry.get("sources")
        if isinstance(raw_sources, list):
            for source in raw_sources:
                if not isinstance(source, dict):
                    continue
                source_id = str(source.get("source", ""))
                source_level = source.get("level")
                if not isinstance(source_level, int):
                    continue
                date = _date_only(source.get("last_changed"))
                latest = max(latest, date)
                row: dict[str, object] = {
                    "gov": SOURCE_DISPLAY_NAMES.get(source_id, source_id),
                    "level": source_level,
                    "label": str(source.get("label", LEVEL_LABELS.get(source_level, ""))),
                    "date": date,
                    "url": str(source.get("url", "")),
                }
                # When this government was last *read*, which is the only
                # field a freshness rule can honestly use: `date` is when the
                # advisory last moved, and a government that has said the same
                # thing for two years is not stale data.
                #
                # Omitted rather than faked when the detail file predates the
                # field, so an old bundle keeps publishing and the web simply
                # cannot judge staleness for it (it does not then guess).
                checked = _date_only(source.get("checked"))
                if checked:
                    row["checked"] = checked
                sources.append(row)
        sources.sort(key=lambda s: str(s["gov"]))
        summary: dict[str, object] = {
            "combined": {"level": level, "label": LEVEL_LABELS[level]},
            "lastUpdated": latest,
            "sources": sources,
        }
        regional_max = entry.get("regional_max")
        if isinstance(regional_max, int):
            # WS-4 kept this out of the tiles on purpose — it names no polygon.
            # The country page is exactly where it belongs.
            summary["regionalMax"] = regional_max
            summary["regionalMaxLabel"] = LEVEL_LABELS[regional_max]
        out[iso2] = summary
    return out


def _region_advisory(
    levels: Mapping[str, int], iso3166_2: str, *, country_level: int | None
) -> dict[str, object]:
    """The ``advisory`` block for one region row, or nothing.

    Emitted only when the region carries a level **worse** than its country's.
    A carve-out equal to the national level tells a reader nothing the
    country-wide panel does not already say, and the region page renders that
    panel too.
    """
    code = (iso3166_2 or "").strip().upper()
    if not code:
        return {}
    level = levels.get(code)
    if not isinstance(level, int):
        return {}
    if country_level is not None and level <= country_level:
        return {}
    return {"advisory": {"level": level, "label": LEVEL_LABELS[level], "code": code}}


def region_advisory_levels(
    payload: Mapping[str, object] | None,
) -> dict[str, dict[str, int]]:
    """``{ISO-2: {ISO-3166-2: level}}`` for carve-outs resolved to a polygon.

    Only the ones a scraper could pin to a subdivision reach here — the
    ``regional-L<n>`` sentinel names no polygon and stays on the country as
    ``regionalMax``.
    """
    if not payload:
        return {}
    countries = payload.get("countries")
    if not isinstance(countries, list):
        return {}
    out: dict[str, dict[str, int]] = {}
    for entry in countries:
        if not isinstance(entry, dict):
            continue
        iso2 = str(entry.get("iso2", "")).strip().upper()
        regions = entry.get("regions")
        if not iso2 or not isinstance(regions, list):
            continue
        levels = {
            str(region.get("code", "")).strip().upper(): region["level"]
            for region in regions
            if isinstance(region, dict) and isinstance(region.get("level"), int)
        }
        if levels:
            out[iso2] = levels
    return out


# ─── the build ───────────────────────────────────────────────────────────


def _region_slugs(names: Sequence[str], codes: Sequence[str]) -> list[str]:
    """Unique URL slugs for one country's regions.

    Two admin-1 units in one country can share a name once diacritics are
    stripped. Left alone, the second one would be unreachable — `findRegion`
    returns the first match — so a colliding slug is suffixed with its
    Natural Earth code, which is unique by construction.
    """
    taken: set[str] = set()
    out: list[str] = []
    for name, code in zip(names, codes):
        base = slugify(name) or slugify(code) or "region"
        slug = base
        if slug in taken:
            slug = f"{base}-{slugify(code)}" if code else base
            counter = 2
            while slug in taken:
                slug = f"{base}-{counter}"
                counter += 1
        taken.add(slug)
        out.append(slug)
    return out


def _polygon_groups(percentiles_df: object) -> dict[str, object]:
    return {str(pid): group for pid, group in percentiles_df.groupby("polygon_id")}


def build_payloads(
    *,
    country_gdf: object,
    admin1_gdf: object,
    country_percentiles: object,
    admin1_percentiles: object,
    capitals: Mapping[str, tuple[str, str]],
    advisories: Mapping[str, dict[str, object]],
    region_levels: Mapping[str, Mapping[str, int]] | None = None,
) -> tuple[dict[str, dict[str, object]], list[str]]:
    """Assemble every country payload. Returns ``(by_slug, skipped_names)``."""
    registry = build_registry(registry_rows_from_gdf(country_gdf))
    areas = land_areas_km2(country_gdf)

    country_groups = _polygon_groups(country_percentiles)
    admin1_groups = _polygon_groups(admin1_percentiles)

    # admin-1 rows grouped by the country they belong to.
    regions_by_iso: dict[str, list[dict[str, object]]] = {}
    for row in admin1_gdf.itertuples(index=False):
        iso2 = str(getattr(row, "iso_a2", "") or "").strip().upper()
        if not iso2:
            continue
        polygon_id = str(getattr(row, "polygon_id", ""))
        props = _widen(
            admin1_groups, polygon_id, representative_latitude(getattr(row, "geometry", None))
        )
        if props is None:
            continue
        climate = polygon_climate(props)
        if climate is None:
            continue
        regions_by_iso.setdefault(iso2, []).append(
            {
                "name": str(getattr(row, "name", "") or polygon_id),
                "code": polygon_id,
                # ISO-3166-2, which is what advisory carve-outs are keyed by.
                # Distinct from `code` above: that is `adm1_code`, unique per
                # polygon, while this is the published subdivision code and is
                # not unique in the 10m layer.
                "iso3166_2": str(getattr(row, "admin1_code", "") or "").strip().upper(),
                "climate": climate,
            }
        )

    # Country-level attributes and geometry, keyed by the ADM0_A3 the country
    # frame uses as its polygon identity.
    country_rows: dict[str, object] = {
        str(getattr(row, "polygon_id", "")): row
        for row in country_gdf.itertuples(index=False)
    }

    entries: dict[str, dict[str, object]] = {}
    skipped: list[str] = []

    for entry in registry:
        row = country_rows.get(entry.adm0_a3)
        regions = regions_by_iso.get(entry.iso2, [])
        climate: PolygonClimate | None = None
        from_regions = False

        if row is not None:
            props = _widen(
                country_groups,
                entry.adm0_a3,
                representative_latitude(getattr(row, "geometry", None)),
            )
            if props is not None:
                climate = polygon_climate(props)

        if climate is None and regions:
            # Suppressed countries have no country-level row by design.
            climate = mean_climate([r["climate"] for r in regions])  # type: ignore[misc]
            from_regions = True

        if climate is None:
            skipped.append(f"{entry.name} ({entry.iso2})")
            continue

        scores = climate.scores()
        best_months, best_order = build_best_months(climate, scores)

        names = [str(r["name"]) for r in regions]
        codes = [str(r["code"]) for r in regions]
        slugs = _region_slugs(names, codes)
        levels_here = (region_levels or {}).get(entry.iso2, {})
        country_advisory = advisories.get(entry.iso2)
        country_advisory_level = (
            country_advisory["combined"]["level"]  # type: ignore[index]
            if isinstance(country_advisory, dict)
            else None
        )
        region_rows: list[dict[str, object]] = []
        for region, slug in sorted(zip(regions, slugs), key=lambda pair: str(pair[0]["name"])):
            region_climate: PolygonClimate = region["climate"]  # type: ignore[assignment]
            region_rows.append(
                {
                    "name": region["name"],
                    "slug": slug,
                    # The admin-1 polygon id — the same `adm1_code` the tiles
                    # carry as a feature's `id`. It is what lets a click on the
                    # map name the exact region rather than one that happens to
                    # slug the same way; the slug above is de-duplicated, so
                    # deriving it from a name alone is ambiguous by design.
                    "code": region["code"],
                    "score": max(region_climate.scores()),
                    **_region_advisory(
                        levels_here,
                        str(region.get("iso3166_2", "")),
                        country_level=country_advisory_level,
                    ),
                    "tl": region_climate.t,
                    "rl": region_climate.rain_day,
                    "sl": region_climate.sun,
                }
            )

        region_span: tuple[float, float] | None = None
        if region_rows:
            annual_means = [
                sum(r["tl"]) / 12  # type: ignore[arg-type]
                for r in region_rows
            ]
            region_span = (min(annual_means), max(annual_means))

        capital = capitals.get(entry.adm0_a3)
        payload: dict[str, object] = {
            "slug": entry.slug,
            "name": entry.name,
            "iso2": entry.iso2,
            "region": entry.region,
            "summary": build_summary(
                name=entry.name,
                climate=climate,
                best_months=best_order,
                region_count=len(region_rows),
                region_temp_span=region_span,
                from_regions=from_regions,
            ),
            "climate": {
                "months": list(MONTH_LABELS),
                "t": climate.t,
                "tMin": climate.t_min,
                "tMax": climate.t_max,
                "r": [round(v, 1) for v in climate.rain_month()],
                "rDay": climate.rain_day,
                "s": climate.sun,
            },
            "bestMonths": best_months,
            "regions": region_rows,
            "monthNotes": build_month_notes(climate),
        }
        if climate.wind is not None:
            payload["climate"]["w"] = climate.wind  # type: ignore[index]
        if capital is not None:
            payload["capital"] = capital[0]
            if capital[1]:
                payload["tz"] = capital[1]
        area = format_area(areas.get(entry.adm0_a3))
        if area is not None:
            payload["area"] = area
        advisory = advisories.get(entry.iso2)
        if advisory is not None:
            payload["advisories"] = advisory
        if from_regions:
            # The map suppresses this country's national colour; anything that
            # renders a single national figure should be able to say so.
            payload["climateBasis"] = "admin1-mean"

        payload["_climate"] = climate
        payload["_scores"] = scores
        payload["_best_order"] = best_order
        entries[entry.slug] = payload

    for slug in entries:
        entries[slug]["related"] = build_related(slug, entries)

    for payload in entries.values():
        for private in ("_climate", "_scores", "_best_order"):
            payload.pop(private, None)

    return entries, skipped


def write_bundle(
    entries: Mapping[str, dict[str, object]],
    *,
    base_dir: Path | None = None,
) -> tuple[int, int]:
    """Write the payloads and the index. Returns ``(changed, pruned)``."""
    target_dir = countries_dir(base_dir)
    changed = 0
    for slug, payload in sorted(entries.items()):
        if write_json_if_changed(payload, target_dir / f"{slug}.json"):
            changed += 1

    pruned = 0
    for stale in sorted(target_dir.glob("*.json")):
        if stale.stem not in entries:
            stale.unlink()
            pruned += 1

    index = {
        "countries": [
            {
                "slug": payload["slug"],
                "name": payload["name"],
                "iso2": payload["iso2"],
                "region": payload["region"],
            }
            for _, payload in sorted(entries.items())
        ]
    }
    if write_json_if_changed(index, index_path(base_dir)):
        changed += 1
    return changed, pruned


def run_publish_api_data(*, base_dir: Path | None = None) -> PublishResult:
    """Read the processed outputs and write the API's country bundle."""
    try:
        import pandas as pd  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("pandas required; run `uv sync`.") from exc

    from wtg_pipeline.pipeline_runner import _load_boundary_frames
    from wtg_pipeline.processing.percentiles import percentiles_path

    country_perc = percentiles_path("country")
    admin1_perc = percentiles_path("admin1")
    for path, level in ((country_perc, "country"), (admin1_perc, "admin1")):
        if not path.exists():
            raise FileNotFoundError(
                f"{path} is missing — run `wtg process aggregate --level {level}` "
                f"and `wtg process percentiles --level {level}` first."
            )

    frames = _load_boundary_frames(("country", "admin1"))
    advisory_payload = read_json(advisories_json_path())
    advisories = advisory_summaries(advisory_payload)
    region_levels = region_advisory_levels(advisory_payload)
    if not advisories:
        log.warning(
            "no advisory detail at %s — country pages will render without the "
            "safety section. Run `wtg process advisories`.",
            advisories_json_path(),
        )

    entries, skipped = build_payloads(
        country_gdf=frames["country"].gdf,
        admin1_gdf=frames["admin1"].gdf,
        country_percentiles=pd.read_parquet(country_perc),
        admin1_percentiles=pd.read_parquet(admin1_perc),
        capitals=load_capitals(),
        advisories=advisories,
        region_levels=region_levels,
    )
    changed, pruned = write_bundle(entries, base_dir=base_dir)

    suppressed_published = sum(
        1
        for payload in entries.values()
        if str(payload.get("iso2")) in SUPPRESSED_COUNTRIES
    )
    log.info(
        "published %d country payload(s) (%d changed, %d pruned); "
        "%d of the %d suppressed countries covered from their regions; "
        "%d country/countries skipped for want of a complete series%s",
        len(entries),
        changed,
        pruned,
        suppressed_published,
        len(SUPPRESSED_COUNTRIES),
        len(skipped),
        f": {', '.join(sorted(skipped))}" if skipped else "",
    )
    return PublishResult(
        index=index_path(base_dir),
        directory=countries_dir(base_dir),
        published=len(entries),
        skipped=tuple(sorted(skipped)),
        changed=changed,
        pruned=pruned,
    )
