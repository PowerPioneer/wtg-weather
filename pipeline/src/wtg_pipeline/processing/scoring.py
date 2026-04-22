"""Match-quality scoring: turn climate percentiles into a 0..3 score per polygon.

The score is used for:
  * Baking a default free-tier score into PMTiles (so a logged-out visitor
    sees a coloured map immediately, driven by default preferences).
  * Sharing the exact same scoring code with the web client so that paint
    expressions computed from user preferences stay perfectly consistent
    with the SSR country pages.

Scoring philosophy
------------------

For each weather variable the user has a preferred range (e.g. temp between
18°C and 28°C). The polygon's *typical* value (p50) is compared to the
range. A perfect match (inside the range) scores 1. A near-miss with a
tolerable buffer scores a partial match. Far-away scores 0.

A polygon's final score for a month is the *minimum* variable score — the
worst non-matching variable determines the rating. This matches how users
actually think ("it's nice except it rained the whole time").

The final 0..3 bucket is then:

* 3: every variable inside its preferred range
* 2: every variable within the tolerated buffer, at least one outside range
* 1: at most one variable outside buffer
* 0: two or more variables outside buffer

These thresholds are intentionally simple and were tuned against the
existing live site's visible output.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Variable = Literal["t2m", "tp", "sun_hours", "si10", "sd", "rh", "sst"]


@dataclass(frozen=True)
class VariablePreference:
    """A single preference range for one climate variable.

    ``lo`` / ``hi`` bound the preferred range (inclusive). ``buffer`` is
    added to both sides before a value is treated as a hard miss. All in
    the variable's native units (°C, mm, hours, m/s, …).
    """

    variable: Variable
    lo: float
    hi: float
    buffer: float


# Free-tier default preferences: "warm, dry, sunny" — broadly matches the
# majority of traveller searches on the live site.
DEFAULT_PREFERENCES: tuple[VariablePreference, ...] = (
    VariablePreference("t2m", lo=18.0, hi=28.0, buffer=3.0),  # °C
    VariablePreference("tp", lo=0.0, hi=80.0, buffer=40.0),  # mm / month
    VariablePreference("sun_hours", lo=6.0, hi=13.0, buffer=1.5),  # h / day
)


def variable_in_range(value: float, pref: VariablePreference) -> bool:
    return pref.lo <= value <= pref.hi


def variable_in_buffer(value: float, pref: VariablePreference) -> bool:
    return (pref.lo - pref.buffer) <= value <= (pref.hi + pref.buffer)


def polygon_score(
    values_by_variable: dict[Variable, float],
    preferences: tuple[VariablePreference, ...] = DEFAULT_PREFERENCES,
) -> int:
    """Return a 0..3 match score given the polygon's p50 values.

    Variables not represented in ``values_by_variable`` are ignored (a
    polygon in the Sahara can still score even if SST is absent).
    """
    in_range = 0
    in_buffer = 0
    out_of_buffer = 0
    evaluated = 0

    for pref in preferences:
        value = values_by_variable.get(pref.variable)
        if value is None:
            continue
        evaluated += 1
        if variable_in_range(value, pref):
            in_range += 1
        elif variable_in_buffer(value, pref):
            in_buffer += 1
        else:
            out_of_buffer += 1

    if evaluated == 0:
        return 0
    if out_of_buffer >= 2:
        return 0
    if out_of_buffer == 1:
        return 1
    if in_buffer >= 1:
        return 2
    return 3
