"""Dutch Ministry of Foreign Affairs (BZ) travel advisories.

Source: https://opendata.nederlandwereldwijd.nl/v2/sources/nederlandwereldwijd/infotypes/traveladvice

The open-data REST API exposes one record per destination. The colour
(``groen``/``geel``/``oranje``/``rood``) maps 1:1 onto our canonical 1..4
ladder:

========  ==============================================  ======
Colour    Meaning                                          Level
========  ==============================================  ======
groen     No particular safety risks                        1
geel      Pay attention — safety risks exist                2
oranje    Only essential travel                             3
rood      Do not travel                                     4
========  ==============================================  ======

Reading the colour off the record is the whole difficulty, and getting it
wrong is expensive: a scrape on 2026-08-06 rated **61 of 224 countries
"rood"** — Japan, South Korea, India, Thailand, Turkey, Peru, Georgia among
them — because the parser took the first colour word following the first
occurrence of "kleurcode" anywhere in the ``introduction`` blob. Every other
government rates those 1–2. Consensus across governments is `max`, so a single
over-reporting source paints a quarter of the world "Do Not Travel".

What the ``introduction`` field actually contains
-------------------------------------------------

Two shapes. Roughly half the records are one sentence::

    De kleurcode van het reisadvies voor Duitsland is groen.

The other half are an HTML ``<ul>`` whose bullets mix regional carve-outs
with the country-wide code, **carve-outs first**::

    <li>De kleurcode van het reisadvies voor het zuidoosten van Fukushima
        is rood. …</li>
    <li>Voor de rest van Japan geldt kleurcode groen. …</li>

Which is why "first colour wins" reads Japan as red.

How this module decides
-----------------------

Each sentence that mentions ``kleurcode`` and a colour is reduced to a
``(subject, colour)`` pair. Dutch word order does most of the work — the
subject is whatever the colour is predicated of:

===========================================  ==========================
Phrasing                                     Subject
===========================================  ==========================
``voor <X> is <kleur>``                      X
``voor <X> geldt … kleurcode <kleur>``       X
``kleurcode <kleur> geldt … voor <X>``       X
``kleurcode … is <kleur> voor <X>``          X
``kleurcode … is <kleur>`` (no ``voor``)     the country, implicitly
===========================================  ==========================

A subject naming the whole country ("Duitsland", "de rest van Japan", "het
hele land") gives the country-wide level; anything else is a regional
carve-out, emitted as the ``regional-L<n>`` sentinel the other scrapers use,
because the API names areas in prose that we cannot resolve to an ISO-3166-2
polygon.

**When no sentence names the whole country, this scraper emits no
country-wide row at all.** Iraq and the Palestinian Territories are described
purely region by region, and there genuinely is no national colour to report.
Failing toward silence rather than toward the worst regional colour is the
point: an unrecognised country name costs us one source's opinion, which the
other five cover, while a wrong "rood" is a false claim about a real place.
"""

from __future__ import annotations

import json
import logging
import re
import unicodedata
from datetime import datetime

from wtg_pipeline.sources.advisories.base import (
    Advisory,
    AdvisoryScraper,
    load_mapping,
    utcnow,
)

log = logging.getLogger(__name__)

INDEX_URL = "https://www.nederlandwereldwijd.nl/reisadvies"
API_URL = (
    "https://opendata.nederlandwereldwijd.nl/v2/sources/nederlandwereldwijd"
    "/infotypes/traveladvice"
)
PAGE_SIZE = 25

_COLOUR_LEVEL: dict[str, int] = {
    "groen": 1,
    "geel": 2,
    "oranje": 3,
    "rood": 4,
}

_COLOUR = r"(groen|geel|oranje|rood)"
_COLOUR_RE = re.compile(rf"\b{_COLOUR}\b", re.I)

# Hedges like "voor het grootste deel" ("for the most part") and "grotendeels"
# sit between the subject and the colour and must not be mistaken for one.
_HEDGE = r"(?:voor het grootste deel\s+|grotendeels\s+|deels\s+|nog steeds\s+)?"

