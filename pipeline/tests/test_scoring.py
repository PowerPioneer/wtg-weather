from __future__ import annotations

import pytest

from wtg_pipeline.processing.scoring import (
    DEFAULT_PREFERENCES,
    VariablePreference,
    polygon_score,
    variable_in_buffer,
    variable_in_range,
)

#: A polygon that matches every default preference, for tests that want to
#: perturb exactly one thing.
PERFECT = {"t2m_max": 26.0, "t2m_min": 17.0, "tp": 2.0, "sun_hours": 8.0}


def _with(**overrides: float) -> dict[str, float]:
    return {**PERFECT, **overrides}


def test_default_preferences_variables() -> None:
    assert {p.variable for p in DEFAULT_PREFERENCES} == {
        "t2m_max", "t2m_min", "tp", "sun_hours",
    }


def test_temperature_is_two_variables_but_one_concern() -> None:
    """Four variables, three concerns — the thing that keeps the thresholds
    meaning what they meant when there were three of each."""
    concerns = {p.group for p in DEFAULT_PREFERENCES}
    assert concerns == {"temperature", "tp", "sun_hours"}

    temperature = [p for p in DEFAULT_PREFERENCES if p.group == "temperature"]
    assert {p.variable for p in temperature} == {"t2m_max", "t2m_min"}


def test_variable_in_range_inclusive() -> None:
    pref = VariablePreference("t2m_max", lo=22.0, hi=30.0, buffer=3.0)
    assert variable_in_range(22.0, pref)
    assert variable_in_range(30.0, pref)
    assert not variable_in_range(21.9, pref)


def test_variable_in_buffer() -> None:
    pref = VariablePreference("t2m_max", lo=22.0, hi=30.0, buffer=3.0)
    assert variable_in_buffer(19.0, pref)
    assert variable_in_buffer(33.0, pref)
    assert not variable_in_buffer(18.9, pref)
    assert not variable_in_buffer(33.1, pref)


def test_precipitation_preference_is_per_day() -> None:
    # Tiles carry mm/day, not mm/month — a 2 mm/day month is pleasant, and
    # ERA5's native m/day would put every polygon inside the range.
    tp = next(p for p in DEFAULT_PREFERENCES if p.variable == "tp")
    assert variable_in_range(2.0, tp)
    assert not variable_in_range(20.0, tp)


def test_perfect_match_scores_three() -> None:
    assert polygon_score(PERFECT) == 3


def test_one_in_buffer_scores_two() -> None:
    assert polygon_score(_with(t2m_max=32.0)) == 2  # just past the range


def test_one_out_of_buffer_scores_one() -> None:
    assert polygon_score(_with(t2m_max=42.0)) == 1


def test_two_out_of_buffer_scores_zero() -> None:
    assert polygon_score(_with(t2m_max=42.0, tp=20.0)) == 0


# ── The paired concern ───────────────────────────────────────────────


def test_the_worse_half_of_the_pair_decides_temperature() -> None:
    """Fine nights cannot rescue impossible days."""
    assert polygon_score(_with(t2m_max=42.0)) == 1
    assert polygon_score(_with(t2m_min=-10.0)) == 1


def test_missing_on_both_halves_still_counts_once() -> None:
    """The deliberate cost of collapsing the pair.

    A place that is wrong day *and* night scores the same as one wrong only by
    day. The alternative — counting them separately — would make one miss out
    of four milder than one out of three and quietly loosen every threshold.
    """
    day_only = polygon_score(_with(t2m_max=42.0))
    both = polygon_score(_with(t2m_max=42.0, t2m_min=-10.0))
    assert both == day_only == 1


def test_a_hot_day_with_a_sticky_night_is_penalised() -> None:
    """The case the split exists for: tropical nights that never cool.

    A 30 °C day is inside the range; a 27 °C night is a hard miss, and the old
    single-mean rule (28.5 °C mean) called the whole thing perfect.
    """
    assert polygon_score(_with(t2m_max=30.0, t2m_min=27.0)) == 1
    assert polygon_score(_with(t2m_max=30.0, t2m_min=17.0)) == 3


def test_a_desert_day_night_swing_is_penalised() -> None:
    """35 °C days and 5 °C nights average to a pleasant-looking 20 °C.

    Scores 1, not 0: both halves miss, but they are one concern, so this is a
    single hard miss. That ceiling is the price of collapsing the pair — a
    place cannot be sent to "Avoid" on temperature alone. It is still a long
    way better than the single-mean rule, which read this as a perfect match.
    """
    assert polygon_score(_with(t2m_max=35.0, t2m_min=5.0)) == 1
    # Add a second failing concern and it does reach the bottom.
    assert polygon_score(_with(t2m_max=35.0, t2m_min=5.0, tp=20.0)) == 0


# ── Guards ───────────────────────────────────────────────────────────


def test_raw_era5_units_do_not_score_as_a_match() -> None:
    # Guard against the regression that shipped a single-colour map: raw
    # Kelvin + m/day must not quietly land in a middling bucket.
    raw_si = {
        "t2m_max": 300.15, "t2m_min": 290.15, "tp": 0.002, "sun_hours": 8.0,
    }
    assert polygon_score(raw_si) < 2


def test_unknown_variables_are_ignored_not_scored() -> None:
    """A polygon in the Sahara can score without an SST reading — but a value
    under a key nothing scores must not be mistaken for a match either."""
    assert polygon_score({**PERFECT, "sst": 1.0}) == 3
    # The pre-split key is now unknown, so it contributes nothing at all.
    assert polygon_score({**PERFECT, "t2m": 297.15}) == 3


def test_empty_preferences_scores_zero() -> None:
    assert polygon_score({}) == 0


def test_partial_values_score_on_what_is_present() -> None:
    assert polygon_score({"t2m_max": 26.0, "t2m_min": 17.0}) == 3
    assert polygon_score({"t2m_max": 42.0}) == 1


@pytest.mark.parametrize(
    "temperature,expected",
    [
        ({"t2m_max": 26.0, "t2m_min": 17.0}, 3),   # both in range
        ({"t2m_max": 32.0, "t2m_min": 17.0}, 2),   # day in buffer
        ({"t2m_max": 26.0, "t2m_min": 24.0}, 2),   # night in buffer
        ({"t2m_max": 32.0, "t2m_min": 24.0}, 2),   # both in buffer, still one concern
        ({"t2m_max": 42.0, "t2m_min": 17.0}, 1),   # day a hard miss
    ],
)
def test_pair_verdicts(temperature: dict[str, float], expected: int) -> None:
    assert polygon_score(_with(**temperature)) == expected
