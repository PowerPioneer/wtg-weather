"""Property-shape tests for `tiles.build_geojson`.

The web's MapLibre paint expressions read short property aliases
(`pref_<mm>`, `t_<mm>`, `r_<mm>`, …); these tests pin that contract so a
rename on either side surfaces immediately.
"""

from __future__ import annotations

import pytest

from wtg_pipeline.tiles.build_geojson import (
    SCORE_TO_PREF,
    WEB_PROP_ALIAS,
    _widen_percentiles_for_polygon,
)

pd = pytest.importorskip("pandas")


def _percentiles_frame(rows: list[dict]) -> "pd.DataFrame":
    return pd.DataFrame(rows)


def test_widen_emits_short_aliases_alongside_percentile_keys() -> None:
    df = _percentiles_frame(
        [
            {"variable": "t2m", "month": 1, "p10": 10.0, "p50": 12.0, "p90": 14.0},
            {"variable": "tp", "month": 1, "p10": 1.0, "p50": 2.0, "p90": 3.0},
            {"variable": "sun_hours", "month": 1, "p10": 5.0, "p50": 7.0, "p90": 9.0},
        ]
    )
    props = _widen_percentiles_for_polygon(df, ("t2m", "tp", "sun_hours"))

    # Long-form percentiles still emitted (analytical / SSR consumers).
    assert props["t2m_p50_01"] == 12.0
    assert props["tp_p10_01"] == 1.0

    # Short web aliases for paint expressions.
    assert props["t_01"] == 12.0
    assert props["r_01"] == 2.0
    assert props["s_01"] == 7.0


def test_widen_handles_nan_p50() -> None:
    df = _percentiles_frame(
        [{"variable": "t2m", "month": 1, "p10": 1.0, "p50": float("nan"), "p90": 5.0}]
    )
    props = _widen_percentiles_for_polygon(df, ("t2m",))
    # NaN p50 → no short alias (paint will fall through to MISSING_FILL).
    assert "t_01" not in props
    assert "t2m_p10_01" in props


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


def test_score_to_pref_centroids_fall_in_web_bins() -> None:
    # Mirror of web/src/lib/scoring.ts SCORE_BINS:
    # avoid <50, acceptable 50-69, good 70-84, perfect ≥85.
    assert SCORE_TO_PREF[0] < 50
    assert 50 <= SCORE_TO_PREF[1] <= 69
    assert 70 <= SCORE_TO_PREF[2] <= 84
    assert SCORE_TO_PREF[3] >= 85