# The feed contains typos — "Vor de rest van Marokko", "De kleurcode voor het
# reisadvies voor Zuid-Afrika" — and each one silently costs a country its
# level. "vor" is not a Dutch word, so accepting it cannot introduce a
# false match.
_VOOR = r"vo{1,2}r"

# Subject precedes the colour: "voor <X> is <kleur>" / "voor <X> geldt
# kleurcode <kleur>". The leading `.*` is greedy on purpose so that `voor`
# binds to the LAST one before the colour — "De kleurcode voor het reisadvies
# voor Zuid-Afrika is geel" must yield "Zuid-Afrika", not "het reisadvies
# voor Zuid-Afrika".
_SUBJECT_BEFORE: tuple[re.Pattern[str], ...] = (
    re.compile(rf"^.*\b{_VOOR}\s+(?P<subject>.{{1,90}}?)\s+is\s+{_HEDGE}{_COLOUR}\b", re.I),
    re.compile(
        rf"^.*\b{_VOOR}\s+(?P<subject>.{{1,90}}?)\s+geldt\s+{_HEDGE}kleurcode\s+{_COLOUR}\b",
        re.I,
    ),
)

# Subject follows the colour: "kleurcode <kleur> geldt voor <X>" /
# "kleurcode … is <kleur> voor <X>". The subject runs to the end of the
# sentence and is deliberately unbounded — India lists four separate areas in
# one clause, and a length cap made that sentence fall through to the
# no-location pattern below, which reported the whole country as "rood".
_SUBJECT_AFTER: tuple[re.Pattern[str], ...] = (
    re.compile(rf"\bkleurcode\s+{_COLOUR}\s+geldt\s+(?:ook\s+)?{_VOOR}\s+(?P<subject>.+)", re.I),
    re.compile(
        rf"\bkleurcode\b.{{0,60}}?\bis\s+{_HEDGE}{_COLOUR}\s+{_VOOR}\s+(?P<subject>.+)", re.I
    ),
)

# No location named at all: "De kleurcode is rood." Guarded — see
# `_subject_and_colour`, which refuses this reading when the sentence goes on
# to say "voor <somewhere>".
_SUBJECT_NONE = re.compile(rf"\bkleurcode\b.{{0,60}}?\bis\s+{_HEDGE}{_COLOUR}\b", re.I)

# Phrases that mean "the country as a whole" without naming it.
_WHOLE_COUNTRY_PHRASES: frozenset[str] = frozenset(
    {"het hele land", "hele land", "het land", "heel het land"}
)

# Names the feed's prose uses while `location` carries a different one —
# abbreviations ("de VAE"), and endonyms ("Naoero" for Nauru). Five in the
# 2026-08 vintage; add as found. A miss costs this source's opinion on one
# country, which the other five governments cover; it cannot produce a wrong
# level, because an unrecognised subject is read as regional.
_COUNTRY_ALIASES: dict[str, tuple[str, ...]] = {
    "verenigd koninkrijk": ("vk", "groot-brittannie"),
    "verenigde staten van amerika": ("vs", "verenigde staten", "amerika"),
    "verenigde arabische emiraten": ("vae",),
    "congo democratische republiek": ("drc", "dr congo"),
    "congo de republiek": ("republiek congo",),
    "nauru": ("naoero",),
}

_SENTENCE_SPLIT = re.compile(r"(?<=[.;])\s+")
_LIST_ITEM = re.compile(r"<li\b[^>]*>(.*?)</li>", re.S | re.I)
_TAG = re.compile(r"<[^>]+>")
_LEADING_ARTICLE = re.compile(r"^(?:de|het|een)\s+")
_REST_OF = re.compile(r"^(?:de\s+)?rest\s+van\s+(?:de\s+|het\s+)?")


def _strip_html(text: str) -> str:
    return " ".join(_TAG.sub(" ", text or "").split())


def _fold(text: str) -> str:
    """Casefold, drop diacritics and punctuation, collapse whitespace.

    Dutch country names carry diacritics the feed is not consistent about
    ("Roemenië" / "Roemenie"), and the prose wraps names in punctuation.
    """
    decomposed = unicodedata.normalize("NFKD", text or "")
    ascii_only = "".join(c for c in decomposed if not unicodedata.combining(c))
    cleaned = re.sub(r"[^\w\s-]", " ", ascii_only.casefold())
    return " ".join(cleaned.split())


