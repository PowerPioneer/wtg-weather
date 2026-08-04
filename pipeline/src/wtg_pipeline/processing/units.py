"""ERA5 SI units → the display units the web's paint expressions assume.

ERA5 ships everything in strict SI: temperatures in Kelvin, precipitation as
a depth in metres, wind in m/s, snow depth in metres. The display-mode
catalog on the web (``web/src/lib/display-modes.ts``) declares its legend
stops in human units (°C, mm/day, km/h, cm), and the default preference
ranges in :mod:`wtg_pipeline.processing.scoring` are likewise in human
units. Conversion happens once, at GeoJSON build time.

Two variables the product needs are not published by ERA5 at all and are
derived here from the ones that are:

* relative humidity — from 2 m temperature + 2 m dewpoint (Magnus);
* heat index — from temperature + relative humidity (Rothfusz regression,
  the same one NOAA publishes).

All functions are pure and scalar; callers broadcast them across polygons.
"""

from __future__ import annotations

import math

KELVIN_OFFSET = 273.15

# Magnus coefficients over water (Alduchov & Eskridge 1996).
_MAGNUS_A = 17.625
_MAGNUS_B = 243.04

# Below this the Rothfusz regression is not valid and heat index is not a
# meaningful concept — apparent temperature is just the air temperature.
HEAT_INDEX_MIN_C = 26.7  # ≈ 80 °F


def kelvin_to_celsius(value: float) -> float:
    """ERA5 `t2m` / `sst` / `d2m` (K) → °C."""
    return value - KELVIN_OFFSET


def m_per_day_to_mm_per_day(value: float) -> float:
    """ERA5 `tp` (m/day, monthly mean of daily total) → mm/day."""
    return value * 1000.0


def m_s_to_km_h(value: float) -> float:
    """ERA5 `si10` (m/s) → km/h."""
    return value * 3.6


def m_to_cm(value: float) -> float:
    """ERA5 `sd` snow depth (m) → cm."""
    return value * 100.0


def relative_humidity_pct(t2m_c: float, d2m_c: float) -> float:
    """Relative humidity (%) from air and dewpoint temperature, both °C.

    Ratio of the saturation vapour pressure at the dewpoint to that at the
    air temperature (Magnus). Result is clamped to 0..100 — a dewpoint
    above the air temperature is physically impossible but does occur in
    reanalysis grid cells after interpolation.
    """
    e_dew = math.exp((_MAGNUS_A * d2m_c) / (_MAGNUS_B + d2m_c))
    e_air = math.exp((_MAGNUS_A * t2m_c) / (_MAGNUS_B + t2m_c))
    if e_air <= 0:
        return 0.0
    return max(0.0, min(100.0, 100.0 * e_dew / e_air))


def heat_index_c(t2m_c: float, rh_pct: float) -> float:
    """Apparent ("feels like") temperature in °C — NOAA Rothfusz regression.

    The regression is defined in °F and is only valid in hot conditions;
    below :data:`HEAT_INDEX_MIN_C` the air temperature is returned
    unchanged. The two standard corrections (very dry heat, very humid
    moderate heat) are applied.
    """
    if t2m_c < HEAT_INDEX_MIN_C:
        return t2m_c

    t = t2m_c * 9.0 / 5.0 + 32.0
    r = max(0.0, min(100.0, rh_pct))

    hi = (
        -42.379
        + 2.04901523 * t
        + 10.14333127 * r
        - 0.22475541 * t * r
        - 0.00683783 * t * t
        - 0.05481717 * r * r
        + 0.00122874 * t * t * r
        + 0.00085282 * t * r * r
        - 0.00000199 * t * t * r * r
    )

    if r < 13.0 and 80.0 <= t <= 112.0:
        hi -= ((13.0 - r) / 4.0) * math.sqrt((17.0 - abs(t - 95.0)) / 17.0)
    elif r > 85.0 and 80.0 <= t <= 87.0:
        hi += ((r - 85.0) / 10.0) * ((87.0 - t) / 5.0)

    return (hi - 32.0) * 5.0 / 9.0
