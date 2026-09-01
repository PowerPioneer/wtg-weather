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

import json
import logging
import math
from dataclasses import dataclass
from pathlib import Path

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
# fit at high latitudes, where both coefficients drift, so
# `scripts/calibrate_sunshine.py` fits them per latitude band against true WMO sunshine duration computed
# from hourly ERA5 `fdir`. Until that has run, these are the honest default
# rather than a tuned constant pretending to be a calibration.
ANGSTROM_PRESCOTT_A = 0.25
ANGSTROM_PRESCOTT_B = 0.50

#: Latitude bands the calibration fits separately, as ``(name, |lat| limit)``.
#: The coefficients drift most between the tropics and the poles, which is
#: exactly where a single global pair does worst.
LATITUDE_BANDS: tuple[tuple[str, float], ...] = (
    ("tropical", 23.5),
    ("subtropical", 35.0),
    ("temperate", 60.0),
    ("polar", 90.1),
)


def band_for_latitude(latitude_deg: float) -> str:
    """Which calibration band a latitude falls in."""
    magnitude = abs(latitude_deg)
    for name, limit in LATITUDE_BANDS:
        if magnitude < limit:
            return name
    return LATITUDE_BANDS[-1][0]


def _load_calibration() -> dict:
    """Fitted coefficients from ``scripts/calibrate_sunshine.py --write``.

    Absent until that has been run, which is the normal state on a fresh
    checkout — the literature defaults above are used instead. A malformed
    file is ignored loudly rather than crashing the pipeline: a bad
    calibration must not be able to stop a rebuild.
    """
    path = Path(__file__).with_name("sunshine_coefficients.json")
    if not path.exists():
        return {}
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        logging.getLogger(__name__).warning(
            "SUNSHINE_CALIBRATION_UNREADABLE %s could not be parsed; falling "
            "back to the literature defaults a=%.2f b=%.2f",
            path, ANGSTROM_PRESCOTT_A, ANGSTROM_PRESCOTT_B,
        )
        return {}
    return loaded if isinstance(loaded, dict) else {}


_CALIBRATION = _load_calibration()


def coefficients_for_latitude(latitude_deg: float) -> tuple[float, float]:
    """The ``(a, b)`` to use at a latitude: fitted if calibrated, else default.

    Falls back band → global → literature, so a partial calibration (one band
    had too few samples) still improves the bands it did cover instead of
    being all-or-nothing.
    """
    band = band_for_latitude(latitude_deg)
    bands = _CALIBRATION.get("bands") or {}
    entry = bands.get(band) or _CALIBRATION.get("global") or {}
    a = entry.get("a", ANGSTROM_PRESCOTT_A)
    b = entry.get("b", ANGSTROM_PRESCOTT_B)
    try:
        a, b = float(a), float(b)
    except (TypeError, ValueError):
        return ANGSTROM_PRESCOTT_A, ANGSTROM_PRESCOTT_B
    if b <= 0:
        return ANGSTROM_PRESCOTT_A, ANGSTROM_PRESCOTT_B
    return a, b


def is_calibrated() -> bool:
    """Whether fitted coefficients are in use rather than the defaults."""
    return bool(_CALIBRATION.get("bands") or _CALIBRATION.get("global"))

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
    a: float | None = None,
    b: float | None = None,
) -> float:
    """Sunshine hours for **one day**, from that day's total SSRD.

    This is the entry point the daily pipeline uses. It takes a real
    day-of-year rather than a month, because with daily statistics we know
    which day it actually was.

    ``a`` and ``b`` default to the calibrated coefficients for this latitude
    band, or the literature values when no calibration has been run.
    """
    if a is None or b is None:
        fitted_a, fitted_b = coefficients_for_latitude(latitude_deg)
        a = fitted_a if a is None else a
        b = fitted_b if b is None else b
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


# ── True WMO sunshine duration, for calibration ──────────────────────
#
# The definition the model above is trying to approximate: hours during which
# *direct normal* irradiance exceeds 120 W/m². Computable from ERA5 hourly
# `fdir` (direct radiation on a horizontal plane) by dividing out the solar
# zenith angle. Far too much data to run globally — 87,600 fields over ten
# years — but exactly right on a sample, which is what
# `scripts/calibrate_sunshine.py` uses to fit `a` and `b`.

