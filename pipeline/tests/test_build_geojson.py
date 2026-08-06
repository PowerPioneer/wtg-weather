"""Property-shape and unit tests for `tiles.build_geojson`.

The web's MapLibre paint expressions read short property aliases
(`pref_<mm>`, `t_<mm>`, `r_<mm>`, …) and its legend stops are in display
units; these tests pin both halves of that contract so a rename *or* a unit
regression on either side surfaces immediately.

The percentiles frame these tests build mimics the real one: raw ERA5 SI
units (Kelvin, m/day, m/s, m, J/m²/day).
"""

from __future__ import annotations

import pytest

from wtg_pipeline.tiles.build_geojson import (
    FREE_SOURCE_VARIABLES,
    PREMIUM_SOURCE_VARIABLES,
    SCORE_TO_PREF,
    WEB_PROP_ALIAS,
    widen_percentiles_for_polygon,
    score_props,
    source_variables_for_tier,
    variables_for_tier,
)

pd = pytest.importorskip("pandas")

# SSRD for a bright-but-not-cloudless equatorial month, in J/m²/day.
BRIGHT_SSRD = 13_000_000.0
# Same, for a dim high-latitude winter month.
DIM_SSRD = 2_000_000.0


def _percentiles_frame(rows: list[dict]) -> "pd.DataFrame":
    return pd.DataFrame(rows)


def _row(variable: str, month: int, p50: float) -> dict:
    """One percentiles row; p10/p90 bracket p50 by ±10 %."""
    return {
        "variable": variable,
        "month": month,
        "p10": p50 * 0.9,
        "p50": p50,
        "p90": p50 * 1.1,
    }


def test_widen_converts_si_units_and_emits_short_aliases() -> None:
    df = _percentiles_frame(
        [
            _row("t2m", 1, 297.15),  # Kelvin → 24 °C
            _row("tp", 1, 0.002),  # m/day → 2 mm/day
            _row("ssrd", 1, BRIGHT_SSRD),  # J/m²/day → sunshine hours
        ]
    )
    props = widen_percentiles_for_polygon(df, FREE_SOURCE_VARIABLES, latitude=0.0)

    # Long-form percentiles still emitted (analytical / SSR consumers),
    # now in display units.
    assert props["t2m_p50_01"] == pytest.approx(24.0)
    assert props["tp_p50_01"] == pytest.approx(2.0)

    # Short web aliases for paint expressions.
    assert props["t_01"] == pytest.approx(24.0)
    assert props["r_01"] == pytest.approx(2.0)
    # Sunshine is derived from SSRD, not aggregated — it must exist, and be
    # a plausible number of hours rather than a raw joule count.
    assert 3.0 < props["s_01"] < 10.0


def test_widen_derives_sunshine_from_ssrd_not_passthrough() -> None:
    bright = widen_percentiles_for_polygon(
        _percentiles_frame([_row("ssrd", 6, BRIGHT_SSRD)]),
        FREE_SOURCE_VARIABLES,
        latitude=0.0,
    )
    dim = widen_percentiles_for_polygon(
        _percentiles_frame([_row("ssrd", 6, DIM_SSRD)]),
        FREE_SOURCE_VARIABLES,
        latitude=0.0,
    )
    assert 0.0 <= dim["s_06"] < bright["s_06"] <= 24.0
    # The raw SSRD variable is an input only; it must not reach the tiles.
    assert not any(key.startswith("ssrd") for key in bright)


def test_widen_derives_humidity_and_heat_for_premium() -> None:
    df = _percentiles_frame(
        [
            _row("t2m", 7, 305.15),  # 32 °C
            _row("d2m", 7, 299.15),  # 26 °C dewpoint → humid
        ]
    )
    props = widen_percentiles_for_polygon(df, PREMIUM_SOURCE_VARIABLES, latitude=10.0)

    assert 65.0 < props["hum_07"] < 80.0
    assert props["hum_07"] == props["rh_p50_07"]
    # Hot and humid must feel hotter than the air temperature.
    assert props["heat_07"] > props["t2m_p50_07"]
    # Dewpoint is an input only; it must not reach the tiles.
    assert not any(key.startswith("d2m") for key in props)


