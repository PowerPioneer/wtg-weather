"""The country page's intro paragraph, written for someone planning a trip.

It replaced a paragraph that read like a data dictionary — "national averages
run from 20 °C in July to 30 °C in January, with rainfall between 12 mm…" —
which was accurate and answered nothing a traveller asks. This one answers, in
order: when to go, what the rest of the year is like and why, and what the
curated activities say about timing.

The rule that made the old paragraph dry still holds, and it is the point of
this module: **nothing here is written per country.** Every clause is a
template filled from one of two sources —

* the climate series printed on the same page (the month runs, highs, lows,
  rainfall and sunshine named here can each be read off its charts), scored by
  the same rule that colours the map; or
* the curated activity data, whose names, months and ``reason`` text are hand
  checked against a cited source (``processing/activity_data/README.md``).

So a sentence here can be dull, but it cannot be invented. Anything that would
need an adjective the data does not carry ("stunning", "vibrant") is out.

Measurements are written as ``N °C`` and ``N mm`` on purpose: the web rewrites
exactly those shapes for an imperial reader (``convertMeasurementsInText`` in
``web/src/lib/units.ts``), and anything else would stay metric on a page
showing °F.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Sequence

from wtg_pipeline.processing.activities import (
    MONTH_NAMES,
    Activity,
    CountryActivities,
    format_month_run,
)
from wtg_pipeline.processing.scoring import DEFAULT_PREFERENCES

# Bucket centroids, as `PolygonClimate.scores` emits them (`SCORE_TO_PREF`).
PERFECT, GOOD = 90, 75

DAYS_IN_MONTH: tuple[int, ...] = (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)

_PREFS = {p.variable: p for p in DEFAULT_PREFERENCES}
#: The plain-words name for the default preferences. It has to stay true to
#: `DEFAULT_PREFERENCES`; `test_intro.py` pins the two together.
PREFERENCE_WORDS = "warm, dry and sunny weather"

#: At most this many activity sentences. Three is about where an intro stops
#: being an intro and becomes the list printed further down the page.
MAX_ACTIVITY_SENTENCES = 3

# Country names that take "the" in running text. Most are caught by the
# patterns in `with_article`; these are the ones a pattern cannot see.
_THE = frozenset({"Netherlands", "Philippines", "Maldives", "Seychelles", "Comoros", "Gambia"})
_NO_THE = frozenset({
    "Heard Island and McDonald Islands",
    "South Georgia and the South Sandwich Islands",
    "Saint Vincent and the Grenadines",
    "Isle of Man",
})
_THE_PATTERNS = ("Republic", "United ", "Kingdom", "Emirates", "Federated States", "Territory", "Lands")


def with_article(name: str) -> str:
    """``Netherlands`` → ``the Netherlands``, as it reads mid-sentence."""
    if name.startswith("The "):
        return "the " + name[4:]
    if name in _NO_THE:
        return name
    if name in _THE or name.endswith(" Islands") or any(p in name for p in _THE_PATTERNS):
        return "the " + name
    return name


def _sentence_case(text: str) -> str:
    return text[:1].upper() + text[1:]


def _degrees(values: Sequence[float]) -> str:
    low, high = round(min(values)), round(max(values))
    return f"{low} °C" if low == high else f"{low}–{high} °C"


# ─── the climate half ────────────────────────────────────────────────────


@dataclass(frozen=True)
class MonthlyClimate:
    """Twelve values per series, January first, in display units."""

    t_max: Sequence[float]
    t_min: Sequence[float]
    rain_day: Sequence[float]  # mm / day
    sun: Sequence[float]  # h / day
    scores: Sequence[int]  # bucket centroids, one per month

    def rain_month(self, month: int) -> float:
        return self.rain_day[month - 1] * DAYS_IN_MONTH[month - 1]


def best_months(scores: Sequence[int]) -> list[int]:
    """Every month at the top verdict — not a top three, which split ties."""
    top = max(scores)
    return [m for m in range(1, 13) if scores[m - 1] == top]


#: The site's own four words (`ScoreBadge`), as they read inside a sentence.
_MATCH_WORDS = {PERFECT: "a perfect match", GOOD: "a good option", 60: "acceptable", 25: "a poor match"}

#: Past this many months, "the best time" is most of the year and the averages
#: across it describe no month anyone will travel in — the same reason the
#: country page's own best-months strip stops at three.
_MAX_MONTHS_FOR_FIGURES = 6


def _when_to_go(name: str, climate: MonthlyClimate) -> str:
    best = best_months(climate.scores)
    top = max(climate.scores)
    place = with_article(name)
    run = format_month_run(best)
    conditions = ""
    if len(best) <= _MAX_MONTHS_FOR_FIGURES:
        highs = _degrees([climate.t_max[m - 1] for m in best])
        rain = round(sum(climate.rain_month(m) for m in best) / len(best))
        sun = _hours(sum(climate.sun[m - 1] for m in best) / len(best))
        conditions = (
            f", with daytime highs of {highs}, around {rain} mm of rain a month "
            f"and {sun} of sun a day"
        )
    if len(best) == 12:
        # The year is one season, so the range of highs is the one figure
        # worth giving — it is the whole of the temperature chart.
        conditions = f", with daytime highs of {_degrees(climate.t_max)}"
        lead = f"{_sentence_case(place)} is {_MATCH_WORDS[top]} for {PREFERENCE_WORDS} in every month"
    else:
        lead = f"The best time to visit {place} for {PREFERENCE_WORDS} is {run}"
        if top < PERFECT:
            lead += f", though even then it is only {_MATCH_WORDS[top]}"
    return f"{lead}{conditions}."


#: Order matters on a tie: rain spoils a trip more visibly than a grey sky.
_CONCERNS = ("rain", "heat", "cold", "cloud")


def _miss(value: float, lo: float, hi: float, buffer: float, *, above: bool) -> int:
    """0 inside, 1 inside the buffer, 2 beyond it — on one side only."""
    if above:
        return 0 if value <= hi else 1 if value <= hi + buffer else 2
    return 0 if value >= lo else 1 if value >= lo - buffer else 2


def _misses(climate: MonthlyClimate, month: int) -> dict[str, int]:
    """Each concern's verdict for ``month`` under the default preferences."""
    i = month - 1
    t_max, t_min, rain, sun = _PREFS["t2m_max"], _PREFS["t2m_min"], _PREFS["tp"], _PREFS["sun_hours"]
    return {
        "rain": _miss(climate.rain_day[i], rain.lo, rain.hi, rain.buffer, above=True),
        "heat": max(
            _miss(climate.t_max[i], t_max.lo, t_max.hi, t_max.buffer, above=True),
            _miss(climate.t_min[i], t_min.lo, t_min.hi, t_min.buffer, above=True),
        ),
        "cold": max(
            _miss(climate.t_max[i], t_max.lo, t_max.hi, t_max.buffer, above=False),
            _miss(climate.t_min[i], t_min.lo, t_min.hi, t_min.buffer, above=False),
        ),
        "cloud": _miss(climate.sun[i], sun.lo, sun.hi, sun.buffer, above=False),
    }


