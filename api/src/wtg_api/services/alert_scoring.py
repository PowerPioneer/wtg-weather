"""Score a saved alert against the published country bundle.

This is the third implementation of one scoring rule. The first is
``pipeline/src/wtg_pipeline/processing/scoring.py``, which bakes ``pref_<mm>``
into the tiles; the second is ``web/src/lib/scoring.ts``, which repaints the map
when a user drags a slider. This one exists because the weekly alert job has to
answer the same question — *does this place, in this month, match what you asked
for?* — from inside the API container, which imports neither of them.

Why not import one of them: ``wtg_pipeline`` is a separate uv project that runs
on the host and pulls in geopandas; making it an API dependency to reach a
50-line pure function would put GDAL in the API image. The web's copy is
TypeScript. So the rule is copied, and
:func:`test_alert_scoring.test_matches_pipeline_rule` pins this copy against the
pipeline's *source text* the same way ``scoring.test.ts`` pins the web's — if
either table moves, the API suite fails rather than the alerts quietly grading
on a different curve.

Where the numbers come from
---------------------------

``preferences`` on an alert is whatever the web put there: the four keys of
``WeatherPreferences`` in ``lib/scoring.ts``. They are ``dict[str, Any]`` on the
way in and validated by nobody, so :func:`parse_preferences` clamps them to the
slider bounds exactly as ``clampPreferences`` does — an alert saved with a
hand-edited body cannot make itself match everything.

The climate series comes from the published bundle
(``services.country_data``), which is the same data the country pages render.
That matters more than convenience: an alert email that says April in Peru now
matches links to a page that has to agree with it.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from wtg_api.config import get_settings
from wtg_api.models import Alert
from wtg_api.services import country_data

logger = logging.getLogger(__name__)

# Tolerance either side of a range before a value is a hard miss, and the two
# bounds the UI does not expose. Mirrors `DEFAULT_PREFERENCES` and the buffer
# constants in the pipeline's scoring table.
TEMP_BUFFER = 3.0
RAIN_BUFFER = 1.3
SUN_BUFFER = 1.5
RAIN_MIN = 0.0
SUN_MAX = 13.0

# The daytime range's defaults. These are the pipeline's `t2m_max` bounds:
# since the move to daily statistics the bundle's `t` is the mean daily
# *maximum*, not a 24-hour mean, so the old 18–28 belonged to a variable that
# no longer exists.
DEFAULT_TEMP_MIN = 22.0
DEFAULT_TEMP_MAX = 30.0
DEFAULT_RAIN_MAX = 2.7
DEFAULT_SUN_MIN = 6.0

# The overnight band's defaults — the pipeline's `t2m_min` bounds, and the
# web's `nightMin`/`nightMax` slider defaults. Used when an alert stores no
# night of its own, which is every alert saved before temperature split.
DEFAULT_NIGHT_MIN = 12.0
DEFAULT_NIGHT_MAX = 22.0

# Slider bounds, from `PREFERENCE_LIMITS` in `lib/scoring.ts`.
TEMP_LIMITS = (-10.0, 45.0)
RAIN_LIMITS = (0.0, 12.0)
SUN_LIMITS = (0.0, SUN_MAX)

#: 0–100 score per 0..3 bucket. `SCORE_TO_PREF` in the pipeline's
#: `build_geojson.py`, `BUCKET_SCORES` in the web's `scoring.ts`.
BUCKET_SCORES: tuple[int, int, int, int] = (25, 60, 75, 90)


@dataclass(frozen=True)
class WeatherPreferences:
    #: The *daytime* band, scored against the bundle's `t` / `tMax`.
    temp_min: float = DEFAULT_TEMP_MIN
    temp_max: float = DEFAULT_TEMP_MAX
    #: The *overnight* band, scored against `tMin`. User-settable, matching
    #: the web's `nightMin`/`nightMax` sliders — the UI has four controls
    #: over three concerns, and an alert has to agree with the map the
    #: traveller set them on.
    night_min: float = DEFAULT_NIGHT_MIN
    night_max: float = DEFAULT_NIGHT_MAX
    rain_max: float = DEFAULT_RAIN_MAX
    sun_min: float = DEFAULT_SUN_MIN


DEFAULT_PREFERENCES = WeatherPreferences()


def _clamp(value: float, limits: tuple[float, float]) -> float:
    lo, hi = limits
    if value != value:  # NaN
        return lo
    return min(hi, max(lo, value))


def _round1(value: float) -> float:
    return round(value * 10) / 10


def _numeric(raw: Mapping[str, Any], key: str) -> float | None:
    value = raw.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = float(value)
    # NaN and ±inf both survive a `float()` and would poison every comparison
    # downstream; treat them as absent.
    if value != value or value in (float("inf"), float("-inf")):
        return None
    return value


def parse_preferences(raw: Any) -> WeatherPreferences:
    """An alert's ``preferences`` blob → a usable, clamped set.

    Anything missing falls back to the default, so an alert created before the
    shape existed (or with an empty dict, which is what ``AlertCreate``
    defaults to) scores against the same preferences the map shows a
    logged-out visitor. An inverted temperature band is swapped rather than
    rejected — it is unambiguous what was meant, and this mirrors
    ``clampPreferences``.
    """
    if not isinstance(raw, Mapping):
        return DEFAULT_PREFERENCES
    # Two shapes are stored. The web writes `dayMin`/`dayMax` and
    # `nightMin`/`nightMax` since temperature split into a day/night pair;
    # alerts saved before that carry `tempMin`/`tempMax` and no night at all.
    # Legacy rows map onto the *daytime* band — that is the half a traveller
    # was choosing when there was only one — and take the default night.
    # Reading only the old keys would have silently scored every alert saved
    # by the current UI against the defaults, ignoring what its owner set.
    temp_min = _numeric(raw, "dayMin")
    if temp_min is None:
        temp_min = _numeric(raw, "tempMin")
    temp_max = _numeric(raw, "dayMax")
    if temp_max is None:
        temp_max = _numeric(raw, "tempMax")
    night_min = _numeric(raw, "nightMin")
    night_max = _numeric(raw, "nightMax")
    rain_max = _numeric(raw, "rainMax")
    sun_min = _numeric(raw, "sunMin")

    lo = _clamp(DEFAULT_TEMP_MIN if temp_min is None else temp_min, TEMP_LIMITS)
    hi = _clamp(DEFAULT_TEMP_MAX if temp_max is None else temp_max, TEMP_LIMITS)
    if lo > hi:
        lo, hi = hi, lo
    n_lo = _clamp(DEFAULT_NIGHT_MIN if night_min is None else night_min, TEMP_LIMITS)
    n_hi = _clamp(DEFAULT_NIGHT_MAX if night_max is None else night_max, TEMP_LIMITS)
    if n_lo > n_hi:
        n_lo, n_hi = n_hi, n_lo
    return WeatherPreferences(
        temp_min=_round1(lo),
        temp_max=_round1(hi),
        night_min=_round1(n_lo),
        night_max=_round1(n_hi),
        rain_max=_round1(_clamp(DEFAULT_RAIN_MAX if rain_max is None else rain_max, RAIN_LIMITS)),
        sun_min=_round1(_clamp(DEFAULT_SUN_MIN if sun_min is None else sun_min, SUN_LIMITS)),
    )


@dataclass(frozen=True)
class _Range:
    lo: float
    hi: float
    buffer: float
    #: Which *concern* this range speaks for. Ranges sharing a concern are
    #: collapsed to their worst verdict before the buckets count anything —
    #: `VariablePreference.concern` in the pipeline's `scoring.py`.
    concern: str = ""


def preference_ranges(
    prefs: WeatherPreferences,
) -> tuple[_Range, _Range, _Range, _Range]:
    """The four ranges, in ``(t, rDay, s, tMin)`` order.

    The first three are the bundle's own key order. The overnight range is
    **appended rather than placed beside the daytime one** so that a
    three-value sequence — the shape every caller used before temperature
    split — still lines up with `t`, `rDay` and `s` instead of silently
    scoring rainfall against a temperature bound. A caller that supplies only
    three values simply does not have the night evaluated, which is how the
    pipeline treats an absent variable.

    Temperature is two ranges and one concern: a traveller holds a view about
    the days and a view about the nights but experiences one verdict, so the
    worse of the two speaks for temperature. Keeping the count at three
    concerns is also what stops the split quietly loosening every threshold —
    one miss out of four is a milder complaint than one out of three.
    """
    return (
        _Range(prefs.temp_min, prefs.temp_max, TEMP_BUFFER, "temperature"),
        _Range(RAIN_MIN, prefs.rain_max, RAIN_BUFFER, "rain"),
        _Range(prefs.sun_min, SUN_MAX, SUN_BUFFER, "sun"),
        _Range(prefs.night_min, prefs.night_max, TEMP_BUFFER, "temperature"),
    )


def score_bucket(
    values: Sequence[float | None], prefs: WeatherPreferences = DEFAULT_PREFERENCES
) -> int | None:
    """The 0..3 bucket for one polygon-month, or ``None`` with no data at all.

    ``None`` rather than 0 for the empty case, deliberately: the pipeline
    returns 0 there because it has nothing else to return, but the tiles then
    omit ``pref_<mm>`` entirely and the map paints grey. An alert on a place
    with no series must not read as "scores zero, tell them it stopped
    matching".
    """
    # 0 = inside the range, 1 = inside the buffer, 2 = a hard miss. Worst
    # verdict wins within a concern, so a place whose nights are fine and
    # whose days are impossible is judged on the days. Mirrors
    # `polygon_score` in the pipeline's `processing/scoring.py`.
    worst_by_concern: dict[str, int] = {}
    for value, rng in zip(values, preference_ranges(prefs)):
        if value is None or value != value:
            continue
        if rng.lo <= value <= rng.hi:
            verdict = 0
        elif rng.lo - rng.buffer <= value <= rng.hi + rng.buffer:
            verdict = 1
        else:
            verdict = 2
        group = rng.concern
        worst_by_concern[group] = max(worst_by_concern.get(group, 0), verdict)

    if not worst_by_concern:
        return None
    in_buffer = sum(1 for v in worst_by_concern.values() if v == 1)
    out_of_buffer = sum(1 for v in worst_by_concern.values() if v == 2)
    if out_of_buffer >= 2:
        return 0
    if out_of_buffer == 1:
        return 1
    if in_buffer >= 1:
        return 2
    return 3


def preference_score(
    values: Sequence[float | None], prefs: WeatherPreferences = DEFAULT_PREFERENCES
) -> int | None:
    """0–100 for one polygon-month, or ``None`` when it carries no data."""
    bucket = score_bucket(values, prefs)
    return None if bucket is None else BUCKET_SCORES[bucket]


# ─── reading the published bundle ────────────────────────────────────────


@dataclass(frozen=True)
class AlertOutcome:
    """What one alert scored this run, and whether that counts as a match."""

    score: int
    matches: bool
    #: 1..12 as the alert asked, or ``None`` for a month-less one.
    month: int | None
    #: The month the score is *about* — the alert's, or for a month-less alert
    #: the best one, which is the month the email and its link have to name.
    month_label: str
    #: What the email calls the place: "Peru", or "Cusco, Peru".
    place: str
    #: `/{country-slug}/{month-name}` — the page the email links to.
    path: str


_MONTH_SLUGS: tuple[str, ...] = (
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
)
MONTH_NAMES: tuple[str, ...] = tuple(s.capitalize() for s in _MONTH_SLUGS)


def _float_at(series: Any, index: int) -> float | None:
    if not isinstance(series, list) or index >= len(series):
        return None
    value = series[index]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = float(value)
    return None if value != value else value


class BundleMatchScorer:
    """Scores alerts against ``wtg publish api-data``'s output.

    The ISO-2 → slug map is read once per run and held for the life of the
    instance: the job constructs one, walks every alert, and exits. Nothing
    republishes the bundle mid-run, and `country_data` caches on mtime anyway.
    """

    def __init__(self, *, match_score: int | None = None) -> None:
        settings = get_settings()
        self._match_score = (
            settings.alert_match_score if match_score is None else match_score
        )
        self._slugs: dict[str, str] | None = None
        self._names: dict[str, str] = {}

    def _index(self) -> dict[str, str]:
        if self._slugs is None:
            slugs: dict[str, str] = {}
            for entry in country_data.load_index():
                if not isinstance(entry, dict):
                    continue
                iso2 = str(entry.get("iso2", "")).strip().upper()
                slug = str(entry.get("slug", "")).strip()
                if iso2 and slug:
                    slugs[iso2] = slug
                    self._names[iso2] = str(entry.get("name", "") or slug)
            self._slugs = slugs
        return self._slugs

    def _series_for(
        self, payload: Mapping[str, Any], region_code: str | None
    ) -> tuple[list[Any], str | None] | None:
        """``([t, rDay, s, tMin], region name)`` for the country, or three for a region.

        A region's rows carry no overnight series — the bundle publishes only
        `tl`/`rl`/`sl` — so a regional alert is scored on days, rain and sun
        alone, with the night treated as an absent variable the way the
        pipeline treats one. That is deliberate degradation rather than a fix:
        the *tiles* do score admin-1 polygons on both bounds, so a regional
        alert can still disagree with the colour on the map when a place has
        acceptable days and impossible nights. Closing it needs the pipeline
        to publish a regional night series; this cannot be done from here.

        A ``region_code`` that names no region in the payload returns ``None``
        rather than falling back to the country. The regions come and go with
        the Natural Earth vintage, and silently re-pointing an alert at the
        national average would change what the user asked about without saying
        so.
        """
        if region_code:
            regions = payload.get("regions")
            if not isinstance(regions, list):
                return None
            for region in regions:
                if not isinstance(region, dict):
                    continue
                if str(region.get("code", "")) == region_code:
                    return [region.get("tl"), region.get("rl"), region.get("sl")], str(
                        region.get("name", "") or region_code
                    )
            return None
        climate = payload.get("climate")
        if not isinstance(climate, Mapping):
            return None
        # `tMin` last, matching `preference_ranges`' ordering. `t` is the mean
        # daily *maximum* since the move to daily statistics, so these two are
        # the day/night pair the pipeline scores.
        return [
            climate.get("t"),
            climate.get("rDay"),
            climate.get("s"),
            climate.get("tMin"),
        ], None

    def score(self, alert: Alert) -> AlertOutcome | None:
        """``None`` when the bundle cannot answer for this alert.

        Which is not an error: a country the pipeline has no complete series
        for is simply absent from the index, and an alert on it should sit
        quiet rather than flip to "no longer matches" on the strength of
        missing data.
        """
        iso2 = (alert.country_iso2 or "").strip().upper()
        if not iso2:
            return None
        slug = self._index().get(iso2)
        if slug is None:
            return None
        payload = country_data.load_country(slug)
        if payload is None:
            return None

        found = self._series_for(payload, alert.region_code)
        if found is None:
            return None
        series, region_name = found

        prefs = parse_preferences(alert.preferences)
        country_name = self._names.get(iso2, slug)
        place = f"{region_name}, {country_name}" if region_name else country_name

        if alert.month is None:
            # A month-less alert asks "is this place ever right?", so it scores
            # as its best month — the same number the country page prints as
            # the headline. Scoring it as an annual mean would answer a
            # question nobody asked.
            best: tuple[int, int] | None = None
            for index in range(12):
                score = preference_score([_float_at(s, index) for s in series], prefs)
                if score is not None and (best is None or score > best[0]):
                    best = (score, index)
            if best is None:
                return None
            score, index = best
            return AlertOutcome(
                score=score,
                matches=score >= self._match_score,
                month=None,
                month_label=MONTH_NAMES[index],
                place=place,
                path=f"/{slug}/{_MONTH_SLUGS[index]}",
            )

        index = alert.month - 1
        if not 0 <= index < 12:
            return None
        score = preference_score([_float_at(s, index) for s in series], prefs)
        if score is None:
            return None
        return AlertOutcome(
            score=score,
            matches=score >= self._match_score,
            month=alert.month,
            month_label=MONTH_NAMES[index],
            place=place,
            path=f"/{slug}/{_MONTH_SLUGS[index]}",
        )
