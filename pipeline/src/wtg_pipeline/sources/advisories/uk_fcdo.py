"""UK Foreign, Commonwealth & Development Office (FCDO) travel advice.

Source: https://www.gov.uk/foreign-travel-advice

The FCDO index at gov.uk is purely a link list — per-country advisory text
lives on each country's detail page, in a prominent ``<h2>`` of the form::

    FCDO advises against all travel to <country>
    FCDO advises against all but essential travel to <country>
    FCDO advises against all travel to parts of <country>
    FCDO advises against all but essential travel to parts of <country>

When no such heading exists the country is at level 1.

This scraper therefore makes one HTTP request per mapped country (~60
requests on the bootstrap mapping; ~230 once the mapping table is
expanded). A short delay between calls keeps us polite.
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

INDEX_URL = "https://www.gov.uk/foreign-travel-advice"
REQUEST_DELAY_S = 0.1
PROGRESS_EVERY_S = 30.0


_ALL_TRAVEL = re.compile(
    r"FCDO\s+advises?\s+against\s+all\s+travel\s+to\s+(?P<scope>parts?\s+of\s+)?",
    re.IGNORECASE,
)
_ALL_BUT_ESSENTIAL = re.compile(
    r"FCDO\s+advises?\s+against\s+all\s+but\s+essential\s+travel\s+to\s+(?P<scope>parts?\s+of\s+)?",
    re.IGNORECASE,
)


def classify_detail_text(text: str) -> int:
    """Classify the visible text of a country detail page onto 1..4."""
    # Order matters: the "all but essential" pattern is a sub-phrase of the
    # "all travel" pattern, so check it first.
    m_ab = _ALL_BUT_ESSENTIAL.search(text)
    m_all = _ALL_TRAVEL.search(text) if not m_ab else None
    if m_all and not m_all.group("scope"):
        return 4
    if m_ab and not m_ab.group("scope"):
        return 3
    if m_all and m_all.group("scope"):
        # "all travel" advisory applies only to parts of the country.
        return 3
    if m_ab and m_ab.group("scope"):
        return 2
    return 1


def _absolute(url: str) -> str:
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return f"https://www.gov.uk{url}"


class UKFCDOScraper(AdvisoryScraper):
    source_id = "uk_fcdo"
    source_url = INDEX_URL

    def __init__(
        self,
        client: object | None = None,
        *,
        request_delay_s: float = REQUEST_DELAY_S,
        max_countries: int | None = None,
    ) -> None:
        super().__init__(client)  # type: ignore[arg-type]
        self._request_delay_s = request_delay_s
        self._max_countries = max_countries

    def fetch_raw(self) -> str:
        resp = self.client.get(INDEX_URL)
        resp.raise_for_status()
        return resp.text

    def _index_entries(self, index_html: str) -> list[tuple[str, str]]:
        """Return (country-name, absolute-url) pairs from the index page."""
        soup = BeautifulSoup(index_html, "lxml")
        country_map = load_mapping("uk_fcdo_countries")
        seen: set[str] = set()
        entries: list[tuple[str, str]] = []
        for a in soup.select('a[href*="/foreign-travel-advice/"]'):
            name = a.get_text(strip=True)
            href = a.get("href", "")
            if not name or not href:
                continue
            if name not in country_map:
                continue
            if name in seen:
                continue
            seen.add(name)
            entries.append((name, _absolute(href)))
        return entries

    def parse(self, raw: str | bytes, *, fetched_at: datetime | None = None) -> list[Advisory]:
        when = fetched_at or utcnow()
        index_html = raw.decode("utf-8") if isinstance(raw, bytes) else raw
        country_map = load_mapping("uk_fcdo_countries")
        entries = self._index_entries(index_html)
        if self._max_countries is not None:
            entries = entries[: self._max_countries]

        out: list[Advisory] = []
        total = len(entries)
        next_progress = time.monotonic() + PROGRESS_EVERY_S
        for idx, (name, url) in enumerate(entries, start=1):
            iso2 = country_map[name]
            try:
                detail_html = self._fetch_detail(url)
            except Exception as exc:  # noqa: BLE001
                log.warning("uk_fcdo: detail fetch failed for %s (%s): %s", name, url, exc)
                continue
            level, summary = classify_from_detail(detail_html, country=name)
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
            # Sub-national carveouts: emit one aggregate regional row per
            # distinct carveout level strictly greater than the country
            # level (same-or-lower carveouts are already covered by the
            # country row).
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
                        source_url=url,
                        fetched_at=when,
                    )
                )
            now = time.monotonic()
            if now >= next_progress:
                log.info("uk_fcdo: %d/%d countries processed", idx, total)
                next_progress = now + PROGRESS_EVERY_S
            if self._request_delay_s > 0 and idx < total:
                time.sleep(self._request_delay_s)
        return out

    def _fetch_detail(self, url: str) -> str:
        resp = self.client.get(url)
        resp.raise_for_status()
        return resp.text


_BOILERPLATE_HEADING = re.compile(
    r"cookies?\s+on\s+gov\.uk|navigation\s+menu|feedback|is\s+this\s+page\s+useful"
    r"|accept\s+additional\s+cookies|reject\s+additional\s+cookies|view\s+cookies",
    re.IGNORECASE,
)

_AREAS_HEADING = re.compile(
    r"areas?\s+where\s+FCDO\s+advises?\s+against\s+(?:all\s+)?travel",
    re.IGNORECASE,
)


def classify_from_detail(detail_html: str, *, country: str) -> tuple[int, str]:
    """Extract level + a short summary from a country's detail-page HTML."""
    soup = BeautifulSoup(detail_html, "lxml")
    # The primary signal is a main-column <h2>. Fall back to visible body
    # text if the page shape changes.
    headings = [h.get_text(" ", strip=True) for h in soup.select("h1, h2")]
    meaningful = [h for h in headings if h and not _BOILERPLATE_HEADING.search(h)]
    source_text = " \n".join(meaningful) or soup.get_text(" ", strip=True)
    level = classify_detail_text(source_text)
    fcdo_line = next(
        (h for h in meaningful if re.search(r"fcdo\s+advises?\s+against", h, re.IGNORECASE)),
        None,
    )
    if fcdo_line:
        return level, fcdo_line
    # No FCDO banner → use the first meaningful heading, but prefer one that
    # is clearly descriptive (contains the country name) over generic ones.
    preferred = next(
        (h for h in meaningful if country.lower() in h.lower()),
        meaningful[0] if meaningful else country,
    )
    return level, preferred


