"""Convert ERA5 surface solar radiation (SSRD) into daily sunshine hours.

The WMO sunshine duration definition is the number of hours per day during
which direct solar irradiance exceeds 120 W/m². ERA5 does not publish that
variable directly. The accepted derivation used by WorldClim and several
climatology services is:

1. ERA5 monthly means ship SSRD as the accumulated daily total in J/m².
   Dividing by the astronomical daylight length (seconds) gives the mean
   daytime irradiance (W/m²).
2. Compare to a clear-sky reference — ``S0 * mean_cos(zenith)`` over
   daylight, where ``S0 ≈ 1361 W/m²`` — scaled by an empirical surface
   attenuation coefficient calibrated so that the five reference cities
   (Cusco, London, Phoenix, Singapore, Cairo) fall within ±1 h/day of
   published WorldClim / national-met-service normals.
3. Sunshine hours ≈ ``daylight_hours * min(SSRD_daytime / S_clear, 1)``.

The module is self-contained — inputs are latitude + SSRD; no xarray
dependency. Consumers broadcast this across their polygon dataset.
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


def sunshine_hours_from_ssrd(
    ssrd_j_per_m2_per_day: float,
    *,
    latitude_deg: float,
    month: int,
) -> float:
    """Derive mean daily sunshine hours for a monthly SSRD average.

    Args:
        ssrd_j_per_m2_per_day: Monthly-mean daily total surface solar
            radiation downwards (J/m²/day). ERA5 monthly means ship this.
        latitude_deg: Polygon-representative latitude, degrees north.
        month: Month 1..12 (day-of-year uses the mid-month index).
    """
    if not 1 <= month <= 12:
        raise ValueError(f"month must be 1..12, got {month!r}")

    doy = DAYS_PER_MONTH_MID[month - 1]
    daylight_h = day_length_hours(latitude_deg, doy)
    if daylight_h <= 0:
        return 0.0

    daylight_s = daylight_h * 3600.0
    ssrd_daytime_w_m2 = ssrd_j_per_m2_per_day / daylight_s
    clear_sky_w_m2 = clear_sky_daylight_irradiance(latitude_deg, doy)
    if clear_sky_w_m2 <= 0:
        return 0.0

    ratio = min(ssrd_daytime_w_m2 / clear_sky_w_m2, 1.0)
    return daylight_h * ratio


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
