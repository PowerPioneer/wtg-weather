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

The ``Summary`` marks them structurally, and the trailing colon is what makes
them safe to read::

    <p><b>Do Not Travel to:</b></p>          <- a list of areas follows
    <ul><li>Arauca, Cauca (excluding Popayán), and Norte de Santander
        departments due to crime and terrorism.</li>
        <li>The Colombia-Venezuela border region …</li></ul>

versus the country-wide sentence, which has no colon and names the country::

    <p>Do not travel to Afghanistan due to civil unrest, crime, terrorism …</p>

So the list items under a ``… to:`` heading are the only text searched for
area names, and they are resolved against the subdivision gazetteer (see
:mod:`wtg_pipeline.processing.subdivisions`). That makes the resolution itself
the disambiguator: prose naming only the country matches no subdivision and
yields nothing, and the phrase "do not travel to" appearing in 121 of 219
summaries stops being a problem to reason about.

Where a heading exists but nothing resolves — "The Colombia-Venezuela border
region" is not a subdivision of either country — the level still travels, as
the ``regional-L<n>`` sentinel the other scrapers use. The information that
*somewhere* is worse is kept; only the claim about *which polygon* is dropped.
"""

from __future__ import annotations

import json
import logging
import re
import time
import unicodedata
from datetime import datetime

from wtg_pipeline.processing import subdivisions
from wtg_pipeline.processing.advisories import LEVEL_LABELS
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

# It also answers `200 []` intermittently — observed three times in an hour,
# with retries seconds later returning 214 and 222 records. A 200 with an
# empty body is indistinguishable from "no country has an advisory", so it is
# treated as a failed attempt rather than an answer.
MAX_ATTEMPTS = 3
RETRY_DELAY_S = 5.0


# "Do Not Travel to:" / "Reconsider Travel to:" / "Exercise Increased Caution
# in:" — the trailing colon is load-bearing. Without it the same words are the
# country-wide sentence ("Do not travel to Afghanistan due to …").
_CARVE_OUT_HEADING = re.compile(
    r"(do not travel|reconsider travel|exercise increased caution)\s*(?:to|in)?\s*:",
    re.I,
)
_LIST_ITEM = re.compile(r"<li\b[^>]*>(.*?)</li>", re.S | re.I)
_HEADING_LEVEL = {
    "do not travel": 4,
    "reconsider travel": 3,
    "exercise increased caution": 2,
}
# How far past a heading to look for its list, and how many items to take.
# Both bounds exist so a summary whose heading is not followed by a list
# cannot hoover up areas named further down under a different heading.
_HEADING_WINDOW_CHARS = 2500
_MAX_ITEMS = 12


def extract_carve_outs(summary: str, country_iso2: str) -> dict[str, int]:
    """``{ISO-3166-2 or "": level}`` for the carve-outs a summary declares.

    The ``""`` key carries a level whose area named no resolvable subdivision
    — the caller turns that into the ``regional-L<n>`` sentinel.
    """
    out: dict[str, int] = {}
    for heading in _CARVE_OUT_HEADING.finditer(summary or ""):
        level = _HEADING_LEVEL[heading.group(1).lower()]
        window = summary[heading.end() : heading.end() + _HEADING_WINDOW_CHARS]
        for item in _LIST_ITEM.findall(window)[:_MAX_ITEMS]:
            prose = clean_summary(item)
            codes = subdivisions.resolve(country_iso2, prose)
            for code in codes:
                out[code] = max(out.get(code, 0), level)
            if not codes:
                out[""] = max(out.get("", 0), level)
    return out


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
        last_seen = "nothing"
        for attempt in range(1, MAX_ATTEMPTS + 1):
            resp = self.client.get(API_URL, timeout=READ_TIMEOUT_S)
            resp.raise_for_status()
            text = resp.text
            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                last_seen = "a body that is not JSON"
            else:
                if isinstance(payload, list) and payload:
                    return text
                last_seen = (
                    "an empty array" if isinstance(payload, list) else f"a bare {type(payload).__name__}"
                )
            log.warning(
                "us_state: attempt %d/%d returned %s; retrying",
                attempt,
                MAX_ATTEMPTS,
                last_seen,
            )
            if attempt < MAX_ATTEMPTS:
                time.sleep(RETRY_DELAY_S)
        raise RuntimeError(
            f"{API_URL} returned {last_seen} on {MAX_ATTEMPTS} consecutive attempts"
        )

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
        resolved = 0

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

            raw_summary = entry.get("Summary") or ""
            summary = clean_summary(raw_summary) or entry.get("Title") or name
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

            for code, carve_level in sorted(extract_carve_outs(raw_summary, iso2).items()):
                if carve_level <= level:
                    # A carve-out no worse than the country tells no one
                    # anything they did not already have.
                    continue
                resolved += 1 if code else 0
                out.append(
                    Advisory(
                        country_iso2=iso2,
                        region_code=code or f"regional-L{carve_level}",
                        level=carve_level,
                        summary=(
                            f"{name}: {LEVEL_LABELS[carve_level]} for {code}"
                            if code
                            else f"{name}: {LEVEL_LABELS[carve_level]} for part of the country"
                        )[:500],
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
        log.info(
            "us_state: %d country advisories, %d resolved subdivision carve-out(s)",
            len(seen),
            resolved,
        )
        return out


def fetch() -> list[Advisory]:
    with USStateScraper() as scraper:
        return scraper.run()
