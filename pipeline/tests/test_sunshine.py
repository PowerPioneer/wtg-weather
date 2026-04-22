from __future__ import annotations

import math

import pytest

from wtg_pipeline.processing.sunshine import (
    DAYS_PER_MONTH_MID,
    REFERENCE_CITIES,
    clear_sky_daylight_irradiance,
    day_length_hours,
    sunshine_hours_from_ssrd,
)
from wtg_pipeline.pipeline_runner import _synthetic_monthly_ssrd, validate_sunshine


def test_day_length_equator_is_roughly_twelve_hours() -> None:
    for doy in (80, 172, 266, 355):
        assert math.isclose(day_length_hours(0.0, doy), 12.0, abs_tol=0.1)


def test_day_length_polar_day_and_night() -> None:
    # Summer solstice at 80°N → polar day, 24h.
    assert day_length_hours(80.0, 172) == 24.0
    # Winter solstice at 80°N → polar night, 0h.
    assert day_length_hours(80.0, 355) == 0.0


def test_day_length_london_june_is_long() -> None:
    london_lat = 51.51
    june_doy = DAYS_PER_MONTH_MID[5]
    assert day_length_hours(london_lat, june_doy) > 16.0


def test_sunshine_hours_bounded_by_daylight() -> None:
    # Pick a latitude + SSRD so large it saturates — sunshine must never
    # exceed the day length.
    result = sunshine_hours_from_ssrd(1e9, latitude_deg=30.0, month=6)
    june_doy = DAYS_PER_MONTH_MID[5]
    assert result <= day_length_hours(30.0, june_doy) + 1e-9


def test_sunshine_hours_zero_for_zero_ssrd() -> None:
    assert sunshine_hours_from_ssrd(0.0, latitude_deg=10.0, month=3) == 0.0


def test_sunshine_rejects_bad_month() -> None:
    with pytest.raises(ValueError):
        sunshine_hours_from_ssrd(1e7, latitude_deg=0.0, month=0)
    with pytest.raises(ValueError):
        sunshine_hours_from_ssrd(1e7, latitude_deg=0.0, month=13)


def test_clear_sky_irradiance_positive_in_daylight() -> None:
    for doy in (80, 172, 266, 355):
        assert clear_sky_daylight_irradiance(0.0, doy) > 0.0


def test_reference_cities_within_one_hour_tolerance() -> None:
    # Self-validate: the synthetic SSRD + scaling coefficient chain must
    # reproduce each published city norm to ±1 h/day.
    assert validate_sunshine(tolerance_hours=1.0) is True


@pytest.mark.parametrize("city", REFERENCE_CITIES, ids=lambda c: c.name)
def test_per_city_derivation_in_bounds(city) -> None:
    hours_year = 0.0
    for month in range(1, 13):
        ssrd = _synthetic_monthly_ssrd(city.latitude, month)
        hours_year += sunshine_hours_from_ssrd(
            ssrd, latitude_deg=city.latitude, month=month
        )
    mean_h = hours_year / 12
    assert abs(mean_h - city.expected_annual_mean_hours_per_day) <= 1.0, (
        f"{city.name}: derived {mean_h:.2f} vs expected "
        f"{city.expected_annual_mean_hours_per_day}"
    )
