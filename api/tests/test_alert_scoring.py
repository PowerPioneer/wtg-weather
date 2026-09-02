"""`services/alert_scoring.py` — the third copy of the scoring rule.

Two things are under test. First that the copy agrees with the pipeline's,
which is pinned against the pipeline's *source text* rather than a
hand-transcribed table, exactly as `web/src/lib/scoring.test.ts` does it:
transcribing the numbers into the test would only prove the transcription
matches itself. Second that reading the published bundle fails in the right
direction — absent data must never read as "stopped matching".
"""

from __future__ import annotations

import re
import uuid
from pathlib import Path

import pytest

from wtg_api.models import Alert
from wtg_api.services.alert_scoring import (
    BUCKET_SCORES,
    DEFAULT_PREFERENCES,
    BundleMatchScorer,
    WeatherPreferences,
    parse_preferences,
    preference_ranges,
    preference_score,
    score_bucket,
)

PIPELINE = Path(__file__).resolve().parents[2] / "pipeline" / "src" / "wtg_pipeline"


def pipeline_source(relative: str) -> str:
    return (PIPELINE / relative).read_text(encoding="utf-8")


def alert(**kwargs) -> Alert:
    kwargs.setdefault("user_id", uuid.uuid4())
    kwargs.setdefault("country_iso2", "PE")
    kwargs.setdefault("month", 4)
    kwargs.setdefault("preferences", {})
    return Alert(**kwargs)


# ─── parity with the pipeline ────────────────────────────────────────────


def test_default_ranges_and_buffers_match_the_pipeline() -> None:
    source = pipeline_source("processing/scoring.py")
    block = re.search(
        r"DEFAULT_PREFERENCES:\s*tuple\[VariablePreference,\s*\.\.\.\]\s*=\s*\(([\s\S]*?)\n\)",
        source,
    )
    assert block, "could not locate DEFAULT_PREFERENCES in scoring.py"

    # `[^)]*` after buffer so a new keyword on the constructor — `concern`
    # was added when temperature split into day and night — widens the table
    # rather than silently matching nothing. The previous pattern required
    # the call to close right after `buffer=`, so it found zero entries and
    # the failure read "0 == 3" instead of naming what had changed.
    python = {
        m[1]: (float(m[2]), float(m[3]), float(m[4]))
        for m in re.finditer(
            r'VariablePreference\(\s*"(\w+)",\s*lo=([-\d.]+),\s*hi=([-\d.]+),'
            r"\s*buffer=([-\d.]+)[^)]*\)",
            block[1],
        )
    }
    assert python, "regex matched no VariablePreference entries — has the call shape changed?"

    # Keyed by variable rather than positional: this asserts the *rule*, and
    # the two files order it differently on purpose (see `preference_ranges`).
    day, rain, sun, night = preference_ranges(DEFAULT_PREFERENCES)
    assert (day.lo, day.hi, day.buffer) == python["t2m_max"]
    assert (night.lo, night.hi, night.buffer) == python["t2m_min"]
    assert (rain.lo, rain.hi, rain.buffer) == python["tp"]
    assert (sun.lo, sun.hi, sun.buffer) == python["sun_hours"]

    # Four variables, three concerns: temperature speaks once. Pinned because
    # a fourth concern would quietly loosen every threshold — one miss out of
    # four is a milder complaint than one out of three.
    assert len(python) == 4
    assert {r.concern for r in (day, rain, sun, night)} == {"temperature", "rain", "sun"}


def test_bucket_scores_match_score_to_pref() -> None:
    source = pipeline_source("tiles/build_geojson.py")
    block = re.search(r"SCORE_TO_PREF:\s*dict\[int,\s*int\]\s*=\s*\{([^}]*)\}", source)
    assert block, "could not locate SCORE_TO_PREF in build_geojson.py"
    python = {int(m[1]): int(m[2]) for m in re.finditer(r"(\d+):\s*(\d+)", block[1])}
    assert python == dict(enumerate(BUCKET_SCORES))


