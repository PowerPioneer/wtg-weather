"""German Federal Foreign Office (Auswärtiges Amt) travel advisories.

Source: https://www.auswaertiges-amt.de/opendata/travelwarning

The Auswärtiges Amt publishes a public open-data JSON feed containing one
entry per country with four boolean flags and no prose beyond a title of the
form "<Land>: Reise- und Sicherheitshinweise". The flags are the entire
signal.

======================  ==================================  =========  ========
JSON flag               Meaning                             Country    Region
======================  ==================================  =========  ========
warning                 Reisewarnung, whole country         4          —
partialWarning          Teilreisewarnung, part of country   1          4
situationWarning        Country-wide security situation     2          —
situationPartWarning    Situation warning for part          1          2
no flag set             Routine country information         1          —
======================  ==================================  =========  ========

The ``partialWarning`` row is the one that matters. A *Teilreisewarnung* is a
Reisewarnung **for part of the country** — Japan's is the Fukushima exclusion
zone, India's is Jammu and Kashmir, Thailand's is the deep south. This module
used to map it to a country-wide level 3, which put Japan, India and Thailand
on "Reconsider travel" and made Germany the sole driver of 16 of the 31
countries the consensus rated 3. It is a regional carve-out, so it is emitted
as one: the country keeps level 1, because that is what the feed says about
the rest of it, and the warning travels as the ``regional-L4`` sentinel the
other scrapers use.

Consequence worth knowing: since ``situationWarning`` is false for all 200
entries in the 2026-08 vintage, Germany now contributes only 1s and 4s
country-wide. Under `max` consensus a 1 never raises anything, so this source
is effectively "Reisewarnung or nothing" plus carve-outs. That is an accurate
account of what the feed publishes — the graded middle simply is not in it,
and inventing one is what went wrong before.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime

from wtg_pipeline.sources.advisories.base import Advisory, AdvisoryScraper, utcnow

log = logging.getLogger(__name__)

FEED_URL = "https://www.auswaertiges-amt.de/opendata/travelwarning"
INDEX_URL = "https://www.auswaertiges-amt.de/en/aussenpolitik/laenderinformationen"


def classify_entry(entry: dict) -> int:
    """Country-wide level for a feed entry, on the canonical 1..4 ladder."""
    return classify_entry_detailed(entry)[0]


def classify_entry_detailed(entry: dict) -> tuple[int, list[int]]:
    """``(country_level, regional_levels)`` for one feed entry.

    ``regional_levels`` holds the carve-outs that are worse than the
    country-wide level — the partial warnings, which describe part of a
    country and must not be reported as the whole of it.
    """
    if entry.get("warning"):
        # A full Reisewarnung covers the country; any partial flag alongside
        # it adds nothing a traveller can act on.
        return 4, []

    country = 2 if entry.get("situationWarning") else 1
    regional: set[int] = set()
    if entry.get("partialWarning"):
        regional.add(4)
    if entry.get("situationPartWarning"):
        regional.add(2)
    return country, sorted(level for level in regional if level > country)


class GermanyScraper(AdvisoryScraper):
    source_id = "germany"
    source_url = INDEX_URL

    def fetch_raw(self) -> str:
        resp = self.client.get(FEED_URL)
        resp.raise_for_status()
        return resp.text

    def parse(self, raw: str | bytes, *, fetched_at: datetime | None = None) -> list[Advisory]:
        when = fetched_at or utcnow()
        payload = json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
        response = payload.get("response", payload)
        out: list[Advisory] = []
        seen: set[str] = set()
        for key, entry in response.items():
            if not key.isdigit() or not isinstance(entry, dict):
                continue
            iso2 = entry.get("countryCode")
            if not isinstance(iso2, str) or len(iso2) != 2:
                continue
            iso2 = iso2.upper()
            if iso2 in seen:
                continue
            seen.add(iso2)
            level, regional = classify_entry_detailed(entry)
            name = entry.get("countryName", iso2)
            title = entry.get("title", "")
            summary = f"{name}: {title}" if title else name
            out.append(
                Advisory(
                    country_iso2=iso2,
                    region_code=None,
                    level=level,
                    summary=summary[:500],
                    source_url=INDEX_URL,
                    fetched_at=when,
                )
            )
            for region_level in regional:
                # The feed names no areas — only that *some* part of the
                # country is covered — so this is the sentinel, never an
                # ISO-3166-2 code.
                kind = "Teilreisewarnung" if region_level == 4 else "Teilsituationswarnung"
                out.append(
                    Advisory(
                        country_iso2=iso2,
                        region_code=f"regional-L{region_level}",
                        level=region_level,
                        summary=f"{name}: {kind}"[:500],
                        source_url=INDEX_URL,
                        fetched_at=when,
                    )
                )
        return out


def fetch() -> list[Advisory]:
    with GermanyScraper() as scraper:
        return scraper.run()
