from __future__ import annotations

from wtg_pipeline.processing.scoring import (
    DEFAULT_PREFERENCES,
    VariablePreference,
    polygon_score,
    variable_in_buffer,
    variable_in_range,
)


def test_default_preferences_variables() -> None:
    assert {p.variable for p in DEFAULT_PREFERENCES} == {"t2m", "tp", "sun_hours"}


def test_variable_in_range_inclusive() -> None:
    pref = VariablePreference("t2m", lo=18.0, hi=28.0, buffer=3.0)
    assert variable_in_range(18.0, pref)
    assert variable_in_range(28.0, pref)
    assert not variable_in_range(17.9, pref)


def test_variable_in_buffer() -> None:
    pref = VariablePreference("t2m", lo=18.0, hi=28.0, buffer=3.0)
    assert variable_in_buffer(15.0, pref)
    assert variable_in_buffer(31.0, pref)
    assert not variable_in_buffer(14.9, pref)
    assert not variable_in_buffer(31.1, pref)


def test_perfect_match_scores_three() -> None:
    values = {"t2m": 24.0, "tp": 20.0, "sun_hours": 8.0}
    assert polygon_score(values) == 3


def test_one_in_buffer_scores_two() -> None:
    values = {"t2m": 30.0, "tp": 20.0, "sun_hours": 8.0}  # t2m in buffer
    assert polygon_score(values) == 2


def test_one_out_of_buffer_scores_one() -> None:
    values = {"t2m": 40.0, "tp": 20.0, "sun_hours": 8.0}
    assert polygon_score(values) == 1


def test_two_out_of_buffer_scores_zero() -> None:
    values = {"t2m": 40.0, "tp": 200.0, "sun_hours": 8.0}
    assert polygon_score(values) == 0


def test_empty_preferences_scores_zero() -> None:
    assert polygon_score({}) == 0