def _numerically_worse(concern: str, month: int, best: Sequence[int], climate: MonthlyClimate) -> bool:
    """Whether the comparative the clause will print is true of the figures.

    "Wetter", "hotter", "cooler", "greyer" all compare with the best months,
    and a reader can check them against the charts. Iceland is the case that
    needed this: its best months are its sunny spring at 3–9 °C, so calling
    July "cooler" at 11 °C because it misses the temperature preference would
    have been false on its face.

    Compared as printed — rounded — because a "hotter" month at 30.4 °C beside
    best months at 29.6 °C reads as "30 °C, hotter than 30 °C".
    """
    i = month - 1
    if concern == "rain":
        return round(climate.rain_month(month)) > round(max(climate.rain_month(b) for b in best))
    if concern == "heat":
        return round(climate.t_max[i]) > round(max(climate.t_max[b - 1] for b in best)) or round(
            climate.t_min[i]
        ) > round(max(climate.t_min[b - 1] for b in best))
    if concern == "cold":
        return round(climate.t_max[i]) < round(min(climate.t_max[b - 1] for b in best)) or round(
            climate.t_min[i]
        ) < round(min(climate.t_min[b - 1] for b in best))
    return round(climate.sun[i]) < round(min(climate.sun[b - 1] for b in best))


