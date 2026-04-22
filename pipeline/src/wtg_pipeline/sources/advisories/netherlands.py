"""Dutch Ministry of Foreign Affairs (BZ) travel advisories.

Source: https://opendata.nederlandwereldwijd.nl/v2/sources/nederlandwereldwijd/infotypes/traveladvice

The open-data REST API exposes one record per destination. Each record's
``introduction`` field contains a sentence of the form::

    De kleurcode van het reisadvies voor X is <colour>.

The colour (``groen``/``geel``/``oranje``/``rood``) maps 1:1 onto our
canonical 1..4 ladder:

========  ==============================================  ======
Colour    Meaning                                          Level
========  ==============================================  ======
groen     No particular safety risks                        1
geel      Pay attention — safety risks exist                2
oranje    Only essential travel                             3
rood      Do not travel                                     4
========  ==============================================  ======

The API is paginated at 25 records/page; use ``offset`` to advance. The
list endpoint returns ISO-3 codes in ``isocode``; we translate those to
our canonical ISO-2 via a bundled mapping table.
"""

from __future__ import annotations

import json
import logging
import re
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

_COLOUR_RE = re.compile(
    r"kleurcode[^<>.]*?\b(groen|geel|oranje|rood)\b",
    re.IGNORECASE,
)


def classify_introduction(intro: str) -> int | None:
    """Return the 1..4 level for the Dutch ``introduction`` blob, or None."""
    if not intro:
        return None
    m = _COLOUR_RE.search(intro)
    if not m:
        return None
    return _COLOUR_LEVEL.get(m.group(1).lower())


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
            level = classify_introduction(entry.get("introduction") or "")
            if level is None:
                continue
            seen.add(iso2)
            name = entry.get("location") or iso3
            colour = _COLOUR_RE.search(entry.get("introduction") or "")
            colour_name = colour.group(1).lower() if colour else ""
            summary = f"{name}: kleurcode {colour_name}".strip()
            url = entry.get("canonical") or INDEX_URL
            out.append(
                Advisory(
                    country_iso2=iso2,
                    region_code=None,
                    level=level,
                    summary=summary[:500],
                    source_url=url,
                    fetched_at=when,
                )
            )
        return out


def fetch() -> list[Advisory]:
    with NetherlandsScraper() as scraper:
        return scraper.run()
