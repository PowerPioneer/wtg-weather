"""Sunshine derivation: geometry, the Ångström–Prescott model, and sunny days.

The model tests below replace two that could not fail. The old pair fed the
derivation SSRD built as ``clear_sky × ratio`` and then divided it back out by
``clear_sky``, so ``SURFACE_ATTENUATION_COEFFICIENT`` cancelled and any value
of it passed — while the docstring claimed a ±1 h/day calibration against five
cities. What follows tests properties that are actually true of the physics and
would break if the derivation broke.
"""

from __future__ import annotations

import logging
import math

import pytest

from wtg_pipeline.pipeline_runner import validate_sunshine
from wtg_pipeline.processing.sunshine import (
    ANGSTROM_PRESCOTT_A,
    ANGSTROM_PRESCOTT_B,
    DAYS_PER_MONTH_MID,
    REFERENCE_CITIES,
    SUNNY_DAY_FRACTION,
    clear_sky_daylight_irradiance,
    clearness_index,
    day_length_hours,
    extraterrestrial_daily_j_m2,
    is_sunny_day,
    sunshine_fraction,
    sunshine_hours_for_day,
    sunshine_hours_from_ssrd,
)

LATITUDES = (-75.0, -45.0, -10.0, 0.0, 10.0, 45.0, 75.0)
DOYS = (15, 105, 196, 288)


def _toa(latitude: float, doy: int) -> float:
    return extraterrestrial_daily_j_m2(latitude, doy)


# ── Solar geometry ───────────────────────────────────────────────────


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


def test_clear_sky_irradiance_positive_in_daylight() -> None:
    for doy in (80, 172, 266, 355):
        assert clear_sky_daylight_irradiance(0.0, doy) > 0.0


def test_polar_night_has_no_sunshine_and_no_toa() -> None:
    assert extraterrestrial_daily_j_m2(80.0, 355) == 0.0
    assert sunshine_hours_for_day(1e7, latitude_deg=80.0, day_of_year=355) == 0.0
    assert clearness_index(1e7, latitude_deg=80.0, day_of_year=355) == 0.0


# ── Ångström–Prescott ────────────────────────────────────────────────


def test_overcast_sky_yields_no_sunshine() -> None:
    """The whole reason the intercept exists.

    A fully overcast sky still passes ~25 % of top-of-atmosphere radiation as
    diffuse light. The previous no-intercept model reported that as roughly a
    third of a sunny day, flattering every dull maritime climate.
    """
    for latitude in LATITUDES:
        for doy in DOYS:
            hours = sunshine_hours_for_day(
                _toa(latitude, doy) * ANGSTROM_PRESCOTT_A,
                latitude_deg=latitude,
                day_of_year=doy,
            )
            assert hours == pytest.approx(0.0, abs=1e-9), (
                f"lat={latitude} doy={doy}: overcast gave {hours:.2f} h"
            )


def test_clear_sky_yields_the_whole_day() -> None:
    clear_kt = min(1.0, ANGSTROM_PRESCOTT_A + ANGSTROM_PRESCOTT_B)
    for latitude in LATITUDES:
        for doy in DOYS:
            daylight = day_length_hours(latitude, doy)
            hours = sunshine_hours_for_day(
                _toa(latitude, doy) * clear_kt, latitude_deg=latitude, day_of_year=doy
            )
            assert hours == pytest.approx(daylight, abs=1e-6)


def test_monotonic_and_bounded_by_daylight() -> None:
    for latitude in LATITUDES:
        for doy in DOYS:
            daylight = day_length_hours(latitude, doy)
            toa = _toa(latitude, doy)
            previous = -1.0
            for fraction in (0.0, 0.1, 0.25, 0.4, 0.6, 0.75, 0.9, 1.0):
                hours = sunshine_hours_for_day(
                    toa * fraction, latitude_deg=latitude, day_of_year=doy
                )
                assert 0.0 <= hours <= daylight + 1e-9
                assert hours >= previous - 1e-9
                previous = hours