def _why_not(climate: MonthlyClimate, month: int, best: Sequence[int]) -> str | None:
    """What makes ``month`` worse than the best months — the thing to name.

    Not simply its worst concern: a month can miss on temperature exactly as
    badly as the best months do and lose on rain, and then rain is the reason.
    """
    misses = _misses(climate, month)
    reference = {c: max(_misses(climate, b)[c] for b in best) for c in _CONCERNS}
    candidates = [
        c
        for c in _CONCERNS
        if misses[c] > reference[c] and _numerically_worse(c, month, best, climate)
    ]
    if not candidates:
        return None
    worst = max(misses[c] for c in candidates)
    return next(c for c in candidates if misses[c] == worst)


def _off_season_clause(
    concern: str, months: list[int], best: Sequence[int], climate: MonthlyClimate
) -> str:
    run = format_month_run(months)
    # "April and October are", "May–September is": one run is one stretch.
    verb = "are" if (" and " in run or ", " in run) else "is"
    highs = [climate.t_max[m - 1] for m in months]
    lows = [climate.t_min[m - 1] for m in months]
    best_highs = [climate.t_max[b - 1] for b in best]
    if concern == "rain":
        wettest = max(months, key=climate.rain_month)
        rain = round(climate.rain_month(wettest))
        if len(months) == 1:
            return f"{run} {verb} wetter, with about {rain} mm of rain"
        return f"{run} {verb} wetter, with up to {rain} mm of rain in {MONTH_NAMES[wettest - 1]}"
    # Rounded, as printed: see `_numerically_worse`.
    if concern == "heat":
        if round(max(highs)) > round(max(best_highs)):
            return f"{run} {verb} hotter, with highs near {round(max(highs))} °C"
        return f"{run} {verb} warmer at night, with lows near {round(max(lows))} °C"
    if concern == "cold":
        if round(min(highs)) < round(min(best_highs)):
            return f"{run} {verb} cooler, with highs around {round(min(highs))} °C and nights near {round(min(lows))} °C"
        return f"{run} {verb} colder at night, with lows near {round(min(lows))} °C"
    dullest = min(climate.sun[m - 1] for m in months)
    return f"{run} {verb} greyer, with about {_hours(dullest)} of sun a day"


def _hours(value: float) -> str:
    """``8 hours``, but ``0.8 hours`` rather than ``1 hours`` in a polar winter."""
    if value < 1.5:
        return f"{value:.1f} hours"
    return f"{round(value)} hours"


def _rest_of_year(climate: MonthlyClimate) -> str | None:
    best = best_months(climate.scores)
    groups: dict[str, list[int]] = {}
    for month in range(1, 13):
        if month in best:
            continue
        concern = _why_not(climate, month, best)
        if concern is not None:
            groups.setdefault(concern, []).append(month)
    if not groups:
        return None
    ranked = sorted(groups.items(), key=lambda kv: (-len(kv[1]), _CONCERNS.index(kv[0])))[:2]
    clauses = [_off_season_clause(concern, months, best, climate) for concern, months in ranked]
    return _sentence_case("; ".join(clauses)) + "."


# ─── the activity half ───────────────────────────────────────────────────


def _label(name: str) -> str:
    """``Southern right whales, Hermanus`` → ``Southern right whales in Hermanus``.

    Activity names are list labels; a comma that reads fine in a list breaks a
    sentence. A name with a parenthesis is left alone — its comma is inside a
    list of resorts ("Highland F-roads (Landmannalaugar, Askja)").
    """
    if "(" in name:
        return name
    head, sep, place = name.partition(", ")
    # A lowercase tail is either a list ("Diving, snorkelling and the canal")
    # or already a place phrase ("…, above Almaty"); "in" suits neither.
    if not sep or place[:1].islower() or _is_list(place):
        return name
    return f"{head} in {place}"


