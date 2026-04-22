"""German Federal Foreign Office (Auswärtiges Amt) travel advisories.

Source: https://www.auswaertiges-amt.de/opendata/travelwarning

The Auswärtiges Amt publishes a public open-data JSON feed containing one
entry per country with boolean flags for the four advisory categories. We
map them onto the canonical 1..4 ladder (country-only at bootstrap, per
REBUILD_PLAN § 5.2):

================  ==============================================  ======
JSON flag         Meaning                                          Level
================  ==============================================  ======
warning           Full travel warning (Reisewarnung)               4
partialWarning    Partial travel warning (Teilreisewarnung)        3
situationWarning  Country-wide security situation warning          2
no flag set       Routine country information                      1
================  ==============================================  ======

``situationPartWarning`` (partial situation warning) is folded into level 2
— it indicates elevated but not country-wide concern.
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
    """Map a feed entry's booleans onto the canonical 1..4 ladder."""
    if entry.get("warning"):
        return 4
    if entry.get("partialWarning"):
        return 3
    if entry.get("situationWarning") or entry.get("situationPartWarning"):
        return 2
    return 1


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
            level = classify_entry(entry)
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
        return out


def fetch() -> list[Advisory]:
    with GermanyScraper() as scraper:
        return scraper.run()
