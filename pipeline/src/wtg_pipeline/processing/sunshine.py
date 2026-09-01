"""Convert ERA5 surface solar radiation (SSRD) into daily sunshine hours.

The WMO defines sunshine duration as the hours during which **direct normal**
irradiance exceeds 120 W/m². ERA5 does not publish that variable, so it has to
be modelled from what ERA5 does publish. This module holds that model.

Ångström–Prescott
-----------------

    Kt  = SSRD / extraterrestrial radiation      (the clearness index)
    n/N = (Kt - a) / b                           (sunshine fraction)
    n   = N · n/N                                (hours)

What changed, and why
---------------------

The previous model was ``n/N = SSRD_daytime / clear_sky`` with ``clear_sky =
TOA × 0.72`` — which is Ångström–Prescott with **no intercept**. That is not a
small simplification. A fully overcast sky still passes roughly a quarter of
top-of-atmosphere radiation as diffuse light, so ``Kt ≈ 0.25`` on a day with
no sunshine at all; without an intercept that day is reported as about a third
sunny. Every dull maritime climate was systematically flattered, and the error
is largest exactly where a traveller most wants to be warned.

The 0.72 was documented as "calibrated so five reference cities fall within
±1 h/day". It was not: ``validate_sunshine`` generated its own SSRD as
``clear_sky × ratio`` and then divided it back out by ``clear_sky``, so the
coefficient cancelled and the check passed for **any** value of it. The
reference cities survive below as a genuine calibration target, no longer as a
self-fulfilling test.

Calibration status
------------------

``ANGSTROM_PRESCOTT_A`` / ``_B`` are the standard global coefficients from the
literature. They are known to fit poorly at high latitudes, where both drift
with climate — so ``scripts/calibrate_sunshine.py`` fits them per latitude band
against true WMO sunshine duration computed from hourly ERA5 ``fdir``
(direct radiation → DNI via the solar zenith angle → hours above 120 W/m²).
Until that has run these are an honest default rather than a tuned constant
presented as a calibration.

The module is self-contained — inputs are latitude, day-of-year and SSRD; no
xarray dependency. Consumers broadcast it across their polygon dataset.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

SOLAR_CONSTANT_W_M2 = 1361.0
SECONDS_PER_DAY = 86_400
# Day-of-year for the mid-point of each month (non-leap).
DAYS_PER_MONTH_MID: tuple[int, ...] = (15, 45, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349)


def day_length_hours(latitude_deg: float, day_of_year: int) -> float:
    """Astronomical day length (sunrise → sunset) in hours.

    Uses the standard declination approximation
    ``delta = 23.44° * sin(360° * (284 + n) / 365)``. Returns 24.0 during
    polar day and 0.0 during polar night.
    """
    lat = math.radians(latitude_deg)
    decl = math.radians(23.44) * math.sin(math.radians(360.0 * (284 + day_of_year) / 365.0))
    cos_h0 = -math.tan(lat) * math.tan(decl)
    if cos_h0 >= 1.0:
        return 0.0
    if cos_h0 <= -1.0:
        return 24.0
    h0 = math.acos(cos_h0)
    return 24.0 * h0 / math.pi


def _mean_cos_solar_zenith(latitude_deg: float, day_of_year: int) -> float:
    """Daylight-average of cos(solar zenith angle).

    Integral of ``sin(lat)sin(decl) + cos(lat)cos(decl)cos(h)`` over the
    daylight hour angle ``[-h0, h0]``, divided by ``2*h0``.
    """
    lat = math.radians(latitude_deg)
    decl = math.radians(23.44) * math.sin(math.radians(360.0 * (284 + day_of_year) / 365.0))
    cos_h0 = -math.tan(lat) * math.tan(decl)
    if cos_h0 >= 1.0:
        return 0.0
    if cos_h0 <= -1.0:
        return max(0.0, math.sin(lat) * math.sin(decl))
    h0 = math.acos(cos_h0)
    integral = (
        2 * h0 * math.sin(lat) * math.sin(decl)
        + 2 * math.cos(lat) * math.cos(decl) * math.sin(h0)
    )
    return max(0.0, integral / (2 * h0))


# Empirical scaling for atmospheric attenuation (TOA → surface clear-sky).
# Calibrated against the five reference cities below; any change must keep
# the validation tolerance within ±1 h/day.
SURFACE_ATTENUATION_COEFFICIENT = 0.72


def clear_sky_daylight_irradiance(latitude_deg: float, day_of_year: int) -> float:
    """Mean clear-sky surface shortwave irradiance during daylight (W/m²)."""
    toa = SOLAR_CONSTANT_W_M2 * _mean_cos_solar_zenith(latitude_deg, day_of_year)
    return toa * SURFACE_ATTENUATION_COEFFICIENT


# ── Ångström–Prescott ────────────────────────────────────────────────
#
# Sunshine fraction from the clearness index:
#
#     n/N = (Kt - a) / b        Kt = SSRD / extraterrestrial
#
# `a` is the part of the clearness index that arrives as diffuse radiation
# under a fully overcast sky, and it is the whole reason this replaced the
# previous model. That one computed `n/N = SSRD_daytime / clear_sky` — an
# Ångström–Prescott with **no intercept** — which reports a completely
# overcast day (Kt ≈ 0.25) as roughly a third sunny. Every dull maritime
# climate was systematically flattered.
#
# These are the standard global coefficients. They are known to be a poor
# fit at high latitudes, where both coefficients drift, so `calibrate.py`
# fits them per latitude band against true WMO sunshine duration computed
# from hourly ERA5 `fdir`. Until that has run, these are the honest default
# rather than a tuned constant pretending to be a calibration.
ANGSTROM_PRESCOTT_A = 0.25
ANGSTROM_PRESCOTT_B = 0.50

#: Fraction of possible daylight a day must reach to count as "mostly sunny".
#: Unlike a wet day this has no WMO standard, so it is an editorial choice.
SUNNY_DAY_FRACTION = 0.70

#: Depth of rain a day must reach to count as wet. This one *is* a standard:
#: the WMO's 1.0 mm threshold, used by CRU's `wet` variable among others.
WET_DAY_MM = 1.0


def extraterrestrial_daily_j_m2(latitude_deg: float, day_of_year: int) -> float:
    """Daily total solar radiation on a horizontal surface at the top of the
    atmosphere (J/m²/day) — the denominator of the clearness index."""
    daylight_h = day_length_hours(latitude_deg, day_of_year)
    if daylight_h <= 0:
        return 0.0
    mean_cos = _mean_cos_solar_zenith(latitude_deg, day_of_year)
    return SOLAR_CONSTANT_W_M2 * mean_cos * daylight_h * 3600.0


def clearness_index(
    ssrd_j_per_m2_per_day: float, *, latitude_deg: float, day_of_year: int
) -> float:
    """Kt — the fraction of top-of-atmosphere radiation reaching the surface.

    Bounded to [0, 1]: reanalysis grid cells can produce a hair over 1 after
    interpolation, and a Kt above 1 is not physical.
    """
    toa = extraterrestrial_daily_j_m2(latitude_deg, day_of_year)
    if toa <= 0:
        return 0.0
    return max(0.0, min(1.0, ssrd_j_per_m2_per_day / toa))


def sunshine_fraction(
    kt: float,
    *,
    a: float = ANGSTROM_PRESCOTT_A,
    b: float = ANGSTROM_PRESCOTT_B,
) -> float:
    """n/N from the clearness index, clamped to [0, 1]."""
    if b <= 0:
        raise ValueError(f"Ångström–Prescott b must be positive, got {b!r}")
    return max(0.0, min(1.0, (kt - a) / b))


def sunshine_hours_for_day(
    ssrd_j_per_m2: float,
    *,
    latitude_deg: float,
    day_of_year: int,
    a: float = ANGSTROM_PRESCOTT_A,
    b: float = ANGSTROM_PRESCOTT_B,
) -> float:
    """Sunshine hours for **one day**, from that day's total SSRD.

    This is the entry point the daily pipeline uses. It takes a real
    day-of-year rather than a month, because with daily statistics we know
    which day it actually was.
    """
    daylight_h = day_length_hours(latitude_deg, day_of_year)
    if daylight_h <= 0:
        return 0.0
    kt = clearness_index(
        ssrd_j_per_m2, latitude_deg=latitude_deg, day_of_year=day_of_year
    )
    return daylight_h * sunshine_fraction(kt, a=a, b=b)


def sunshine_hours_from_ssrd(
    ssrd_j_per_m2_per_day: float,
    *,
    latitude_deg: float,
    month: int,
) -> float:
    """Mean daily sunshine hours for a monthly SSRD average.

    Kept for the monthly-means path (``build_geojson`` still converts
    percentiles this way). Uses the mid-month day-of-year; the daily pipeline
    should call :func:`sunshine_hours_for_day` instead, which knows the date.

    Note this is monotonic in SSRD for a fixed (latitude, month), which is
    what lets ``widen_percentiles_for_polygon`` apply it to p5/p50/p95
    independently and preserve their ordering.
    """
    if not 1 <= month <= 12:
        raise ValueError(f"month must be 1..12, got {month!r}")

    return sunshine_hours_for_day(
        ssrd_j_per_m2_per_day,
        latitude_deg=latitude_deg,
        day_of_year=DAYS_PER_MONTH_MID[month - 1],
    )


def is_sunny_day(
    sun_hours: float, *, latitude_deg: float, day_of_year: int
) -> bool:
    """Whether one day counts as "mostly sunny": ≥ 70 % of possible daylight.

    Unlike a wet day — which the WMO pins at ≥ 1.0 mm — a sunny day has no
    standard definition, so this is an editorial choice. It is expressed as a
    *fraction of daylight* rather than an absolute hour count on purpose: at
    6 absolute hours, a high-latitude winter day is structurally incapable of
    being sunny however clear the sky, which would be a claim about the
    calendar rather than the weather.
    """
    daylight_h = day_length_hours(latitude_deg, day_of_year)
    if daylight_h <= 0:
        return False
    return sun_hours >= SUNNY_DAY_FRACTION * daylight_h



@dataclass(frozen=True)
class ReferenceCity:
    name: str
    latitude: float
    expected_annual_mean_hours_per_day: float
    source: str


# Expected annual-mean daily sunshine hours per reference city. Derived
# from national-met-service 1991-2020 normals (monthly averages, then
# average across 12 months). Tolerance in tests is ±1 h/day.
REFERENCE_CITIES: tuple[ReferenceCity, ...] = (
    ReferenceCity("Cusco", -13.53, 6.3, "Peru SENAMHI 1991-2020"),
    ReferenceCity("London", 51.51, 4.1, "UK Met Office 1991-2020"),
    ReferenceCity("Phoenix", 33.45, 11.0, "NOAA 1991-2020"),
    ReferenceCity("Singapore", 1.35, 5.3, "MSS 1991-2020"),
    ReferenceCity("Cairo", 30.04, 9.6, "EMA 1991-2020"),
)
