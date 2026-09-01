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

A polygon's final score for a month is driven by its *worst* concern — the
one thing that is wrong determines the rating. This matches how users
actually think ("it's nice except it rained the whole time").

The final 0..3 bucket is then:

* 3: every concern inside its preferred range
* 2: every concern within the tolerated buffer, at least one outside range
* 1: at most one concern outside buffer
* 0: two or more concerns outside buffer

A *concern* is usually one variable, but temperature is two — a daytime high
and an overnight low — collapsed to their worse verdict before anything is
counted. Travellers hold separate views about days and nights and one view
about whether the weather was right, and keeping the count at three concerns
is what stops the split silently loosening every threshold.

These thresholds are intentionally simple and were tuned against the
existing live site's visible output.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Variable = Literal[
    "t2m_max", "t2m_min", "tp", "sun_hours", "si10", "sd", "rh", "sst"
]


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
    #: Which *concern* this variable speaks for. Variables sharing a concern
    #: are collapsed to their worst verdict before the buckets count anything
    #: — see :func:`polygon_score`. Defaults to the variable itself.
    concern: str = ""

    @property
    def group(self) -> str:
        return self.concern or self.variable


# Free-tier default preferences: "warm, dry, sunny" — broadly matches the
# majority of traveller searches on the live site.
#
# Units here are the *display* units the tiles carry (see
# `wtg_pipeline.processing.units`), NOT ERA5's SI units. Scoring raw SI
# values against these ranges puts every polygon on Earth in the same
# bucket, which is exactly the bug this pairing was written to prevent.
# Temperature is two variables and one concern. A traveller holds a view
# about the days and a view about the nights, but they experience one
# "was the weather right?" — so both bounds are scored, and the worse of the
# two speaks for temperature when the buckets count. Keeping the count at
# three concerns is what stops the split silently loosening every threshold:
# one miss out of four is a milder complaint than one out of three, and the
# rule would have become more forgiving for no reason the data supports.
DEFAULT_PREFERENCES: tuple[VariablePreference, ...] = (
    VariablePreference("t2m_max", lo=22.0, hi=30.0, buffer=3.0, concern="temperature"),  # °C, daytime high
    VariablePreference("t2m_min", lo=12.0, hi=22.0, buffer=3.0, concern="temperature"),  # °C, overnight low
    VariablePreference("tp", lo=0.0, hi=2.7, buffer=1.3, concern="rain"),  # mm / day (≈ 80 mm/month)
    VariablePreference("sun_hours", lo=6.0, hi=13.0, buffer=1.5, concern="sun"),  # h / day
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
    # 0 = inside the range, 1 = inside the buffer, 2 = a hard miss. Worst
    # verdict wins within a concern, so a place whose nights are fine and whose
    # days are impossible is judged on the days.
    worst_by_concern: dict[str, int] = {}

    for pref in preferences:
        value = values_by_variable.get(pref.variable)
        if value is None:
            continue
        if variable_in_range(value, pref):
            verdict = 0
        elif variable_in_buffer(value, pref):
            verdict = 1
        else:
            verdict = 2
        group = pref.group
        worst_by_concern[group] = max(worst_by_concern.get(group, 0), verdict)

    if not worst_by_concern:
        return 0

    in_buffer = sum(1 for v in worst_by_concern.values() if v == 1)
    out_of_buffer = sum(1 for v in worst_by_concern.values() if v == 2)
    if out_of_buffer >= 2:
        return 0
    if out_of_buffer == 1:
        return 1
    if in_buffer >= 1:
        return 2
    return 3