def test_widen_handles_nan_p50() -> None:
    df = _percentiles_frame(
        [{"variable": "t2m", "month": 1, "p10": 280.0, "p50": float("nan"), "p90": 290.0}]
    )
    props = widen_percentiles_for_polygon(df, FREE_SOURCE_VARIABLES)
    # NaN p50 → no short alias (paint will fall through to MISSING_FILL).
    assert "t_01" not in props
    assert props["t2m_p10_01"] == pytest.approx(6.85)


def test_every_emitted_variable_has_a_web_alias() -> None:
    # The web can only paint a variable it has a `prop` for; an emitted
    # variable with no alias is invisible on the map.
    for variable in variables_for_tier("premium"):
        assert variable in WEB_PROP_ALIAS


def test_free_tier_emits_every_variable_the_product_sells_as_free() -> None:
    # REBUILD_PLAN.md § Pricing: free is "temp/rain/sun + wind", and the web's
    # display-mode catalog marks temperature / rainfall / sunshine / wind as
    # `tier: "free"`. A mode the picker offers but the tiles have no property
    # for paints entirely missing-grey, which is how wind shipped broken.
    free = variables_for_tier("free")
    for variable in ("t2m", "tp", "sun_hours", "si10"):
        assert variable in free, f"{variable} is sold as free but is not emitted"


def test_free_tier_withholds_premium_variables() -> None:
    # The tier boundary is a file boundary — free.pmtiles is served to
    # unauthenticated users, so anything in it is effectively public.
    free = variables_for_tier("free")
    for variable in ("sd", "sst", "rh", "heat"):
        assert variable not in free, f"{variable} is premium but leaks into free tiles"


def test_source_variables_include_derivation_inputs() -> None:
    # `ssrd` and `d2m` are never emitted but must be read, or sunshine and
    # humidity silently vanish from the tiles.
    assert "ssrd" in source_variables_for_tier("free")
    assert "d2m" in source_variables_for_tier("premium")


def test_web_prop_alias_covers_premium_variables() -> None:
    # If a new variable lands in the pipeline output, the web's display-mode
    # `prop` field needs a matching alias entry — pin the current contract.
    assert WEB_PROP_ALIAS["t2m"] == "t"
    assert WEB_PROP_ALIAS["tp"] == "r"
    assert WEB_PROP_ALIAS["sun_hours"] == "s"
    assert WEB_PROP_ALIAS["si10"] == "w"
    assert WEB_PROP_ALIAS["sd"] == "snow"
    assert WEB_PROP_ALIAS["sst"] == "sst"
    assert WEB_PROP_ALIAS["rh"] == "hum"
    assert WEB_PROP_ALIAS["heat"] == "heat"


def test_score_to_pref_centroids_fall_in_web_bins() -> None:
    # Mirror of web/src/lib/scoring.ts SCORE_BINS:
    # avoid <50, acceptable 50-69, good 70-84, perfect ≥85.
    assert SCORE_TO_PREF[0] < 50
    assert 50 <= SCORE_TO_PREF[1] <= 69
    assert 70 <= SCORE_TO_PREF[2] <= 84
    assert SCORE_TO_PREF[3] >= 85


def _pref_for(t2m_k: float, tp_m: float, ssrd: float, *, latitude: float) -> int:
    converted = widen_percentiles_for_polygon(
        _percentiles_frame(
            [_row("t2m", 1, t2m_k), _row("tp", 1, tp_m), _row("ssrd", 1, ssrd)]
        ),
        FREE_SOURCE_VARIABLES,
        latitude=latitude,
    )
    return score_props(converted)["pref_01"]