_JOINERS = (
    " at ", " in ", " with ", " on ", " of ", " to ", " across ", " from ",
    " off ", " near ", " around ", " along ", " by ", " below ", " above ", " under ",
)


def _is_list(after_comma: str) -> bool:
    """``snorkelling and the canal``, ``Grimsel and Susten passes``: not a place.

    The comma in "Diving, snorkelling and the canal" separates items rather
    than an activity from where it happens. A lowercase tail that opens with a
    preposition ("above Almaty") is a place after all.
    """
    if " and " in after_comma:
        return True
    first = after_comma.split(" ")[0]
    return after_comma[:1].islower() and f" {first} " not in _JOINERS


#: Capitalised words that are plural in English names. Any other capitalised
#: word ending in "s" is read as singular, because in this dataset it almost
#: always is: Victoria Falls, Persepolis, Christmas, Vincy Mas, Caño Cristales.
_PLURAL_PROPER = frozenset({"Islands", "Lakes", "Walks", "Mountains", "Waterfalls", "Cliffs", "Races", "Fiestas"})

#: Gerunds that read as adjectives on a plural noun ("Nesting sea turtles",
#: "Walking safaris"), unlike "Tracking jaguars", which is one activity.
_ADJECTIVAL_GERUNDS = frozenset({"Nesting", "Walking", "Wintering", "Breeding", "Migrating", "Flowering"})


def _is_plural_noun(word: str, *, opens_label: bool = False) -> bool:
    """Whether ``word`` is a plural noun, judged as far as spelling allows.

    A capital means a name, and names ending in "s" are mostly singular here —
    except on a label's first word, which is capitalised regardless. There the
    ending decides: "Bluebells" and "Flamingos" are plural, "Persepolis" is not.
    """
    word = word.split("-")[-1]  # "F-roads" is roads
    if word in _PLURAL_PROPER:
        return True
    if word[:1].isupper():
        if not opens_label:
            return False
        # Persepolis, Christmas: a name's ending, not a plural one.
        if word.endswith(("is", "us", "mas")):
            return False
    return word.endswith("s") and not word.endswith(("ss", "'s"))


def _is_plural(name: str, *, event: bool = False) -> bool:
    """Whether a label takes "are": ``Northern lights`` yes, ``Skiing at …`` no.

    Judged on the head noun phrase — the part before " at ", " in ", " with ",
    a comma or a parenthesis — because the rest names a place. A gerund leads a
    singular phrase however plural its object ("Swimming with whale sharks").
    It is a heuristic over 960 labels, not a grammar; `test_intro.py` pins the
    shapes the dataset actually has.
    """
    without_parens = re.sub(r"\s*\([^)]*\)", "", name)
    head, sep, after = without_parens.partition(", ")
    if sep and _is_list(after):
        return True
    named_of = False
    for joiner in _JOINERS:
        before, found, rest = head.partition(joiner)
        if not found:
            continue
        # "Isle of Man TT races" is one name for plural races; "Battle of
        # Flowers" and "Carnival of Venice" are one event each.
        rest_words = rest.split()
        if joiner == " of " and len(rest_words) > 1 and _is_plural_noun(rest_words[-1]):
            continue
        # "Peaks of the Balkans trail", "Wings of Tatev cable car": an "X of Y"
        # name is one thing, whatever X's ending ("Cliffs" is listed above).
        named_of = joiner == " of " and len(before.split()) == 1
        head = before
    words = head.split()
    if not words:
        return False
    if words[0] in _PLURAL_PROPER:
        return True  # "Fiestas Patrias"
    # A possessive makes what follows it the head: "Blacks and Whites' Carnival".
    possessive = max((i for i, w in enumerate(words) if w.endswith(("'", "'s"))), default=-1)
    if possessive >= 0:
        words = words[possessive + 1 :] or words
    gerund = words[0].endswith("ing") and words[0] not in _ADJECTIVAL_GERUNDS
    # Two named things are plural whatever each one is ("Masada and the Dead
    # Sea"); two activities are one pursuit ("Diving and snorkelling",
    # "Hiking southern Bioko and the Iladyi cascades").
    if " and " in " ".join(words) and possessive < 0:
        return not (gerund or words[-1].endswith("ing"))
    if gerund:
        return False
    # An event is one thing however its name is spelled: "Bruges at Christmas".
    opens_label = len(words) == 1 and possessive < 0 and not event and not named_of
    return _is_plural_noun(words[-1], opens_label=opens_label)


