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

INDEX_URL = "https://travel.gc.ca/travelling/advisories"
REQUEST_DELAY_S = 0.1
PROGRESS_EVERY_S = 30.0

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

# Markers appearing inside a "Regional Advisory" heading on the Canadian
# detail pages (e.g. ``Regional Advisory - Avoid non-essential travel``).
_CARVEOUT_MARKERS: tuple[tuple[re.Pattern[str], int], ...] = (
    (re.compile(r"avoid\s+all\s+travel", re.IGNORECASE), 4),
    (re.compile(r"avoid\s+non-essential\s+travel", re.IGNORECASE), 3),
    (re.compile(r"exercise\s+a\s+high\s+degree\s+of\s+caution", re.IGNORECASE), 2),
)

_REGIONAL_HEADING = re.compile(r"regional\s+advisory", re.IGNORECASE)


def extract_regional_carveouts(detail_html: str) -> list[tuple[int, str]]:
    """Parse a Global Affairs Canada country page for sub-national carveouts.

    travel.gc.ca groups regional carveouts under ``<h3>Regional Advisory
    - <level text>``.  The ``<level text>`` tail determines the ladder
    level (avoid all travel → 4, avoid non-essential travel → 3, exercise
    a high degree of caution → 2).
    """
    soup = BeautifulSoup(detail_html, "lxml")
    out: list[tuple[int, str]] = []
    seen_texts: set[str] = set()
    for h in soup.select("h2, h3, h4"):
        text = h.get_text(" ", strip=True)
        if not _REGIONAL_HEADING.search(text):
            # Also accept bare level-phrase headings that also include the
            # word "travel" or "to" — but skip top-level explainer blocks.
            continue
        level: int | None = None
        for pattern, lvl in _CARVEOUT_MARKERS:
            if pattern.search(text):
                level = lvl
                break
        if level is None:
            continue
        parts: list[str] = []
        for sibling in h.next_siblings:
            name = getattr(sibling, "name", None)
            if name in {"h1", "h2", "h3", "h4"}:
                break
            if name in {"p", "ul", "ol", "div"}:
                t = sibling.get_text(" ", strip=True)
                if t:
                    parts.append(t)
        prose = " ".join(parts).strip()
        if not prose:
            continue
        key = f"{level}:{prose}"
        if key in seen_texts:
            continue
        seen_texts.add(key)
        out.append((level, prose))
    return out


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


def _absolute(url: str) -> str:
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return f"https://travel.gc.ca{url}"


class CanadaScraper(AdvisoryScraper):
    source_id = "canada"
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
        country_map = load_mapping("canada_countries")
        out: list[Advisory] = []
        seen: set[str] = set()
        entries: list[tuple[str, str, int, str, str | None]] = []
        for row in soup.select("tr"):
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
            detail_url = _absolute(anchor["href"]) if anchor.get("href") else None
            entries.append((country_name, iso2, level, summary, detail_url))

        if self._max_countries is not None:
            entries = entries[: self._max_countries]

        total = len(entries)
        next_progress = time.monotonic() + PROGRESS_EVERY_S
        for idx, (name, iso2, level, summary, detail_url) in enumerate(entries, start=1):
            out.append(
                Advisory(
                    country_iso2=iso2,
                    region_code=None,
                    level=level,
                    summary=summary[:500],
                    source_url=detail_url or INDEX_URL,
                    fetched_at=when,
                )
            )
            if self._fetch_detail_pages and detail_url is not None:
                try:
                    detail_html = self._fetch_detail(detail_url)
                except Exception as exc:  # noqa: BLE001
                    log.warning(
                        "canada: detail fetch failed for %s (%s): %s", name, detail_url, exc
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
                log.info("canada: %d/%d countries processed", idx, total)
                next_progress = now + PROGRESS_EVERY_S
            if self._request_delay_s > 0 and idx < total and self._fetch_detail_pages:
                time.sleep(self._request_delay_s)
        return out


def fetch() -> list[Advisory]:
    with CanadaScraper() as scraper:
        return scraper.run()
