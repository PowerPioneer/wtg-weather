"""The premium four, per country, for the API's entitlement-gated endpoint.

Country pages are statically generated, so one HTML document serves every
visitor and anything in the free bundle is public in view-source. That is why
``publish api-data`` emits free-tier variables only, and why
``test_publish_api_data.py`` pins it. Snow depth, sea surface temperature,
humidity and heat index — the four the Premium tier sells — are published
**here instead**, beside the free bundle and never inside it:

    data/final/api/
      index.json          free; the web builds its route tree from it
      countries/<slug>    free; baked into the static pages
      premium/<slug>      premium; read only by `/api/countries/{slug}/premium`

The API reads ``premium/`` behind a session and entitlement check, and the
country page fetches it from the browser after hydration, for a premium
visitor only. So the tier boundary is still a file boundary, as it is for the
tiles: nothing the static build reads contains a premium number.

The series are the same ones the premium tiles carry and the map's climate
panel charts (``SHIPPED_MONTHLY_PREFIXES``: ``snow``/``sst``/``hum``/``heat``
and the ``sd``/``sst`` p10–p90 envelopes), widened by the same function, so a
premium visitor sees one number for a country whether they read it on the map
or on the page.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Iterable, Mapping

from wtg_pipeline.processing.advisories import write_json_if_changed
from wtg_pipeline.processing.country_registry import build_registry, registry_rows_from_gdf
from wtg_pipeline.publish.api_data import _mean_series, _polygon_groups, _twelve, api_dir
from wtg_pipeline.tiles.build_geojson import (
    PREMIUM_SOURCE_VARIABLES,
    representative_latitude,
    widen_percentiles_for_polygon,
)

log = logging.getLogger(__name__)

#: Payload key → the tile alias it is read from.
PREMIUM_SERIES: tuple[tuple[str, str], ...] = (
    ("snow", "snow"),
    ("sst", "sst"),
    ("humidity", "hum"),
    ("heat", "heat"),
)

#: Payload key → the envelope's (low, high) source keys. Only the two variables
#: still aggregated monthly have one; see ``SHIPPED_MONTHLY_PREFIXES``.
PREMIUM_BANDS: dict[str, tuple[str, str]] = {
    "snow": ("sd_p10", "sd_p90"),
    "sst": ("sst_p10", "sst_p90"),
}


def premium_dir(base_dir: Path | None = None) -> Path:
    path = api_dir(base_dir) / "premium"
    path.mkdir(parents=True, exist_ok=True)
    return path


def premium_series(props: Mapping[str, float]) -> dict[str, list[float]]:
    """Every complete premium series in one polygon's widened props.

    A series with a hole is left out rather than published with one — the same
    rule the free bundle applies. Landlocked countries have no sea temperature
    and that is the normal case, not an error.
    """
    out: dict[str, list[float]] = {}
    for key, alias in PREMIUM_SERIES:
        series = _twelve(props, alias)
        if series is None:
            continue
        out[key] = series
        band = PREMIUM_BANDS.get(key)
        if band is not None:
            low, high = _twelve(props, band[0]), _twelve(props, band[1])
            # Both edges or neither: a half-drawn envelope is worse than none.
            if low is not None and high is not None:
                out[f"{key}BandLow"] = low
                out[f"{key}BandHigh"] = high
    return out


def _mean_of(parts: list[dict[str, list[float]]]) -> dict[str, list[float]]:
    """Per-key mean over the regions that *all* carry it.

    The suppressed countries' free payload is the mean of their admin-1 rows;
    this is its premium counterpart, with the free bundle's rule that a key
    missing from any region is dropped rather than averaged over a subset.
    """
    if not parts:
        return {}
    keys = set(parts[0]).intersection(*parts[1:])
    return {key: _mean_series([p[key] for p in parts]) for key in sorted(keys)}


def build_premium_payloads(
    *,
    country_gdf: object,
    admin1_gdf: object,
    country_percentiles: object,
    admin1_percentiles: object,
    published: Iterable[str],
) -> dict[str, dict[str, object]]:
    """One premium payload per published slug that has any premium series."""
    wanted = set(published)
    country_groups = _polygon_groups(country_percentiles)
    admin1_groups = _polygon_groups(admin1_percentiles)

    def widen(groups: Mapping[str, object], polygon_id: str, geometry: object):
        group = groups.get(polygon_id)
        if group is None:
            return None
        return widen_percentiles_for_polygon(
            group, PREMIUM_SOURCE_VARIABLES, latitude=representative_latitude(geometry)
        )

    regions_by_iso: dict[str, list[dict[str, list[float]]]] = {}
    for row in admin1_gdf.itertuples(index=False):  # type: ignore[attr-defined]
        iso2 = str(getattr(row, "iso_a2", "") or "").strip().upper()
        props = widen(admin1_groups, str(getattr(row, "polygon_id", "")), getattr(row, "geometry", None))
        if iso2 and props is not None:
            regions_by_iso.setdefault(iso2, []).append(premium_series(props))

    rows = {
        str(getattr(row, "polygon_id", "")): row
        for row in country_gdf.itertuples(index=False)  # type: ignore[attr-defined]
    }
    out: dict[str, dict[str, object]] = {}
    for entry in build_registry(registry_rows_from_gdf(country_gdf)):
        if entry.slug not in wanted:
            continue
        row = rows.get(entry.adm0_a3)
        props = widen(country_groups, entry.adm0_a3, getattr(row, "geometry", None)) if row else None
        series = premium_series(props) if props is not None else {}
        if not series:
            series = _mean_of(regions_by_iso.get(entry.iso2, []))
        if series:
            out[entry.slug] = {"slug": entry.slug, **series}
    return out


def write_premium_bundle(
    payloads: Mapping[str, dict[str, object]], *, base_dir: Path | None = None
) -> tuple[int, int]:
    """Write ``premium/<slug>.json``. Returns ``(changed, pruned)``."""
    target = premium_dir(base_dir)
    changed = sum(
        1 for slug, payload in sorted(payloads.items())
        if write_json_if_changed(payload, target / f"{slug}.json")
    )
    pruned = 0
    for stale in sorted(target.glob("*.json")):
        if stale.stem not in payloads:
            stale.unlink()
            pruned += 1
    if not payloads:
        log.warning(
            "no premium series for any country — the percentile Parquet may "
            "predate the premium variables. Premium visitors will see the teaser."
        )
    return changed, pruned
