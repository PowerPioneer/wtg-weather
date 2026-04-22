"""US State Department travel advisories.

Source: https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html

The index page lists every country as a table row with one of four labels:

* ``Level 1: Exercise Normal Precautions``  →  1
* ``Level 2: Exercise Increased Caution``   →  2
* ``Level 3: Reconsider Travel``            →  3
* ``Level 4: Do Not Travel``                →  4

Sub-national detail lives on each country's detail page (e.g. regional
carve-outs such as "Level 4 for northeast Syria"). Detail-page parsing is
a follow-up; at bootstrap we emit country-level records only but already
carry ``region_code`` in the schema for when the detail pass lands.
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

INDEX_URL = (
    "https://travel.state.gov/content/travel/en/"
    "traveladvisories/traveladvisories.html"
)

_LEVEL_RE = re.compile(r"Level\s+([1-4])\b", re.IGNORECASE)


class USStateScraper(AdvisoryScraper):
    source_id = "us_state"
    source_url = INDEX_URL

    def fetch_raw(self) -> str:
        resp = self.client.get(INDEX_URL)
        resp.raise_for_status()
        return resp.text

    def parse(self, raw: str | bytes, *, fetched_at: datetime | None = None) -> list[Advisory]:
        when = fetched_at or utcnow()
        soup = BeautifulSoup(raw, "lxml")
        country_to_iso2 = load_mapping("us_state_countries")
        out: list[Advisory] = []
        seen: set[str] = set()
        # The advisory index renders each country as a row; we key on any
        # element bearing a data-level attribute or matching the textual
        # "Level N" pattern alongside a country name.
        rows = soup.select("[data-country]") or soup.select("tr")
        for row in rows:
            text = " ".join(row.stripped_strings)
            match = _LEVEL_RE.search(text)
            if not match:
                continue
            level = int(match.group(1))
            country_name = (row.get("data-country") or "").strip()
            if not country_name:
                cell = row.find(["td", "th", "a"])
                country_name = cell.get_text(strip=True) if cell else ""
            if not country_name:
                continue
            iso2 = country_to_iso2.get(country_name)
            if not iso2:
                log.debug("us_state: unmapped country %r", country_name)
                continue
            if iso2 in seen:
                continue
            seen.add(iso2)
            out.append(
                Advisory(
                    country_iso2=iso2,
                    region_code=None,
                    level=level,
                    summary=text[:500],
                    source_url=INDEX_URL,
                    fetched_at=when,
                )
            )
        return out


def fetch() -> list[Advisory]:
    with USStateScraper() as scraper:
        return scraper.run()