def test_scores_vary_across_climates() -> None:
    """The regression guard: raw SI units scored every polygon identically.

    A warm, dry, sunny polygon and a freezing, wet, dark one must not land
    in the same bin — that flat result is exactly what shipped a single
    orange map to production.
    """
    mediterranean = _pref_for(297.15, 0.0005, BRIGHT_SSRD, latitude=0.0)  # 24 °C, 0.5 mm/day
    polar = _pref_for(258.15, 0.006, DIM_SSRD, latitude=70.0)  # -15 °C, 6 mm/day

    assert mediterranean >= 85, "warm/dry/sunny should read as a perfect match"
    assert polar < 50, "freezing/wet/dark should read as avoid"
    assert mediterranean != polar


def test_missing_climate_data_scores_lowest() -> None:
    assert score_props({})["pref_01"] == SCORE_TO_PREF[0]


class _Geom:
    """Minimal stand-in for a shapely geometry."""

    __geo_interface__ = {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}

    def representative_point(self):
        return self

    @property
    def y(self) -> float:
        return 0.0


def _build_input(level: str):
    from wtg_pipeline.tiles.build_geojson import BuildInput

    polygons = pd.DataFrame(
        {
            "polygon_id": ["p1"],
            "iso_a2": ["PE"],
            "name": ["Somewhere"],
            "admin1_code": [""],
            "geometry": [_Geom()],
        }
    )
    percentiles = pd.DataFrame(
        [
            {"polygon_id": "p1", **_row("t2m", 1, 297.15)},
            {"polygon_id": "p1", **_row("tp", 1, 0.002)},
            {"polygon_id": "p1", **_row("ssrd", 1, BRIGHT_SSRD)},
        ]
    )
    return BuildInput(
        level=level,
        polygons_gdf=polygons,
        id_col="polygon_id",
        iso_a2_col="iso_a2",
        name_col="name",
        admin1_code_col="admin1_code",
        percentiles_df=percentiles,
    )


def test_admin1_of_a_suppressed_country_is_never_zoom_hinted() -> None:
    """The mosaic exception.

    Suppressed countries emit no country-level row, so the web paints their
    admin-1 polygons as a mosaic below zoom 3. A `minzoom: 3` hint would empty
    that mosaic and put Argentina, Chile and Kazakhstan back to being holes at
    world zoom -- the exact bug this change set exists to fix.
    """
    from wtg_pipeline.tiles.build_geojson import feature_min_zoom

    for iso in ("AR", "CL", "KZ", "RU", "US"):
        assert feature_min_zoom("admin1", iso) is None, iso


def test_admin1_of_a_normal_country_is_hinted_to_the_handover_zoom() -> None:
    from wtg_pipeline.tiles.build_geojson import feature_min_zoom

    for iso in ("PE", "FR", "GE", "BE"):
        assert feature_min_zoom("admin1", iso) == 3, iso
    # Country is the world-view layer and must never be hinted away.
    assert feature_min_zoom("country", "PE") is None
    # admin-2 is premium-only and never renders below 6, suppressed or not.
    assert feature_min_zoom("admin2", "AR") == 6


def test_admin2_features_carry_a_tippecanoe_minzoom_hint() -> None:
    # Tippecanoe's -Z is global, so without this admin-2 is tiled from zoom 0
    # and its polygons crowd out country/admin-1 in world-view tiles that
    # never display a district anyway.
    from wtg_pipeline.tiles.build_geojson import build_feature_collection

    fc = build_feature_collection(_build_input("admin2"), tier="premium")
    feature = fc["features"][0]
    assert feature["tippecanoe"] == {"minzoom": 6}


def test_country_level_carries_no_zoom_hint() -> None:
    # Country is what the world view renders; it must never be hinted away.
    from wtg_pipeline.tiles.build_geojson import build_feature_collection

    fc = build_feature_collection(_build_input("country"), tier="free")
    assert "tippecanoe" not in fc["features"][0]


def test_admin1_carries_the_handover_zoom_hint() -> None:
    # The fixture polygon is Peruvian, i.e. not a suppressed country, so it is
    # hinted to the zoom the web actually starts drawing admin-1 at.
    from wtg_pipeline.tiles.build_geojson import build_feature_collection

    fc = build_feature_collection(_build_input("admin1"), tier="free")
    assert fc["features"][0]["tippecanoe"] == {"minzoom": 3}
