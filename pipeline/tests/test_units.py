"""Unit conversions and the two derived climate variables.

These are the numbers the map's colours are computed from, so the tests pin
real reference points rather than round-tripping the implementation.
"""

from __future__ import annotations

import pytest

from wtg_pipeline.processing.units import (
    heat_index_c,
    kelvin_to_celsius,
    m_per_day_to_mm_per_day,
    m_s_to_km_h,
    m_to_cm,
    relative_humidity_pct,
)


def test_kelvin_to_celsius() -> None:
    assert kelvin_to_celsius(273.15) == pytest.approx(0.0)
    assert kelvin_to_celsius(300.0) == pytest.approx(26.85)
    # A typical ERA5 tropical grid cell must land inside the default
    # preference range (18-28 °C) — in Kelvin it never could.
    assert 18.0 <= kelvin_to_celsius(297.0) <= 28.0


def test_precipitation_metres_to_mm_per_day() -> None:
    # ERA5 `tp` is a depth in metres; 2 mm/day is a damp-but-pleasant month.
    assert m_per_day_to_mm_per_day(0.002) == pytest.approx(2.0)


def test_wind_and_snow_conversions() -> None:
    assert m_s_to_km_h(10.0) == pytest.approx(36.0)
    assert m_to_cm(0.35) == pytest.approx(35.0)


def test_relative_humidity_saturated_when_dewpoint_equals_air() -> None:
    assert relative_humidity_pct(20.0, 20.0) == pytest.approx(100.0)


def test_relative_humidity_drops_as_dewpoint_falls() -> None:
    humid = relative_humidity_pct(30.0, 25.0)
    dry = relative_humidity_pct(30.0, 5.0)
    assert 70.0 < humid < 80.0
    assert dry < 25.0
    assert dry < humid


def test_relative_humidity_clamped_to_100() -> None:
    # Interpolation artefacts can push the dewpoint above the air temp.
    assert relative_humidity_pct(10.0, 12.0) == 100.0


def test_heat_index_passthrough_below_threshold() -> None:
    # Below ~27 °C apparent temperature is just the air temperature; the
    # Rothfusz regression is not valid there and would read ~ -8 °C.
    assert heat_index_c(15.0, 60.0) == 15.0


def test_heat_index_hot_and_humid_feels_hotter() -> None:
    # NOAA's published table: 32 °C at 70 % RH feels like ~40 °C.
    assert heat_index_c(32.0, 70.0) == pytest.approx(40.4, abs=0.5)


def test_heat_index_dry_heat_correction_lowers_value() -> None:
    # Very dry air at high temperature feels cooler than the raw regression.
    assert heat_index_c(38.0, 10.0) < 38.0