def _verb(name: str, singular: str, plural: str, *, event: bool = False) -> str:
    return plural if _is_plural(name, event=event) else singular


def _first_window(activity: Activity, *statuses: str) -> tuple[list[int], str] | None:
    """The first window with one of ``statuses``: its months and its reason.

    One window, not the union of all of them. A reason is written for its own
    window — "the Kaskazi blows from December to March" — and printed beside a
    second window's months it would be describing the wrong season.
    """
    for window in activity.windows:
        if window.status in statuses:
            return sorted(window.months), _short_reason(window.reason)
    return None


def _short_reason(reason: str) -> str:
    """The reason up to its first full stop or semicolon.

    Curated reasons run to two or three clauses, which is right in the list
    and too much for an intro. A leading clause of a sourced sentence is still
    the sourced sentence, so cutting it keeps the claim honest; rewording it
    would not.
    """
    for stop in ("; ", ". ", ": ", " — ", " - "):
        reason = reason.split(stop)[0]
    return reason.rstrip(". ")


def _activity_sentences(curated: CountryActivities | None) -> list[str]:
    if curated is None:
        return []
    sentences: list[str] = []
    used: set[str] = set()

    # A closure first: it is the thing most likely to change someone's plans.
    for activity in curated.activities:
        closed = _first_window(activity, "closed")
        if closed is not None:
            label = _label(activity.name)
            months, reason = closed
            sentences.append(
                f"{label} {_verb(label, 'is', 'are')} closed in {format_month_run(months)}: {reason}."
            )
            used.add(activity.id)
            break

    for activity in curated.activities:
        if len(sentences) >= MAX_ACTIVITY_SENTENCES:
            break
        if activity.id in used:
            continue
        label = _label(activity.name)
        if activity.kind == "festival":
            window = _first_window(activity, "best", "open")
            template = "{label} {is_} held in {run}: {reason}."
        else:
            window = _first_window(activity, "best")
            template = "{label} {is_} at {its} best in {run}: {reason}."
        if window is None:
            continue
        months, reason = window
        sentences.append(
            template.format(
                label=label,
                is_=_verb(label, "is", "are", event=activity.kind == "festival"),
                its=_verb(label, "its", "their"),
                run=format_month_run(months),
                reason=reason,
            )
        )
        used.add(activity.id)
    return sentences


# ─── the paragraph ───────────────────────────────────────────────────────


def build_intro(
    *,
    name: str,
    climate: MonthlyClimate,
    curated: CountryActivities | None = None,
    from_regions: bool = False,
    parent: tuple[str, Sequence[int]] | None = None,
) -> str:
    """The intro paragraph: when to go, the rest of the year, then what to do.

    ``parent`` is ``(country name, its best months)`` for a region's intro.
    When the region's season differs from the country's, it says so — that
    difference is the reason to read a region page at all.
    """
    sentences = [_when_to_go(name, climate)]
    rest = _rest_of_year(climate)
    if rest:
        sentences.append(rest)
    if parent is not None:
        country, national = parent
        if national and set(national) != set(best_months(climate.scores)):
            sentences.append(
                f"Across {with_article(country)} as a whole, the best months are "
                f"{format_month_run(sorted(national))}."
            )
    sentences.extend(_activity_sentences(curated))
    if from_regions:
        sentences.append(
            f"The map paints {with_article(name)} as a mosaic of its regions rather than "
            f"one national colour; the figures here are the average of those regions."
        )
    return " ".join(sentences)