@pytest.mark.parametrize(
    ("values", "expected"),
    [
        ((26.0, 1.0, 7.0), 3),  # all three inside their range
        ((32.0, 1.0, 7.0), 2),  # temp inside the buffer only (22-30, buffer to 33)
        ((40.0, 1.0, 7.0), 1),  # temp beyond the buffer
        ((40.0, 9.0, 7.0), 0),  # two beyond the buffer
        ((40.0, 9.0, 0.5), 0),  # three beyond the buffer is still the floor
    ],
)
def test_bucket_rule(values: tuple[float, float, float], expected: int) -> None:
    assert score_bucket(list(values)) == expected
    assert preference_score(list(values)) == BUCKET_SCORES[expected]


def test_no_data_scores_none_not_zero() -> None:
    """The distinction the map draws as grey-versus-red, and the job as quiet."""
    assert score_bucket([None, None, None]) is None
    assert preference_score([None, None, None]) is None


# ─── preference parsing ──────────────────────────────────────────────────


def test_empty_preferences_fall_back_to_defaults() -> None:
    assert parse_preferences({}) == DEFAULT_PREFERENCES
    assert parse_preferences(None) == DEFAULT_PREFERENCES
    assert parse_preferences("nonsense") == DEFAULT_PREFERENCES


def test_partial_preferences_keep_the_defaults_for_the_rest() -> None:
    assert parse_preferences({"tempMin": 25}) == WeatherPreferences(
        temp_min=25.0, temp_max=30.0, rain_max=2.7, sun_min=6.0
    )


def test_out_of_range_preferences_are_clamped_not_rejected() -> None:
    prefs = parse_preferences({"tempMin": -500, "tempMax": 500, "rainMax": 999, "sunMin": 99})
    assert prefs == WeatherPreferences(
        temp_min=-10.0, temp_max=45.0, rain_max=12.0, sun_min=13.0
    )


def test_inverted_temperature_band_is_swapped() -> None:
    prefs = parse_preferences({"tempMin": 30, "tempMax": 10})
    assert (prefs.temp_min, prefs.temp_max) == (10.0, 30.0)


def test_non_numeric_and_nan_preferences_are_ignored() -> None:
    prefs = parse_preferences(
        {"tempMin": "hot", "tempMax": True, "rainMax": float("nan"), "sunMin": float("inf")}
    )
    assert prefs == DEFAULT_PREFERENCES


# ─── reading the bundle ──────────────────────────────────────────────────


def test_scores_a_country_month_from_the_bundle(published_bundle) -> None:
    published_bundle.publish(temp=22.0, rain_day=1.0, sun=7.0)
    outcome = BundleMatchScorer().score(alert())
    assert outcome is not None
    assert outcome.score == 90
    assert outcome.matches is True
    assert outcome.place == "Peru"
    assert outcome.path == "/peru/april"


def test_a_poor_month_scores_but_does_not_match(published_bundle) -> None:
    published_bundle.publish(temp=40.0, rain_day=9.0, sun=1.0)
    outcome = BundleMatchScorer().score(alert())
    assert outcome is not None
    assert (outcome.score, outcome.matches) == (25, False)


def test_per_month_series_is_read_at_the_alerts_month(published_bundle) -> None:
    warm = [5.0] * 12
    warm[3] = 22.0
    published_bundle.publish(temp=warm, rain_day=1.0, sun=7.0)
    scorer = BundleMatchScorer()
    assert scorer.score(alert(month=4)).score == 90
    # January's 5 °C is 13 below the band's lower buffer.
    assert scorer.score(alert(month=1)).score == 60


def test_region_alert_reads_the_regions_own_series(published_bundle) -> None:
    published_bundle.publish(
        temp=22.0,
        regions=[published_bundle.region(name="Cusco", code="PER-1234", temp=13.0)],
    )
    outcome = BundleMatchScorer().score(alert(region_code="PER-1234"))
    assert outcome is not None
    assert outcome.place == "Cusco, Peru"
    # Country would be 90; the region's 13 °C is outside the buffer.
    assert (outcome.score, outcome.matches) == (60, False)


def test_unknown_region_scores_nothing_rather_than_the_country(published_bundle) -> None:
    """A region that vanished with a boundary vintage must not silently
    become the national average — that answers a different question."""
    published_bundle.publish(regions=[published_bundle.region(code="PER-1234")])
    assert BundleMatchScorer().score(alert(region_code="PER-9999")) is None


def test_unpublished_country_scores_nothing(published_bundle) -> None:
    published_bundle.publish(slug="peru", iso2="PE")
    assert BundleMatchScorer().score(alert(country_iso2="ZW")) is None