def test_sunshine_fraction_is_the_angstrom_prescott_line() -> None:
    assert sunshine_fraction(0.25) == pytest.approx(0.0)
    assert sunshine_fraction(0.50) == pytest.approx(0.5)
    assert sunshine_fraction(0.75) == pytest.approx(1.0)
    # Clamped either side rather than going negative or above one.
    assert sunshine_fraction(0.05) == 0.0
    assert sunshine_fraction(0.95) == 1.0


def test_sunshine_fraction_rejects_zero_slope() -> None:
    with pytest.raises(ValueError):
        sunshine_fraction(0.5, b=0.0)


def test_clearness_index_is_bounded() -> None:
    toa = _toa(0.0, 172)
    assert clearness_index(0.0, latitude_deg=0.0, day_of_year=172) == 0.0
    assert clearness_index(toa * 0.5, latitude_deg=0.0, day_of_year=172) == pytest.approx(0.5)
    # Reanalysis can produce a hair over TOA after interpolation.
    assert clearness_index(toa * 1.2, latitude_deg=0.0, day_of_year=172) == 1.0


def test_sunshine_hours_bounded_by_daylight() -> None:
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


def test_monthly_wrapper_agrees_with_the_daily_one() -> None:
    """build_geojson still uses the monthly form; it must not drift."""
    for month in range(1, 13):
        doy = DAYS_PER_MONTH_MID[month - 1]
        ssrd = _toa(40.0, doy) * 0.55
        assert sunshine_hours_from_ssrd(
            ssrd, latitude_deg=40.0, month=month
        ) == pytest.approx(
            sunshine_hours_for_day(ssrd, latitude_deg=40.0, day_of_year=doy)
        )


# ── Sunny days ───────────────────────────────────────────────────────


def test_sunny_day_is_a_fraction_of_daylight_not_an_hour_count() -> None:
    """A high-latitude winter day must be *able* to be sunny.

    An absolute threshold (say 6 h) makes late January in Tromsø structurally
    incapable of a sunny day however clear the sky, which is a statement about
    the calendar rather than about the weather.
    """
    latitude, doy = 69.65, 30  # Tromsø, just after the sun returns
    daylight = day_length_hours(latitude, doy)
    assert 0.0 < daylight < 6.0

    assert is_sunny_day(daylight * 0.95, latitude_deg=latitude, day_of_year=doy)
    assert not is_sunny_day(daylight * 0.2, latitude_deg=latitude, day_of_year=doy)


def test_sunny_day_threshold_is_seventy_percent() -> None:
    latitude, doy = 0.0, 172
    daylight = day_length_hours(latitude, doy)
    assert SUNNY_DAY_FRACTION == 0.70

    assert not is_sunny_day(
        daylight * SUNNY_DAY_FRACTION - 1e-6, latitude_deg=latitude, day_of_year=doy
    )
    assert is_sunny_day(
        daylight * SUNNY_DAY_FRACTION + 1e-6, latitude_deg=latitude, day_of_year=doy
    )


def test_polar_night_is_never_a_sunny_day() -> None:
    assert not is_sunny_day(0.0, latitude_deg=80.0, day_of_year=355)


# ── The pipeline gate ────────────────────────────────────────────────


def test_validate_sunshine_checks_invariants_without_data() -> None:
    """`wtg pipeline full` gates on this, so it must still pass — and it must
    now be checking something that could actually fail."""
    assert validate_sunshine() is True


def test_validate_sunshine_reports_uncalibrated(caplog) -> None:
    """Absence of a calibration is stated, not silently treated as success."""
    with caplog.at_level(logging.WARNING):
        validate_sunshine()
    assert any("SUNSHINE_UNCALIBRATED" in r.message for r in caplog.records)


