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
import time
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
_DETAIL_LEVEL_RE = re.compile(
    r"level\s*[:\-]?\s*([1-4])\s*[:\-]?\s*(do\s+not\s+travel|reconsider|exercise)",
    re.IGNORECASE,
)
REQUEST_DELAY_S = 0.1
PROGRESS_EVERY_S = 30.0


def extract_regional_carveouts(detail_html: str) -> list[tuple[int, str]]:
    """Parse a US State detail page for sub-national level sections.

    The travel.state.gov country pages call out regional carveouts with
    headings like *"Level 4: Do Not Travel"* followed by prose listing
    the affected states or provinces. Prose may be wrapped in ``<p>``,
    ``<ul>`` or ``<div>`` (the last is how travel.state.gov currently
    renders the risk-level block).
    """
    soup = BeautifulSoup(detail_html, "lxml")
    out: list[tuple[int, str]] = []
    seen: set[tuple[int, str]] = set()
    # Headings carry the level; the level-classified content block that
    # contains (or immediately follows) the heading carries the prose.
    for h in soup.select("h2, h3, h4, h5"):
        text = h.get_text(" ", strip=True)
        m = _DETAIL_LEVEL_RE.search(text)
        if not m:
            continue
        level = int(m.group(1))
        # travel.state.gov wraps each risk-level block in a div with class
        # ``risk-level`` / ``level-N``; use the enclosing container when we
        # find one, otherwise fall through to next_siblings.
        parent = h.find_parent(class_="risk-level")
        prose = ""
        if parent is not None:
            # Use all text inside the parent block, minus the heading.
            container_text = parent.get_text(" ", strip=True)
            heading_text = h.get_text(" ", strip=True)
            if container_text.startswith(heading_text):
                prose = container_text[len(heading_text):].strip(" :-\u2013")
            else:
                prose = container_text
        if not prose:
            parts: list[str] = []
            for sibling in h.next_siblings:
                name = getattr(sibling, "name", None)
                if name in {"h2", "h3", "h4", "h5", "h1"}:
                    break
                if name in {"p", "ul", "ol", "div"}:
                    t = sibling.get_text(" ", strip=True)
                    if t:
                        parts.append(t)
            prose = " ".join(parts).strip()
        if not prose:
            continue
        key = (level, prose)
        if key in seen:
            continue
        seen.add(key)
        out.append((level, prose))
    return out


def _absolute(url: str) -> str:
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return f"https://travel.state.gov{url}"


class USStateScraper(AdvisoryScraper):
    source_id = "us_state"
    source_url = INDEX_URL

    def __init__(
        self,
        client: object | None = None,
        *,
        request_delay_s: float = REQUEST_DELAY_S,
        max_countries: int | None = None,
        fetch_detail_pages: bool = True,
    ) -> None:
        super().__init__(client)  # type: ignore[arg-type]
        self._request_delay_s = request_delay_s
        self._max_countries = max_countries
        self._fetch_detail_pages = fetch_detail_pages

    def fetch_raw(self) -> str:
        resp = self.client.get(INDEX_URL)
        resp.raise_for_status()
        return resp.text

    def _fetch_detail(self, url: str) -> str:
        resp = self.client.get(url)
        resp.raise_for_status()
        return resp.text

    def parse(self, raw: str | bytes, *, fetched_at: datetime | None = None) -> list[Advisory]:
        when = fetched_at or utcnow()
        soup = BeautifulSoup(raw, "lxml")
        country_to_iso2 = load_mapping("us_state_countries")
        out: list[Advisory] = []
        seen: set[str] = set()
        rows = soup.select("[data-country]") or soup.select("tr")
        entries: list[tuple[str, str, int, str, str | None]] = []
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
            anchor = row.find("a", href=True)
            detail_url = _absolute(anchor["href"]) if anchor else None
            entries.append((country_name, iso2, level, text, detail_url))

        if self._max_countries is not None:
            entries = entries[: self._max_countries]

        total = len(entries)
        next_progress = time.monotonic() + PROGRESS_EVERY_S
        for idx, (name, iso2, level, text, detail_url) in enumerate(entries, start=1):
            out.append(
                Advisory(
                    country_iso2=iso2,
                    region_code=None,
                    level=level,
                    summary=text[:500],
                    source_url=detail_url or INDEX_URL,
                    fetched_at=when,
                )
            )
            if self._fetch_detail_pages and detail_url is not None:
                try:
                    detail_html = self._fetch_detail(detail_url)
                except Exception as exc:  # noqa: BLE001
                    log.warning(
                        "us_state: detail fetch failed for %s (%s): %s", name, detail_url, exc
                    )
                    detail_html = None
                if detail_html is not None:
                    seen_regional: set[int] = set()
                    for region_level, prose in extract_regional_carveouts(detail_html):
                        if region_level <= level or region_level in seen_regional:
                            continue
                        seen_regional.add(region_level)
                        out.append(
                            Advisory(
                                country_iso2=iso2,
                                region_code=f"regional-L{region_level}",
                                level=region_level,
                                summary=prose[:500],
                                source_url=detail_url,
                                fetched_at=when,
                            )
                        )
            now = time.monotonic()
            if now >= next_progress:
                log.info("us_state: %d/%d countries processed", idx, total)
                next_progress = now + PROGRESS_EVERY_S
            if self._request_delay_s > 0 and idx < total and self._fetch_detail_pages:
                time.sleep(self._request_delay_s)
        return out


def fetch() -> list[Advisory]:
    with USStateScraper() as scraper:
        return scraper.run()