def test_missing_bundle_raises_rather_than_scoring_zero(tmp_path: Path, monkeypatch) -> None:
    """`load_index` is loud when the mount is missing. The job turns that into
    one fatal error, not 400 alerts each reporting "stopped matching"."""
    from wtg_api.config import get_settings
    from wtg_api.services import country_data

    monkeypatch.setattr(get_settings(), "country_data_dir", str(tmp_path / "nope"))
    country_data.reset_cache()
    with pytest.raises(country_data.CountryDataUnavailable):
        BundleMatchScorer().score(alert())
    country_data.reset_cache()


def test_month_less_alert_scores_its_best_month(published_bundle) -> None:
    temps = [5.0] * 12
    temps[6] = 22.0
    published_bundle.publish(temp=temps, rain_day=1.0, sun=7.0)
    outcome = BundleMatchScorer().score(alert(month=None))
    assert outcome is not None
    assert (outcome.score, outcome.month) == (90, None)
    assert outcome.path == "/peru/july"


def test_alert_preferences_change_the_verdict(published_bundle) -> None:
    published_bundle.publish(temp=32.0, rain_day=1.0, sun=7.0)
    scorer = BundleMatchScorer()
    # 32 °C is inside the daytime band's buffer (22–30, so 19–33) but outside
    # its range.
    assert scorer.score(alert()).score == 75
    # A user who asked for 29–36 °C gets a perfect match from the same data.
    hot = alert(preferences={"tempMin": 29, "tempMax": 36})
    assert scorer.score(hot).score == 90


def test_match_threshold_is_configurable(published_bundle) -> None:
    published_bundle.publish(temp=40.0, rain_day=1.0, sun=7.0)  # scores 60
    assert BundleMatchScorer().score(alert()).matches is False
    assert BundleMatchScorer(match_score=50).score(alert()).matches is True


def test_a_republish_is_seen_by_a_fresh_scorer(published_bundle) -> None:
    published_bundle.publish(temp=22.0)
    assert BundleMatchScorer().score(alert()).matches is True
    published_bundle.publish(temp=40.0, rain_day=9.0, sun=1.0)
    assert BundleMatchScorer().score(alert()).matches is False


def test_reads_both_stored_preference_shapes() -> None:
    """Alerts exist in two vintages and both have to score as their owner meant.

    The web wrote `tempMin`/`tempMax` when temperature was one variable, and
    writes `dayMin`/`dayMax` plus `nightMin`/`nightMax` now that it is a
    day/night pair. Reading only the old keys would have scored every alert
    saved by the current UI against the defaults — silently, since a missing
    key is indistinguishable from an unset one.
    """
    current = parse_preferences(
        {"dayMin": 24, "dayMax": 29, "nightMin": 15, "nightMax": 20, "rainMax": 2.0}
    )
    assert (current.temp_min, current.temp_max) == (24.0, 29.0)
    assert (current.night_min, current.night_max) == (15.0, 20.0)

    # Legacy: maps onto the daytime band, takes the default night.
    legacy = parse_preferences({"tempMin": 20, "tempMax": 26})
    assert (legacy.temp_min, legacy.temp_max) == (20.0, 26.0)
    assert (legacy.night_min, legacy.night_max) == (
        DEFAULT_PREFERENCES.night_min,
        DEFAULT_PREFERENCES.night_max,
    )


def test_temperature_is_one_concern_not_two() -> None:
    """Day and night collapse to their worst verdict before the buckets count.

    Otherwise the split would have quietly loosened every threshold: one miss
    out of four concerns is a milder complaint than one out of three, so a
    place would score better after the migration than before for no reason in
    the data.
    """
    # Days fine, nights a hard miss: temperature speaks once, with the worse
    # verdict, so this is one miss out of three concerns — not one out of four.
    assert score_bucket([26.0, 1.0, 7.0, 40.0]) == 1
    # Both halves fine.
    assert score_bucket([26.0, 1.0, 7.0, 16.0]) == 3
    # A three-value sequence still lines up with (t, rDay, s); the night is
    # simply not evaluated, as the pipeline treats an absent variable.
    assert score_bucket([26.0, 1.0, 7.0]) == 3