def test_validate_sunshine_can_check_real_observations() -> None:
    """Given real SSRD it does compare against the published norms.

    Fed SSRD the model maps onto each city's published figure it passes; fed
    a fraction of that, it fails. That is the check the old version claimed to
    be performing and was not.
    """

    def ssrd_for(city, scale: float = 1.0) -> list[float]:
        out: list[float] = []
        for month in range(1, 13):
            doy = DAYS_PER_MONTH_MID[month - 1]
            daylight = day_length_hours(city.latitude, doy)
            if daylight <= 0:
                out.append(0.0)
                continue
            target = min(city.expected_annual_mean_hours_per_day * scale, daylight)
            kt = ANGSTROM_PRESCOTT_A + (target / daylight) * ANGSTROM_PRESCOTT_B
            out.append(extraterrestrial_daily_j_m2(city.latitude, doy) * kt)
        return out

    good = {c.name: ssrd_for(c) for c in REFERENCE_CITIES}
    assert validate_sunshine(observed_ssrd=good) is True

    bad = {c.name: ssrd_for(c, scale=0.4) for c in REFERENCE_CITIES}
    assert validate_sunshine(observed_ssrd=bad) is False


# ── True WMO sunshine duration (calibration input) ───────────────────


def test_solar_noon_is_the_daily_zenith_maximum() -> None:
    """At 0°E the sun should peak near 12:00 UTC."""
    from wtg_pipeline.processing.sunshine import cos_solar_zenith_at

    values = [(hour, cos_solar_zenith_at(45.0, 0.0, 172, hour)) for hour in range(24)]
    peak_hour = max(values, key=lambda pair: pair[1])[0]
    assert 11 <= peak_hour <= 13


def test_solar_noon_shifts_with_longitude() -> None:
    """90°E sees solar noon six hours earlier in UTC."""
    from wtg_pipeline.processing.sunshine import cos_solar_zenith_at

    def peak(longitude: float) -> int:
        return max(
            ((h, cos_solar_zenith_at(45.0, longitude, 172, h)) for h in range(24)),
            key=lambda pair: pair[1],
        )[0]

    assert peak(90.0) == pytest.approx(peak(0.0) - 6, abs=1)


def test_sun_is_below_the_horizon_through_polar_night() -> None:
    from wtg_pipeline.processing.sunshine import cos_solar_zenith_at

    assert all(cos_solar_zenith_at(80.0, 0.0, 355, h) == 0.0 for h in range(24))


def test_wmo_sunshine_counts_only_hours_above_the_threshold() -> None:
    from wtg_pipeline.processing.sunshine import (
        WMO_SUNSHINE_THRESHOLD_W_M2,
        cos_solar_zenith_at,
        wmo_sunshine_hours,
    )

    latitude, longitude, doy = 0.0, 0.0, 80  # equinox at the equator

    # A strong beam whenever the sun is up: 800 W/m² normal incidence,
    # projected onto the horizontal and accumulated over the hour.
    strong = [
        800.0 * cos_solar_zenith_at(latitude, longitude, doy, h + 0.5) * 3600.0
        for h in range(24)
    ]
    hours = wmo_sunshine_hours(
        strong, latitude_deg=latitude, longitude_deg=longitude, day_of_year=doy
    )
    assert 9.0 <= hours <= 12.0

    # Same geometry, beam dimmed below the threshold: nothing counts.
    weak = [
        (WMO_SUNSHINE_THRESHOLD_W_M2 * 0.5)
        * cos_solar_zenith_at(latitude, longitude, doy, h + 0.5)
        * 3600.0
        for h in range(24)
    ]
    assert (
        wmo_sunshine_hours(
            weak, latitude_deg=latitude, longitude_deg=longitude, day_of_year=doy
        )
        == 0.0
    )


def test_wmo_sunshine_is_zero_in_the_dark() -> None:
    from wtg_pipeline.processing.sunshine import wmo_sunshine_hours

    assert (
        wmo_sunshine_hours(
            [0.0] * 24, latitude_deg=0.0, longitude_deg=0.0, day_of_year=80
        )
        == 0.0
    )


# ── Fitting ──────────────────────────────────────────────────────────


def test_fit_recovers_known_coefficients() -> None:
    from wtg_pipeline.processing.sunshine import fit_angstrom_prescott

    a_true, b_true = 0.22, 0.54
    samples = [
        (a_true + b_true * fraction, fraction)
        for fraction in (0.0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.0)
    ]
    a, b = fit_angstrom_prescott(samples)
    assert a == pytest.approx(a_true, abs=1e-9)
    assert b == pytest.approx(b_true, abs=1e-9)


