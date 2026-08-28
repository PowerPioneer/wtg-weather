"""What a traveller can actually *do* in a place, and when.

Everything else this pipeline publishes is derived: a temperature comes out of
ERA5, an advisory level out of a government's own page, and the prose in
``publish/api_data.py`` is assembled from those numbers mechanically so that
every sentence is checkable against the chart printed beside it.

Tourist activities cannot work that way. No amount of climatology tells you
that the classic Inca Trail closes every February for maintenance while Machu
Picchu itself stays open all year — that is a fact about a permit office, not
about rainfall. So activities enter the pipeline the way advisories do: as
**curated data with a citation**, one JSON file per country in
``activity_data/``, and prose assembled from the structured fields here rather
than written per country.

That division is the whole point. A curator writes *facts with sources*; this
module writes *sentences*. Nothing downstream composes free text about a place,
which is what stops a plausible-sounding invention reaching a page. The
previous version of this site told readers Machu Picchu was closed in January.
It is not, and never was.

Schema — see ``activity_data/README.md`` for the curator's version:

    {
      "iso2": "PE",
      "reviewed": "2026-08-28",
      "activities": [
        {
          "id": "inca-trail",
          "name": "Classic Inca Trail",
          "kind": "trek",
          "regions": ["PE-CUS"],          // omit → the whole country
          "status": "open",               // the default for months no window names
          "windows": [
            {"status": "closed", "months": [2],
             "reason": "annual maintenance after the rains; reopens 1 March"}
          ],
          "sources": [{"url": "https://…", "checked": "2026-08-28"}]
        }
      ]
    }

Five statuses, ordered by how much they should worry a reader:

``closed``
    Normally runs, but is shut. A hard fact — a gate, a permit season, a road
    barrier — never a judgement about whether the weather is pleasant.
``limited``
    Open, but materially degraded: the view is usually cloud, the road needs a
    4x4, the river is too low to run.
``open``
    Available, nothing to say about it.
``best``
    Available and at its seasonal peak.
``not-on``
    Something that happens on a calendar, outside its window — a festival, a
    migration, a bloom, a nesting season. Inti Raymi is not *closed* in
    February; it is a festival held on 24 June, and the wildebeest are not
    *shut* in March, they are somewhere else. Treating these as closures would
    have every month of the year "closing something", which is both false and
    the end of any useful headline. ``not-on`` months are counted nowhere and
    listed on no month page — the thing appears in its own months, and in the
    country-page year view where its window is the point.

    Reserve it for things that genuinely are not there. A place that is open
    all year and merely looks different by season is ``open`` with ``best``
    windows: the Salar de Uyuni is not absent in July, it is dry.

The distinction between ``closed`` and ``limited`` is load-bearing and a
curator must not blur it. "Closed" moves people's flights; claiming it about a
month that is merely wet is the same class of error as the January Machu Picchu
claim, just quieter.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Iterable, Mapping, Sequence

log = logging.getLogger(__name__)

ACTIVITY_DATA_DIR = Path(__file__).resolve().parent / "activity_data"

MONTH_NAMES: tuple[str, ...] = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)

#: Worst-first. Used to pick a single headline status for a month and to sort
#: rows so a closure is never below an "open" a reader has to scroll past.
#: ``not-on`` sorts last because it is the only status that is not news.
STATUS_ORDER: tuple[str, ...] = ("closed", "limited", "best", "open", "not-on")
VALID_STATUSES = frozenset(STATUS_ORDER)


def _status_rank(status: str) -> int:
    return STATUS_ORDER.index(status) if status in VALID_STATUSES else len(STATUS_ORDER)


@dataclass(frozen=True)
class Source:
    """Where a claim came from, and when it was last read.

    ``checked`` is deliberately the curator's date rather than a scrape's: this
    is hand-verified data, and the honest thing to record is when a human last
    looked, not when a file was touched.
    """

    url: str
    checked: str

    def to_json(self) -> dict[str, str]:
        return {"url": self.url, "checked": self.checked}


@dataclass(frozen=True)
class Window:
    """A run of months where an activity departs from its default status."""

    status: str
    months: tuple[int, ...]  # 1-12
    reason: str


@dataclass(frozen=True)
class Activity:
    id: str
    name: str
    kind: str
    status: str
    windows: tuple[Window, ...] = ()
    regions: tuple[str, ...] = ()
    note: str = ""
    sources: tuple[Source, ...] = ()

    def month_status(self, month: int) -> tuple[str, str]:
        """``(status, reason)`` for a 1-12 month.

        The first window naming the month wins, so a curator can write the
        general case first and a carve-out after it. Windows are few and
        hand-written; there is no cleverness to be had here.
        """
        for window in self.windows:
            if month in window.months:
                return window.status, window.reason
        return self.status, self.note

    @property
    def year_round(self) -> bool:
        """True when nothing about the calendar changes this activity."""
        return not self.windows and self.status in ("open", "best")

    @property
    def dated_event(self) -> bool:
        """A thing that happens on a date rather than a thing that is open.

        Its default status is ``not-on``; the windows say when it happens.
        """
        return self.status == "not-on"

    def on_months(self) -> tuple[int, ...]:
        """Months in which this is not ``not-on`` — its actual calendar."""
        return tuple(m for m in range(1, 13) if self.month_status(m)[0] != "not-on")


@dataclass(frozen=True)
class CountryActivities:
    iso2: str
    reviewed: str
    activities: tuple[Activity, ...] = field(default=())

    def for_region(self, codes: Iterable[str]) -> tuple[Activity, ...]:
        """Activities a region should claim.

        A region page shows only what genuinely names it. An activity with no
        ``regions`` is country-wide and appears on the country and month pages,
        not on every one of the country's subdivisions — "Peru has an Amazon"
        is not a fact about Arequipa.
        """
        wanted = {c.upper() for c in codes if c}
        if not wanted:
            return ()
        return tuple(a for a in self.activities if wanted & {r.upper() for r in a.regions})


# ─── loading ─────────────────────────────────────────────────────────────


def _parse_months(raw: object, *, where: str) -> tuple[int, ...]:
    if not isinstance(raw, list) or not raw:
        raise ValueError(f"{where}: 'months' must be a non-empty list of 1-12")
    months: list[int] = []
    for value in raw:
        if not isinstance(value, int) or not 1 <= value <= 12:
            raise ValueError(f"{where}: month {value!r} is not 1-12")
        months.append(value)
    return tuple(sorted(set(months)))


def _parse_activity(raw: Mapping[str, object], *, iso2: str) -> Activity:
    ident = str(raw.get("id") or "").strip()
    name = str(raw.get("name") or "").strip()
    if not ident or not name:
        raise ValueError(f"{iso2}: every activity needs an 'id' and a 'name'")
    where = f"{iso2}/{ident}"

    status = str(raw.get("status") or "open")
    if status not in VALID_STATUSES:
        raise ValueError(f"{where}: status {status!r} is not one of {sorted(VALID_STATUSES)}")

    windows: list[Window] = []
    for entry in raw.get("windows") or ():
        if not isinstance(entry, Mapping):
            raise ValueError(f"{where}: each window must be an object")
        w_status = str(entry.get("status") or "")
        if w_status not in VALID_STATUSES:
            raise ValueError(f"{where}: window status {w_status!r} is not valid")
        reason = str(entry.get("reason") or "").strip()
        if not reason:
            # A status with no reason is exactly the kind of unsupported claim
            # this module exists to prevent — the reason is what the reader
            # checks, and what a curator has to have a source for.
            raise ValueError(f"{where}: a {w_status!r} window must give a 'reason'")
        windows.append(
            Window(status=w_status, months=_parse_months(entry.get("months"), where=where), reason=reason)
        )

    sources: list[Source] = []
    for entry in raw.get("sources") or ():
        if not isinstance(entry, Mapping):
            raise ValueError(f"{where}: each source must be an object")
        url = str(entry.get("url") or "").strip()
        checked = str(entry.get("checked") or "").strip()
        if not url or not checked:
            raise ValueError(f"{where}: each source needs a 'url' and a 'checked' date")
        sources.append(Source(url=url, checked=checked))
    if not sources:
        raise ValueError(f"{where}: no sources — an uncited activity does not ship")

    regions = tuple(str(r).strip().upper() for r in raw.get("regions") or () if str(r).strip())
    return Activity(
        id=ident,
        name=name,
        kind=str(raw.get("kind") or "site"),
        status=status,
        windows=tuple(windows),
        regions=regions,
        note=str(raw.get("note") or "").strip(),
        sources=tuple(sources),
    )


def load_country(path: Path) -> CountryActivities:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, Mapping):
        raise ValueError(f"{path.name}: expected an object at the top level")
    iso2 = str(raw.get("iso2") or path.stem).strip().upper()
    activities = [
        _parse_activity(a, iso2=iso2)
        for a in raw.get("activities") or ()
        if isinstance(a, Mapping)
    ]
    # Worst-first, then by name: the ordering a reader scanning for a problem
    # wants, and stable so a payload does not churn on re-publish.
    activities.sort(key=lambda a: (_status_rank(a.status), a.name))
    return CountryActivities(
        iso2=iso2,
        reviewed=str(raw.get("reviewed") or "").strip(),
        activities=tuple(activities),
    )


@lru_cache(maxsize=1)
def load_all(data_dir: Path | None = None) -> dict[str, CountryActivities]:
    """``{ISO-2: CountryActivities}`` for every curated file present.

    Missing is normal and not an error. Coverage is tiered by how much a
    country is actually travelled, and a country with no file renders no
    section at all — a "no data" placeholder reads as a broken page, where an
    absent section reads as a page about something else.
    """
    directory = data_dir or ACTIVITY_DATA_DIR
    out: dict[str, CountryActivities] = {}
    if not directory.exists():
        return out
    for path in sorted(directory.glob("*.json")):
        try:
            country = load_country(path)
        except (ValueError, json.JSONDecodeError) as exc:
            # One malformed file must not cost every other country its
            # activities, but it must be loud: this is hand-edited data and a
            # silent drop is how a country quietly loses its section.
            log.error("ACTIVITY_INVALID file=%s — %s", path.name, exc)
            continue
        out[country.iso2] = country
    return out


# ─── prose ───────────────────────────────────────────────────────────────
#
# Voice D, "hybrid": one lede sentence whose *shape* a human chose, over rows
# a machine assembled. The lede states only what can be counted — how many
# things close, how many peak — so it cannot drift from the rows beneath it.


def _plural(count: int, singular: str, plural: str | None = None) -> str:
    return singular if count == 1 else (plural or f"{singular}s")


def month_rows(
    activities: Sequence[Activity], month: int
) -> list[dict[str, object]]:
    """One row per activity, worst-status first, for a given 1-12 month.

    A dated event outside its date is dropped rather than listed: telling a
    reader planning February that a June festival is not happening is noise,
    and eleven such rows would bury the one row that matters.
    """
    rows = []
    for activity in activities:
        status, reason = activity.month_status(month)
        if status == "not-on":
            continue
        rows.append(
            {
                "id": activity.id,
                "name": activity.name,
                "kind": activity.kind,
                "status": status,
                "reason": reason,
                "regions": list(activity.regions),
                "sources": [s.to_json() for s in activity.sources],
            }
        )
    rows.sort(key=lambda r: (_status_rank(str(r["status"])), str(r["name"])))
    return rows


def closure_months(activities: Sequence[Activity]) -> set[int]:
    """Every month in which anything that normally runs is shut.

    ``not-on`` never counts — see the module docstring. A festival's other
    eleven months are not closures, and counting them as such would make every
    month of the year "close something".
    """
    return {
        month
        for month in range(1, 13)
        for activity in activities
        if activity.month_status(month)[0] == "closed"
    }


def build_month_lede(
    activities: Sequence[Activity], month: int, *, country_name: str
) -> str:
    """The one editorial sentence above the month's rows.

    Every branch is driven by a count, so the sentence is as checkable as the
    list it introduces. It says nothing the rows do not also say.
    """
    if not activities:
        return ""
    # Same filter as `month_rows`, for the same reason: the sentence counts
    # what the list shows, or it is describing a different page.
    statuses = [s for s in (a.month_status(month)[0] for a in activities) if s != "not-on"]
    if not statuses:
        return ""
    closed = statuses.count("closed")
    limited = statuses.count("limited")
    best = statuses.count("best")
    month_name = MONTH_NAMES[month - 1]
    shut_months = closure_months(activities)

    # A closure is always the headline — it is the only thing here that can
    # ruin a trip that is already booked.
    if closed:
        thing = _plural(closed, "thing")
        if shut_months == {month}:
            return (
                f"{month_name} is the only month {country_name} closes anything — "
                f"{closed} {thing} below."
            )
        return f"{month_name} closes {closed} {thing} below; the rest run as normal."

    # Otherwise lead with whichever count is larger. A month with five things
    # at their peak and one weather-dependent is a good month, and a sentence
    # that opens on the caveat describes it backwards.
    opener = (
        f"Nothing in {country_name} shuts for the season"
        if not shut_months
        else f"Nothing is closed in {month_name}"
    )
    # The two openers differ in whether they have already named the month.
    tail = f" in {month_name}." if not shut_months else "."

    if best and best >= limited:
        clause = (
            f"{opener}, and {best} {_plural(best, 'thing')} below "
            f"{_plural(best, 'is', 'are')} at {_plural(best, 'its', 'their')} best"
        )
        if limited:
            clause += f", though {limited} {_plural(limited, 'is', 'are')} weather-dependent"
        return clause + tail
    if limited:
        clause = (
            f"{opener}, but {limited} {_plural(limited, 'thing')} below "
            f"{_plural(limited, 'is', 'are')} weather-dependent"
        )
        if best:
            clause += f" and {best} {_plural(best, 'is', 'are')} at {_plural(best, 'its', 'their')} best"
        return clause + tail
    if not shut_months:
        return f"Nothing in {country_name} shuts for the season; {month_name} runs the full list."
    return f"Everything below is open in {month_name}."


def format_month_run(months: Sequence[int]) -> str:
    """``"February"``, ``"May–September"``, ``"October–June"`` — contiguous runs.

    The wrap is the point. A northern-hemisphere off-season written as
    "January, February, March, April, May, June, October, November and
    December" is the same fact as "October–June" and reads as nine separate
    ones. Mirrored by ``formatMonthRun`` in ``web/src/lib/activities.ts``,
    which does the same job for the calendar line under each row.
    """
    present = set(months)
    if not present:
        return ""
    if len(present) == 12:
        return "every month of the year"

    # Start at a month whose predecessor is absent, so a run that crosses
    # January is walked as one run rather than split at the year boundary.
    start = 1
    for month in range(1, 13):
        previous = 12 if month == 1 else month - 1
        if month in present and previous not in present:
            start = month
            break

    runs: list[list[int]] = []
    current: list[int] = []
    for step in range(12):
        month = (start - 1 + step) % 12 + 1
        if month in present:
            current.append(month)
        elif current:
            runs.append(current)
            current = []
    if current:
        runs.append(current)

    named = [
        MONTH_NAMES[run[0] - 1]
        if len(run) == 1
        else f"{MONTH_NAMES[run[0] - 1]}–{MONTH_NAMES[run[-1] - 1]}"
        for run in runs
    ]
    if len(named) == 1:
        return named[0]
    return ", ".join(named[:-1]) + f" and {named[-1]}"


def build_year_lede(activities: Sequence[Activity], *, country_name: str) -> str:
    """The same sentence's year-level sibling, for the country page."""
    if not activities:
        return ""
    shut_months = sorted(closure_months(activities))
    # A dated event is not one of the "things that run all year", and counting
    # it against that total would understate how open a country actually is.
    standing = [a for a in activities if not a.dated_event]

    # A list that is *entirely* calendar-bound — a country curated for its
    # festivals and its wildlife windows rather than its buildings. Saying
    # "0 of 0 run all year" would be arithmetic rather than a sentence.
    if not standing:
        count = len(activities)
        if count == 1:
            return (
                "The single entry below runs to a calendar rather than standing "
                "open — it has a window, not opening hours."
            )
        return (
            f"Everything below runs to a calendar rather than standing open — "
            f"{count} things, each with its own window."
        )

    year_round = sum(1 for a in standing if a.year_round)
    total = len(standing)
    seasonal = total - year_round

    if not shut_months:
        if year_round == total:
            return (
                f"Nothing on this list closes for the season in {country_name} — "
                f"the calendar changes how good things are, not whether they run."
            )
        if year_round == 0:
            return (
                f"Nothing on this list closes for the season in {country_name}, but "
                f"every one of them has a window worth aiming for."
            )
        return (
            f"Nothing on this list closes for the season in {country_name}, though "
            f"{seasonal} of {total} {_plural(seasonal, 'has', 'have')} "
            f"a window worth aiming for."
        )

    # How much of the year runs all twelve months, phrased as a count rather
    # than as "0 of 4", which reads as a scoreboard and buries the fact.
    if year_round == 0:
        tail = "nothing below runs the whole year"
    elif year_round == total:
        tail = "everything below still runs the whole year"
    elif year_round == 1:
        tail = f"one of the {total} below runs all year"
    else:
        tail = f"{year_round} of {total} below run all year"

    if len(shut_months) == 12:
        # Iceland, and anywhere else whose whole list is a seasonal calendar.
        # Naming twelve months would be the joke version of this sentence.
        return (
            f"{country_name}'s list is seasonal end to end: something below is "
            f"out of season in every month of the year, and {tail}."
        )
    listed = format_month_run(shut_months)
    if len(shut_months) == 1:
        return f"{listed} is the only month {country_name} closes anything; {tail}."
    return f"{country_name} closes something in {listed}; {tail}."
