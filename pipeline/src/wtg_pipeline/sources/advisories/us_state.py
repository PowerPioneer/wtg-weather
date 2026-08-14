"""US State Department travel advisories.

Source: the Bureau of Consular Affairs open-data API,
https://cadataapi.state.gov/api/TravelAdvisories

Each record carries a ``Title`` of the form::

    Mexico - Level 2: Exercise Increased Caution

which gives the country and the level together, on the ladder every scraper
shares:

* ``Level 1: Exercise Normal Precautions``  →  1
* ``Level 2: Exercise Increased Caution``   →  2
* ``Level 3: Reconsider Travel``            →  3
* ``Level 4: Do Not Travel``                →  4

Why not the HTML index
----------------------

This module used to scrape
``travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html``
and follow one detail page per country. That page sits behind Cloudflare and
returns **403 to datacenter IPs**, so on the production build box the scraper
could not run at all — and because the CLI aborted on the first failing
source, a ``--source all`` run scraped *nothing*. The advisory consolidation
silently fell back to whatever dump was last on disk, which by 2026-08 meant a
four-month-old US snapshot feeding a "six-government consensus".

The open-data API is the published machine-readable interface for the same
data, needs no browser impersonation, and returns 219 records against the 75
the HTML index yielded.

``Category`` is NOT an ISO-3166 code
------------------------------------

The API's ``Category`` field looks like a country code and is not one — it is
a GEC/FIPS code. Japan is ``JA``, Ukraine ``UP``, Mongolia ``MG``. Three of
them collide with real ISO-3166-1 alpha-2 codes belonging to **other
countries**:

======================  ==========  =====================================
Advisory                Category    That code in ISO-3166 is…
======================  ==========  =====================================
Russia, Level 4         ``RS``      Serbia
Mainland China, Level 2 ``CH``      Switzerland
Mongolia, Level 1       ``MG``      Madagascar
======================  ==========  =====================================

Reading it as ISO-2 "works" — it yields a code for 212 of 219 records — and
paints Serbia with Russia's Do Not Travel. So the country is resolved from the
**name** in the title through ``mappings/us_state_countries.json``, and a
title that does not resolve is dropped with a log line rather than guessed at.

Regional carve-outs
-------------------

Not extracted. The ``Summary`` field contains the phrase "do not travel to"
in 121 of 219 records, but it is the country-wide sentence ("Do not travel to
Afghanistan") at least as often as a carve-out, and telling the two apart
needs the same subject analysis the Dutch scraper required. Getting it wrong
over-reports risk for a whole country, and the Netherlands and Germany
scrapers already supply carve-outs for most of the world. The country level —
the number that paints the map — comes out of the title unambiguously.
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

API_URL = "https://cadataapi.state.gov/api/TravelAdvisories"
INDEX_URL = (
    "https://travel.state.gov/content/travel/en/"
    "traveladvisories/traveladvisories.html"
)

# "Mexico - Level 2: Exercise Increased Caution" → ("Mexico", "2")
_TITLE_RE = re.compile(r"^(?P<name>.*?)\s+-\s+Level\s+(?P<level>[1-4])\b", re.I)
_TAG_RE = re.compile(r"<[^>]+>")
_ENTITY_RE = re.compile(r"&(?:nbsp|#160);")

# The API is slow to first byte and returns ~940 KB in one response.
READ_TIMEOUT_S = 90.0


def parse_title(title: str) -> tuple[str, int] | None:
    """``(country name, level)`` from a record title, or ``None``."""
    match = _TITLE_RE.match((title or "").strip())
    if match is None:
        return None
    return match.group("name").strip(), int(match.group("level"))


def fold_name(name: str) -> str:
    """Normalise a country name for lookup.

    The feed is not stable about punctuation or diacritics — "Côte d'Ivoire"
    has appeared as ``Cote d Ivoire`` and with a curly apostrophe (U+2019) in
    successive fetches, and each spelling that misses the table costs this
    source its opinion on that country. Folding at lookup time means the table
    holds one entry per country rather than one per encoding.

    Only articles are removed. "Kingdom" and "States" are load-bearing:
    stripping them collapses United Kingdom and United States onto one key.
    """
    decomposed = unicodedata.normalize("NFKD", name or "")
    ascii_only = "".join(c for c in decomposed if not unicodedata.combining(c))
    without_articles = re.sub(r"\b(the|of|and)\b", " ", ascii_only.casefold())
    return re.sub(r"[^a-z0-9]+", "", without_articles)


def clean_summary(summary: str) -> str:
    """The advisory prose with markup and non-breaking spaces removed."""
    text = _ENTITY_RE.sub(" ", summary or "")
    return " ".join(_TAG_RE.sub(" ", text).split())


class USStateScraper(AdvisoryScraper):
    source_id = "us_state"
    source_url = API_URL

    def fetch_raw(self) -> str:
        resp = self.client.get(API_URL, timeout=READ_TIMEOUT_S)
        resp.raise_for_status()
        return resp.text

    def parse(self, raw: str | bytes, *, fetched_at: datetime | None = None) -> list[Advisory]:
        when = fetched_at or utcnow()
        payload = json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
        if not isinstance(payload, list):
            raise ValueError("us_state: expected a JSON array")

        name_to_iso2 = {
            fold_name(key): value for key, value in load_mapping("us_state_countries").items()
        }
        out: list[Advisory] = []
        seen: set[str] = set()
        unmapped: list[str] = []

        for entry in payload:
            if not isinstance(entry, dict):
                continue
            parsed = parse_title(entry.get("Title") or "")
            if parsed is None:
                continue
            name, level = parsed

            # Deliberately not `entry["Category"]` — see the module docstring.
            iso2 = name_to_iso2.get(fold_name(name))
            if not iso2:
                unmapped.append(name)
                continue
            if iso2 in seen:
                continue
            seen.add(iso2)

            summary = clean_summary(entry.get("Summary") or "") or entry.get("Title") or name
            url = entry.get("Link") or entry.get("id") or INDEX_URL
            out.append(
                Advisory(
                    country_iso2=iso2,
                    region_code=None,
                    level=level,
                    summary=summary[:500],
                    source_url=str(url),
                    fetched_at=when,
                )
            )

        if unmapped:
            # Dropping is the conservative failure: this source loses its
            # opinion on that country and the other five still cover it.
            # Guessing a code from `Category` is what would put Russia's
            # advisory on Serbia.
            log.info(
                "us_state: %d title(s) resolved to no ISO-3166 country and were "
                "dropped — add them to mappings/us_state_countries.json if they "
                "are real countries: %s",
                len(unmapped),
                ", ".join(sorted(set(unmapped))),
            )
        log.info("us_state: %d country advisories", len(out))
        return out


def fetch() -> list[Advisory]:
    with USStateScraper() as scraper:
        return scraper.run()