def _country_names(location: str) -> set[str]:
    """Every spelling of the country name this record might use.

    ``location`` sometimes carries a parenthetical gloss — "Belarus
    (Wit-Rusland)" — and both halves occur in the prose.
    """
    names: set[str] = set()
    raw = (location or "").strip()
    if not raw:
        return names
    names.add(_fold(raw))
    without_parens = re.sub(r"\([^)]*\)", " ", raw)
    names.add(_fold(without_parens))
    for inner in re.findall(r"\(([^)]*)\)", raw):
        names.add(_fold(inner))
    for alias in _COUNTRY_ALIASES.get(_fold(without_parens), ()):
        names.add(_fold(alias))
    return {n for n in names if n}


def statements(introduction: str) -> list[str]:
    """The sentences of an ``introduction``, list items kept separate.

    Bullets are split first so that a carve-out and the country-wide code
    can never be read as one sentence, then each is split into sentences
    because a single bullet often carries two claims.
    """
    if not introduction:
        return []
    items = _LIST_ITEM.findall(introduction)
    chunks = items if items else [introduction]
    out: list[str] = []
    for chunk in chunks:
        text = _strip_html(chunk)
        out.extend(part.strip() for part in _SENTENCE_SPLIT.split(text) if part.strip())
    return out


def _subject_and_colour(sentence: str) -> tuple[str | None, str] | None:
    """``(subject, colour)`` for one sentence, or ``None`` if it states no code.

    A ``None`` subject means the sentence names no location, which in this
    feed means the country itself.
    """
    if "kleurcode" not in sentence.lower() or not _COLOUR_RE.search(sentence):
        return None

    for pattern in (*_SUBJECT_BEFORE, *_SUBJECT_AFTER):
        match = pattern.search(sentence)
        if match is None:
            continue
        return match.group("subject").strip(" .;,"), _matched_colour(match)

    match = _SUBJECT_NONE.search(sentence)
    if match is None:
        return None
    # Refuse the no-location reading when the sentence goes on to name one.
    # This is the guard the original parser lacked: a sentence whose region
    # clause we failed to parse must yield nothing, never the whole country.
    if re.search(rf"\b{_VOOR}\b", sentence[match.end() :], re.I):
        return None
    return None, _matched_colour(match)


def _matched_colour(match: re.Match[str]) -> str:
    """The colour group of a match, found by value rather than by index.

    Each pattern puts the colour in a different position, and naming it would
    collide with the named subject group in the alternation above.
    """
    for group in match.groups():
        if group and group.lower() in _COLOUR_LEVEL:
            return group.lower()
    raise AssertionError(f"no colour group in match: {match.group(0)!r}")


def _is_whole_country(subject: str | None, names: set[str]) -> bool:
    """Does ``subject`` name the country rather than a part of it?"""
    if subject is None:
        return True
    folded = _fold(subject)
    if not folded:
        return True
    if folded in _WHOLE_COUNTRY_PHRASES:
        return True
    # "de rest van Japan" is the country-wide code; "de rest van het
    # noordwesten van de provincie Bujumbura" is emphatically not.
    #
    # Prefix rather than equality, because the phrase often carries an
    # apposition: "de rest van Pakistan, onder andere de hoofdstad Islamabad".
    # "de rest van X" has already committed to meaning the remainder of X, so
    # matching loosely here cannot turn a region into a country.
    remainder = _REST_OF.sub("", folded)
    if remainder != folded and any(
        remainder == name or remainder.startswith(f"{name} ") or
        remainder.startswith(f"{name},")
        for name in names
    ):
        return True
    return _LEADING_ARTICLE.sub("", folded) in {
        _LEADING_ARTICLE.sub("", n) for n in names
    }


def classify_introduction(intro: str, location: str = "") -> int | None:
    """Country-wide level for one record, or ``None`` if it states none.

    ``location`` is the record's country name; without it only sentences that
    name no location at all can be recognised as country-wide.
    """
    country, _ = classify_introduction_detailed(intro, location)
    return country