def extract_regional_carveouts(detail_html: str) -> list[tuple[int, str]]:
    """Return a list of (level, prose) pairs for sub-national carveouts.

    FCDO detail pages group regional guidance under an *"Areas where FCDO
    advises against travel"* heading. The paragraphs below it each carry
    their own phrasing — *"FCDO advises against all travel to ..."* for
    L4 pockets or *"... all but essential travel to ..."* for L3 pockets.
    Sub-regions are separated by ``<h3>`` region labels; each paragraph
    under the section becomes one (level, prose) pair, optionally prefixed
    by the preceding region label.
    """
    soup = BeautifulSoup(detail_html, "lxml")
    out: list[tuple[int, str]] = []
    for h in soup.select("h2"):
        heading = h.get_text(" ", strip=True)
        if not _AREAS_HEADING.search(heading):
            continue
        current_region = ""
        for sibling in h.next_siblings:
            name = getattr(sibling, "name", None)
            if name in {"h1", "h2"}:
                break
            if name == "h3":
                current_region = sibling.get_text(" ", strip=True)
                continue
            if name != "p":
                continue
            prose = sibling.get_text(" ", strip=True)
            if not prose:
                continue
            level = classify_detail_text(prose)
            if level <= 1:
                continue
            labelled = f"{current_region}: {prose}" if current_region else prose
            out.append((level, labelled))
    return out


def fetch() -> list[Advisory]:
    with UKFCDOScraper() as scraper:
        return scraper.run()
