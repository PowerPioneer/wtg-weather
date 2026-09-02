"""Property-shape and unit tests for `tiles.build_geojson`.

The web's MapLibre paint expressions read short property aliases
(`pref_<mm>`, `t_<mm>`, `r_<mm>`, …) and its legend stops are in display
units; these tests pin both halves of that contract so a rename *or* a unit
regression on either side surfaces immediately.

The percentiles frame these tests build mimics the real one: raw ERA5 SI
units (Kelvin, m/day, m/s, m), carrying the daily shape's `mean`/`p5`/`p95`
alongside `p50`. Sunshine arrives already derived, in hours — it is no longer
converted here, because it is non-linear in SSRD and so has to be computed per
day upstream.
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

# Sunshine now arrives from the percentile stage already in hours: it is
# non-linear in SSRD, so the mean of the converted daily values is not the
# conversion of the mean, and it has to be derived per day upstream.
BRIGHT_SUN = 9.1   # a sunny tropical day
DIM_SUN = 0.4      # a dark high-latitude winter one


def _percentiles_frame(rows: list[dict]) -> "pd.DataFrame":
    return pd.DataFrame(rows)


def _row(variable: str, month: int, value: float) -> dict:
    """One daily-shaped row; p5/p95 bracket the mean by ±20 %."""
    return {
        "variable": variable,
        "month": month,
        "mean": value,
        "p50": value,
        "p5": value * 0.8,
        "p95": value * 1.2,
    }


def test_widen_converts_si_units_and_emits_short_aliases() -> None:
    df = _percentiles_frame(
        [
            _row("t2m_max", 1, 302.15),  # Kelvin → 29 °C daytime high
            _row("t2m_min", 1, 291.15),  # Kelvin → 18 °C overnight low
            _row("tp_sum", 1, 0.002),  # m/day → 2 mm/day
            _row("sun_hours", 1, BRIGHT_SUN),  # already hours
        ]
    )
    props = widen_percentiles_for_polygon(df, FREE_SOURCE_VARIABLES, latitude=0.0)

    # Long-form statistics still emitted (analytical / SSR consumers),
    # now in display units.
    assert props["t2m_max_mean_01"] == pytest.approx(29.0)
    assert props["t2m_min_mean_01"] == pytest.approx(18.0)
    assert props["tp_mean_01"] == pytest.approx(2.0)

    # The band the premium charts shade.
    assert props["t2m_max_p95_01"] > props["t2m_max_mean_01"]
    assert props["t2m_min_p5_01"] < props["t2m_min_mean_01"]

    # Short web aliases for paint expressions. `t` is the daily maximum.
    assert props["t_01"] == pytest.approx(29.0)
    assert props["tmin_01"] == pytest.approx(18.0)
    assert props["r_01"] == pytest.approx(2.0)
    assert props["s_01"] == pytest.approx(BRIGHT_SUN)


def test_sunshine_arrives_in_hours_and_is_not_reconverted() -> None:
    """Derived per day upstream now, because it is non-linear in SSRD."""
    bright = widen_percentiles_for_polygon(
        _percentiles_frame([_row("sun_hours", 6, BRIGHT_SUN)]),
        FREE_SOURCE_VARIABLES,
    )
    dim = widen_percentiles_for_polygon(
        _percentiles_frame([_row("sun_hours", 6, DIM_SUN)]),
        FREE_SOURCE_VARIABLES,
    )
    assert 0.0 <= dim["s_06"] < bright["s_06"] <= 24.0
    assert bright["s_06"] == pytest.approx(BRIGHT_SUN)
    # The raw SSRD variable must never reach the tiles.
    assert not any(key.startswith("ssrd") for key in bright)


def test_day_counts_pass_through_unconverted() -> None:
    """A count of days is already in its final unit."""
    props = widen_percentiles_for_polygon(
        _percentiles_frame([_row("wet_days", 4, 9.0), _row("sunny_days", 4, 12.0)]),
        FREE_SOURCE_VARIABLES,
    )
    assert props["wet_04"] == pytest.approx(9.0)
    assert props["sunny_04"] == pytest.approx(12.0)


def test_widen_derives_humidity_and_heat_for_premium() -> None:
    df = _percentiles_frame(
        [
            _row("t2m_mean", 7, 305.15),  # 32 °C mean
            _row("t2m_max", 7, 310.15),  # 37 °C daytime high
            _row("d2m_mean", 7, 299.15),  # 26 °C dewpoint → humid
        ]
    )
    props = widen_percentiles_for_polygon(df, PREMIUM_SOURCE_VARIABLES, latitude=10.0)

    assert 65.0 < props["hum_07"] < 80.0
    assert props["hum_07"] == props["rh_p50_07"]
    # Hot and humid must feel hotter than the air temperature.
    assert props["heat_07"] > props["t2m_max_mean_07"]
    # Both derivation inputs are inputs only; neither may reach the tiles.
    assert not any(key.startswith("d2m") for key in props)
    assert not any(key.startswith("t2m_mean") for key in props)


def test_heat_index_is_built_on_the_daily_maximum() -> None:
    """Feels-like answers how hot it gets, not how hot it averages.

    Building it on the 24-hour mean understates it by most of the diurnal
    range, and understates it most in the dry-heat places where the warning
    matters most.
    """
    humid = [_row("d2m_mean", 7, 299.15), _row("t2m_mean", 7, 305.15)]
    without_max = widen_percentiles_for_polygon(
        _percentiles_frame(humid), PREMIUM_SOURCE_VARIABLES
    )
    with_max = widen_percentiles_for_polygon(
        _percentiles_frame(humid + [_row("t2m_max", 7, 310.15)]),
        PREMIUM_SOURCE_VARIABLES,
    )
    assert with_max["heat_07"] > without_max["heat_07"]


def test_widen_handles_nan_p50() -> None:
    df = _percentiles_frame(
        [
            {
                "variable": "t2m_max",
                "month": 1,
                "mean": float("nan"),
                "p50": float("nan"),
                "p5": 280.0,
                "p95": 290.0,
            }
        ]
    )
    props = widen_percentiles_for_polygon(df, FREE_SOURCE_VARIABLES)
    # No headline statistic → no short alias (paint falls through to
    # MISSING_FILL) even though the band statistics survived.
    assert "t_01" not in props
    assert props["t2m_max_p5_01"] == pytest.approx(6.85)


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
    for variable in ("t2m_max", "t2m_min", "tp", "sun_hours", "si10"):
        assert variable in free, f"{variable} is sold as free but is not emitted"


def test_free_tier_withholds_premium_variables() -> None:
    # The tier boundary is a file boundary — free.pmtiles is served to
    # unauthenticated users, so anything in it is effectively public.
    free = variables_for_tier("free")
    for variable in ("sd", "sst", "rh", "heat"):
        assert variable not in free, f"{variable} is premium but leaks into free tiles"


def test_source_variables_include_derivation_inputs() -> None:
    # `t2m_mean` and `d2m_mean` are never emitted but must be read, or
    # humidity and the heat index silently vanish from the tiles.
    assert "t2m_mean" in source_variables_for_tier("premium")
    assert "d2m_mean" in source_variables_for_tier("premium")


def test_web_prop_alias_covers_premium_variables() -> None:
    # If a new variable lands in the pipeline output, the web's display-mode
    # `prop` field needs a matching alias entry — pin the current contract.
    assert WEB_PROP_ALIAS["t2m_max"] == "t"
    assert WEB_PROP_ALIAS["t2m_min"] == "tmin"
    assert WEB_PROP_ALIAS["wet_days"] == "wet"
    assert WEB_PROP_ALIAS["sunny_days"] == "sunny"
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


def _pref_for(
    tmax_k: float, tmin_k: float, tp_m: float, sun_h: float, *, latitude: float = 0.0
) -> int:
    converted = widen_percentiles_for_polygon(
        _percentiles_frame(
            [
                _row("t2m_max", 1, tmax_k),
                _row("t2m_min", 1, tmin_k),
                _row("tp_sum", 1, tp_m),
                _row("sun_hours", 1, sun_h),
            ]
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
    mediterranean = _pref_for(299.15, 291.15, 0.0005, BRIGHT_SUN)  # 26/18 °C
    polar = _pref_for(258.15, 248.15, 0.006, DIM_SUN, latitude=70.0)  # -15/-25 °C

    assert mediterranean >= 85, "warm/dry/sunny should read as a perfect match"
    assert polar < 50, "freezing/wet/dark should read as avoid"
    assert mediterranean != polar


def test_a_sticky_tropical_night_is_scored_against() -> None:
    """The case the paired temperature exists for.

    30 °C days with 27 °C nights averaged to 28.5 °C, which the old
    single-mean rule called perfect. The night is now scored on its own terms.
    """
    comfortable = _pref_for(303.15, 290.15, 0.0005, BRIGHT_SUN)  # 30/17 °C
    sticky = _pref_for(303.15, 300.15, 0.0005, BRIGHT_SUN)  # 30/27 °C
    assert comfortable > sticky


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
            {"polygon_id": "p1", **_row("t2m_max", 1, 302.15)},
            {"polygon_id": "p1", **_row("t2m_min", 1, 291.15)},
            {"polygon_id": "p1", **_row("tp_sum", 1, 0.002)},
            {"polygon_id": "p1", **_row("sun_hours", 1, BRIGHT_SUN)},
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
    # admin-2 is premium-only and never renders below 7, suppressed or not.
    # 7 rather than 6 because a z6 tile cannot carry the level whole: the
    # 2026-08-30 build put 92 of the 189 Dutch municipalities intersecting
    # tile 6/32/21 into it and left 32.8% of the country uncovered, which
    # the map drew as background once admin-1 stopped. Mirrors
    # ZOOM_ADMIN2_MIN in web/src/lib/map-style.ts.
    assert feature_min_zoom("admin2", "AR") == 7


def test_admin2_features_carry_a_tippecanoe_minzoom_hint() -> None:
    # Tippecanoe's -Z is global, so without this admin-2 is tiled from zoom 0
    # and its polygons crowd out country/admin-1 in world-view tiles that
    # never display a district anyway.
    from wtg_pipeline.tiles.build_geojson import build_feature_collection

    fc = build_feature_collection(_build_input("admin2"), tier="premium")
    feature = fc["features"][0]
    assert feature["tippecanoe"] == {"minzoom": 7}


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


def test_every_scored_variable_is_one_the_scoring_rule_knows() -> None:
    """The guard for a failure that is invisible at runtime.

    `score_props` builds its dict from SCORED_VARIABLES and `polygon_score`
    ignores any key it has no preference for. So renaming a variable on one
    side and not the other does not raise, does not warn, and does not change
    the shape of anything — it silently drops that variable from the score and
    paints a map that looks entirely plausible.

    This caught exactly that when `t2m` became `t2m_max`/`t2m_min`: temperature
    stopped being scored at all and every test still passed.
    """
    from wtg_pipeline.processing.scoring import DEFAULT_PREFERENCES as PREFS
    from wtg_pipeline.tiles.build_geojson import SCORED_VARIABLES

    known = {p.variable for p in PREFS}
    assert set(SCORED_VARIABLES) == known, (
        "SCORED_VARIABLES and scoring.DEFAULT_PREFERENCES have drifted; "
        "a variable in one and not the other is silently unscored"
    )


def test_every_scored_variable_is_actually_emitted() -> None:
    """A scored variable with no emitted property can never be read back.

    `score_props` reads out of the props dict `widen_percentiles_for_polygon`
    produced, so a variable the tiles do not emit scores as absent.
    """
    from wtg_pipeline.tiles.build_geojson import SCORED_VARIABLES

    emitted = set(variables_for_tier("free"))
    for variable in SCORED_VARIABLES:
        assert variable in emitted, f"{variable} is scored but never emitted"