#: WMO threshold for "bright sunshine", W/m² of direct normal irradiance.
WMO_SUNSHINE_THRESHOLD_W_M2 = 120.0


def cos_solar_zenith_at(
    latitude_deg: float, longitude_deg: float, day_of_year: int, hour_utc: float
) -> float:
    """cos(solar zenith) at an instant. NOAA's approximation.

    Returns 0.0 when the sun is at or below the horizon, so callers can divide
    by it only after checking. ``hour_utc`` may be fractional.
    """
    gamma = 2.0 * math.pi / 365.0 * (day_of_year - 1 + (hour_utc - 12.0) / 24.0)

    eqtime = 229.18 * (
        0.000075
        + 0.001868 * math.cos(gamma)
        - 0.032077 * math.sin(gamma)
        - 0.014615 * math.cos(2 * gamma)
        - 0.040849 * math.sin(2 * gamma)
    )
    decl = (
        0.006918
        - 0.399912 * math.cos(gamma)
        + 0.070257 * math.sin(gamma)
        - 0.006758 * math.cos(2 * gamma)
        + 0.000907 * math.sin(2 * gamma)
        - 0.002697 * math.cos(3 * gamma)
        + 0.00148 * math.sin(3 * gamma)
    )

    # True solar time in minutes; no timezone term because the hour is UTC.
    true_solar_time = hour_utc * 60.0 + eqtime + 4.0 * longitude_deg
    hour_angle = math.radians(true_solar_time / 4.0 - 180.0)

    lat = math.radians(latitude_deg)
    cos_z = math.sin(lat) * math.sin(decl) + math.cos(lat) * math.cos(decl) * math.cos(
        hour_angle
    )
    return max(0.0, cos_z)


def wmo_sunshine_hours(
    fdir_hourly_j_m2: "list[float] | tuple[float, ...]",
    *,
    latitude_deg: float,
    longitude_deg: float,
    day_of_year: int,
    hour_offset: float = 0.5,
) -> float:
    """True sunshine duration for one day from 24 hourly ``fdir`` accumulations.

    ``fdir_hourly_j_m2[i]`` is the direct radiation accumulated over hour *i*
    (J/m² on a **horizontal** surface). Dividing by 3600 gives the mean flux,
    and dividing that by cos(zenith) converts horizontal to normal incidence.
    An hour counts when the result clears
    :data:`WMO_SUNSHINE_THRESHOLD_W_M2`.

    ``hour_offset`` places the solar position at the middle of each
    accumulation window rather than its edge, which matters near sunrise and
    sunset where cos(zenith) is small and changing fast.
    """
    hours = 0.0
    for index, joules in enumerate(fdir_hourly_j_m2):
        cos_z = cos_solar_zenith_at(
            latitude_deg, longitude_deg, day_of_year, index + hour_offset
        )
        if cos_z <= 0.0:
            continue
        horizontal_w_m2 = joules / 3600.0
        if horizontal_w_m2 <= 0.0:
            continue
        dni = horizontal_w_m2 / cos_z
        if dni > WMO_SUNSHINE_THRESHOLD_W_M2:
            hours += 1.0
    return hours


def fit_angstrom_prescott(
    samples: "list[tuple[float, float]] | tuple[tuple[float, float], ...]",
) -> tuple[float, float]:
    """Least-squares fit of ``n/N = (Kt - a) / b`` to ``(Kt, n/N)`` pairs.

    Fitted in the conventional forward form ``Kt = a + b·(n/N)``, which is how
    the coefficients are reported in the literature and keeps them comparable
    with published values.

    Raises if there is not enough spread in ``n/N`` to determine a slope —
    a sample drawn entirely from one climate would otherwise return a
    confident-looking fit with no information in it.
    """
    if len(samples) < 2:
        raise ValueError(f"need at least 2 samples to fit, got {len(samples)}")

    xs = [fraction for _kt, fraction in samples]
    ys = [kt for kt, _fraction in samples]
    n = len(samples)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n

    sxx = sum((x - mean_x) ** 2 for x in xs)
    if sxx <= 1e-12:
        raise ValueError(
            "sunshine fraction has no spread across the sample; cannot fit a "
            "slope. Draw the sample from more than one climate."
        )
    sxy = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))

    b = sxy / sxx
    a = mean_y - b * mean_x
    return a, b


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
