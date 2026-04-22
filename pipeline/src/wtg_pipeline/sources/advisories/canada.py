"""Global Affairs Canada travel advisories.

Source: https://travel.gc.ca/travelling/advisories

Canada renders the country list as server-side HTML. Each ``<tr>`` carries
an ``<img>`` whose ``src`` encodes the risk level in the filename:

=====================  ======
Image filename          Level
=====================  ======
normal-precautions      1
increased-caution       2
reconsider-travel       3
do-not-travel           4
=====================  ======

The level text in the adjacent cell is also parsed as a fallback. Country
identity comes from the anchor text, resolved via the ``canada_countries``
mapping table (name → ISO-2).
"""

from __future__ import annotations

import logging
import re
from datetime import datetime

from bs4 import BeautifulSoup

from wtg_pipeline.sources.advisories.base import (
    Advisory,
    AdvisoryScraper,
    load_mapping,
    utcnow,
)

log = logging.getLogger(__name__)

INDEX_URL = "https://travel.gc.ca/travelling/advisories"

_IMG_LEVEL: dict[str, int] = {
    "normal-precautions": 1,
    "increased-caution": 2,
    "reconsider-travel": 3,
    "do-not-travel": 4,
}

_TEXT_LEVEL: tuple[tuple[re.Pattern[str], int], ...] = (
    (re.compile(r"avoid all travel", re.IGNORECASE), 4),
    (re.compile(r"avoid non-essential travel", re.IGNORECASE), 3),
    (re.compile(r"high degree of caution", re.IGNORECASE), 2),
    (re.compile(r"normal security precautions", re.IGNORECASE), 1),
)


def _level_from_img(src: str) -> int | None:
    for needle, level in _IMG_LEVEL.items():
        if needle in src:
            return level
    return None


def _level_from_text(text: str) -> int | None:
    for pattern, level in _TEXT_LEVEL:
        if pattern.search(text):
            return level
    return None


class CanadaScraper(AdvisoryScraper):
    source_id = "canada"
    source_url = INDEX_URL

    def fetch_raw(self) -> str:
        resp = self.client.get(INDEX_URL)
        resp.raise_for_status()
        return resp.text

    def parse(self, raw: str | bytes, *, fetched_at: datetime | None = None) -> list[Advisory]:
        when = fetched_at or utcnow()
        soup = BeautifulSoup(raw, "lxml")
        country_map = load_mapping("canada_countries")
        out: list[Advisory] = []
        seen: set[str] = set()
        rows = soup.select("tr")
        for row in rows:
            anchor = row.select_one('a[href*="/destinations/"]')
            if anchor is None:
                continue
            country_name = anchor.get_text(strip=True)
            if not country_name:
                continue
            iso2 = country_map.get(country_name)
            if not iso2:
                log.debug("canada: unmapped country %r", country_name)
                continue
            if iso2 in seen:
                continue
            img = row.select_one('img[src*="risklevels"]')
            level: int | None = None
            if img is not None:
                level = _level_from_img(img.get("src", ""))
            if level is None:
                level = _level_from_text(" ".join(row.stripped_strings))
            if level is None:
                continue
            seen.add(iso2)
            summary = " ".join(row.stripped_strings)
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
    with CanadaScraper() as scraper:
        return scraper.run()