def classify_introduction_detailed(
    intro: str, location: str = ""
) -> tuple[int | None, list[int]]:
    """``(country_level, regional_levels)`` for one record.

    ``regional_levels`` are the distinct levels of carve-outs that are worse
    than the country-wide code — the ones a traveller needs warning about.
    """
    names = _country_names(location)
    country_level: int | None = None
    regional: list[int] = []
    for sentence in statements(intro):
        parsed = _subject_and_colour(sentence)
        if parsed is None:
            continue
        subject, colour = parsed
        level = _COLOUR_LEVEL[colour]
        if _is_whole_country(subject, names):
            # Several sentences can restate the national code; keep the worst.
            country_level = level if country_level is None else max(country_level, level)
        else:
            regional.append(level)
    worse = sorted({lv for lv in regional if country_level is None or lv > country_level})
    return country_level, worse


class NetherlandsScraper(AdvisoryScraper):
    source_id = "netherlands"
    source_url = INDEX_URL

    def fetch_raw(self) -> str:
        """Paginate the API and return the concatenated records as JSON."""
        all_records: list[dict] = []
        offset = 0
        while True:
            resp = self.client.get(API_URL, params={"output": "json", "offset": offset})
            resp.raise_for_status()
            batch = json.loads(resp.text)
            if not isinstance(batch, list) or not batch:
                break
            all_records.extend(batch)
            if len(batch) < PAGE_SIZE:
                break
            offset += PAGE_SIZE
        return json.dumps(all_records)

    def parse(self, raw: str | bytes, *, fetched_at: datetime | None = None) -> list[Advisory]:
        when = fetched_at or utcnow()
        payload = json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
        if not isinstance(payload, list):
            raise ValueError("netherlands: expected a JSON array")
        iso_map = load_mapping("netherlands_iso3")
        out: list[Advisory] = []
        seen: set[str] = set()
        unresolved: list[str] = []
        for entry in payload:
            if not isinstance(entry, dict):
                continue
            iso3 = (entry.get("isocode") or "").strip().upper()
            if not iso3:
                continue
            iso2 = iso_map.get(iso3)
            if not iso2:
                log.debug("netherlands: unmapped ISO-3 %r", iso3)
                continue
            if iso2 in seen:
                continue
            introduction = entry.get("introduction") or ""
            name = entry.get("location") or iso3
            level, regional = classify_introduction_detailed(introduction, name)
            url = entry.get("canonical") or INDEX_URL

            if level is None:
                if regional or _COLOUR_RE.search(_strip_html(introduction)):
                    # Colours are present but none of them is the country's.
                    unresolved.append(f"{iso2} ({name})")
                continue

            seen.add(iso2)
            colour = next(c for c, lv in _COLOUR_LEVEL.items() if lv == level)
            out.append(
                Advisory(
                    country_iso2=iso2,
                    region_code=None,
                    level=level,
                    summary=f"{name}: kleurcode {colour}"[:500],
                    source_url=url,
                    fetched_at=when,
                )
            )
            for region_level in regional:
                # The feed names areas in prose ("het zuidoosten van
                # Fukushima"), which resolves to no ISO-3166-2 polygon, so
                # this is the same sentinel the other scrapers emit.
                region_colour = next(c for c, lv in _COLOUR_LEVEL.items() if lv == region_level)
                out.append(
                    Advisory(
                        country_iso2=iso2,
                        region_code=f"regional-L{region_level}",
                        level=region_level,
                        summary=f"{name}: kleurcode {region_colour} voor een deel van het land"[
                            :500
                        ],
                        source_url=url,
                        fetched_at=when,
                    )
                )

        if unresolved:
            # Not an error — Iraq and the Palestinian Territories genuinely
            # publish no national colour — but a growing list means a phrasing
            # or a country name this parser no longer recognises.
            log.info(
                "netherlands: %d record(s) state a colour but no country-wide code, "
                "so no national level is reported for them: %s",
                len(unresolved),
                ", ".join(sorted(unresolved)),
            )
        return out


def fetch() -> list[Advisory]:
    with NetherlandsScraper() as scraper:
        return scraper.run()
