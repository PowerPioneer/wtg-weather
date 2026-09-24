"""Resolve the area a travel advisory carve-out names to an ISO-3166-2 code.

Governments describe carve-outs in prose — "Arauca, Cauca (excluding Popayán),
and Norte de Santander departments" — while the advisory schema wants a code,
because a code names a polygon and prose does not. This module is the lookup
between them, backed by the gazetteer in ``subdivisions.json`` (generated from
the same Natural Earth admin-1 layer the tiles are built from; see
``scripts/generate_subdivisions.py``).

A resolved carve-out is a strong claim: it paints a real subdivision at a
level the country as a whole does not carry. Everything here is therefore
biased toward resolving *nothing*:

* names are matched only within the country the advisory is about,
* only on whole-word boundaries in folded text,
* names shorter than four characters are not in the gazetteer at all,
* a name ambiguous within its country was dropped when the gazetteer was
  built, not guessed at here,
* where two matches overlap in the prose, the **longer** wins — "Norte de
  Santander" is CO-NSA, and without this the substring "Santander" would also
  stamp CO-SAN, a different department that was never mentioned,
* and a name that sits inside a **country name** in the prose is not a
  subdivision at all. Plenty of subdivisions share a name with a country or
  its capital, and advisories name countries constantly: "Guatemala City"
  painted GT-GU (the whole department) "do not travel" in production until
  2026-09-24, and in Dutch "grenzen aan Mali" would stamp Guinea's Mali
  prefecture, "Guinee-Bissau" the capital sector GW-BS, "tussen Panama en
  Colombia" the province PA-8. The country names are every key of every
  scraper's ``*_countries.json`` mapping, so each language a feed is read in
  is covered. A subdivision named exactly like a country ("Panama" province)
  therefore never resolves; that is the trade, and it is the right way round.

What does not resolve is not lost: the caller falls back to the
``regional-L<n>`` sentinel, which says "somewhere in this country" without
naming a polygon.
"""

from __future__ import annotations

import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

GAZETTEER_PATH = Path(__file__).resolve().parent / "subdivisions.json"
COUNTRY_NAME_MAPPINGS = (
    Path(__file__).resolve().parents[1] / "sources" / "advisories" / "mappings"
)


def fold(text: str) -> str:
    """Lowercase, drop diacritics, punctuation to spaces, collapse runs.

    Word boundaries survive — unlike the country-name folds elsewhere in the
    codebase — because these names are matched *inside* prose.
    """
    decomposed = unicodedata.normalize("NFKD", text or "")
    ascii_only = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^a-z0-9]+", " ", ascii_only.casefold()).split())


@lru_cache(maxsize=1)
def gazetteer() -> dict[str, dict[str, str]]:
    """``{ISO-2: {folded subdivision name: ISO-3166-2}}``."""
    if not GAZETTEER_PATH.exists():
        return {}
    loaded = json.loads(GAZETTEER_PATH.read_text(encoding="utf-8"))
    return loaded if isinstance(loaded, dict) else {}


@lru_cache(maxsize=1)
def _country_name_pattern() -> re.Pattern[str] | None:
    """One alternation over every folded country name, longest first.

    Longest first because Python's alternation is leftmost-first: "guinea
    bissau" must claim its span before "guinea" can.
    """
    names: set[str] = set()
    for path in sorted(COUNTRY_NAME_MAPPINGS.glob("*_countries.json")):
        loaded = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(loaded, dict):
            names.update(fold(key) for key in loaded)
    names.discard("")
    if not names:
        return None
    ordered = sorted(names, key=len, reverse=True)
    return re.compile(
        r"(?<![a-z0-9])(?:" + "|".join(re.escape(n) for n in ordered) + r")(?![a-z0-9])"
    )


def _country_spans(haystack: str) -> list[tuple[int, int]]:
    pattern = _country_name_pattern()
    if pattern is None:
        return []
    return [(m.start(), m.end()) for m in pattern.finditer(haystack)]


def resolve(country_iso2: str, prose: str) -> list[str]:
    """ISO-3166-2 codes named in ``prose``, sorted and deduplicated.

    Returns an empty list when the prose names no subdivision of this country
    — which is the answer for "Do not travel to Afghanistan", where the only
    thing named is the country itself.
    """
    country = (country_iso2 or "").strip().upper()
    names = gazetteer().get(country)
    if not names:
        return []
    haystack = fold(prose)
    if not haystack:
        return []

    # (start, end, code) for every name that appears, so overlaps can be
    # resolved by length rather than by dictionary order.
    spans: list[tuple[int, int, str]] = []
    for name, code in names.items():
        for match in re.finditer(rf"(?<![a-z0-9]){re.escape(name)}(?![a-z0-9])", haystack):
            spans.append((match.start(), match.end(), code))

    countries = _country_spans(haystack)
    spans = [
        (start, end, code)
        for start, end, code in spans
        if not any(c_start <= start and end <= c_end for c_start, c_end in countries)
    ]

    spans.sort(key=lambda s: (s[0] - s[1], s[0]))  # longest first, then leftmost
    claimed: list[tuple[int, int]] = []
    found: set[str] = set()
    for start, end, code in spans:
        if any(start < c_end and c_start < end for c_start, c_end in claimed):
            # Covered by a longer name already matched here.
            continue
        claimed.append((start, end))
        found.add(code)
    return sorted(found)