def test_fit_refuses_a_sample_with_no_spread() -> None:
    """One climate cannot determine a slope, and must not look as if it did."""
    from wtg_pipeline.processing.sunshine import fit_angstrom_prescott

    with pytest.raises(ValueError, match="no spread"):
        fit_angstrom_prescott([(0.5, 0.5)] * 20)


def test_fit_needs_more_than_one_point() -> None:
    from wtg_pipeline.processing.sunshine import fit_angstrom_prescott

    with pytest.raises(ValueError, match="at least 2"):
        fit_angstrom_prescott([(0.5, 0.5)])


# ── Calibration loading ──────────────────────────────────────────────


def test_band_boundaries() -> None:
    from wtg_pipeline.processing.sunshine import band_for_latitude

    assert band_for_latitude(0.0) == "tropical"
    assert band_for_latitude(-13.5) == "tropical"
    assert band_for_latitude(30.0) == "subtropical"
    assert band_for_latitude(-33.4) == "subtropical"
    assert band_for_latitude(51.5) == "temperate"
    assert band_for_latitude(69.6) == "polar"
    assert band_for_latitude(-89.0) == "polar"


def test_defaults_apply_when_uncalibrated(monkeypatch) -> None:
    import wtg_pipeline.processing.sunshine as mod

    monkeypatch.setattr(mod, "_CALIBRATION", {})
    assert mod.is_calibrated() is False
    assert mod.coefficients_for_latitude(51.5) == (
        mod.ANGSTROM_PRESCOTT_A,
        mod.ANGSTROM_PRESCOTT_B,
    )


def test_fitted_band_coefficients_are_used(monkeypatch) -> None:
    import wtg_pipeline.processing.sunshine as mod

    monkeypatch.setattr(
        mod,
        "_CALIBRATION",
        {
            "global": {"a": 0.20, "b": 0.55},
            "bands": {"polar": {"a": 0.18, "b": 0.62}},
        },
    )
    assert mod.is_calibrated() is True
    # Band wins where it exists...
    assert mod.coefficients_for_latitude(69.6) == (0.18, 0.62)
    # ...and the global fit covers bands the calibration could not fit, so a
    # partial calibration still helps rather than being all-or-nothing.
    assert mod.coefficients_for_latitude(0.0) == (0.20, 0.55)


def test_a_broken_calibration_cannot_stop_a_rebuild(monkeypatch) -> None:
    """Garbage in the file falls back rather than raising mid-pipeline."""
    import wtg_pipeline.processing.sunshine as mod

    for broken in (
        {"bands": {"polar": {"a": "nonsense", "b": 0.5}}},
        {"bands": {"polar": {"a": 0.2, "b": 0.0}}},   # zero slope
        {"bands": {"polar": {"a": 0.2, "b": -0.5}}},  # negative slope
    ):
        monkeypatch.setattr(mod, "_CALIBRATION", broken)
        assert mod.coefficients_for_latitude(69.6) == (
            mod.ANGSTROM_PRESCOTT_A,
            mod.ANGSTROM_PRESCOTT_B,
        )


def test_calibration_changes_the_derived_hours(monkeypatch) -> None:
    """The wiring is real: a different fit must move the output."""
    import wtg_pipeline.processing.sunshine as mod

    ssrd = mod.extraterrestrial_daily_j_m2(51.5, 172) * 0.45

    monkeypatch.setattr(mod, "_CALIBRATION", {})
    default = mod.sunshine_hours_for_day(ssrd, latitude_deg=51.5, day_of_year=172)

    monkeypatch.setattr(
        mod, "_CALIBRATION", {"bands": {"temperate": {"a": 0.18, "b": 0.62}}}
    )
    fitted = mod.sunshine_hours_for_day(ssrd, latitude_deg=51.5, day_of_year=172)

    assert fitted != pytest.approx(default)
