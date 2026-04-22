"""Government travel advisory scrapers.

All scrapers produce the same normalised :class:`Advisory` record — see
``base.py``. Each government's scraper lives in its own file.
"""

from __future__ import annotations

from wtg_pipeline.sources.advisories.australia import AustraliaScraper
from wtg_pipeline.sources.advisories.base import Advisory, AdvisoryScraper, write_advisories
from wtg_pipeline.sources.advisories.canada import CanadaScraper
from wtg_pipeline.sources.advisories.germany import GermanyScraper
from wtg_pipeline.sources.advisories.netherlands import NetherlandsScraper
from wtg_pipeline.sources.advisories.uk_fcdo import UKFCDOScraper
from wtg_pipeline.sources.advisories.us_state import USStateScraper

SCRAPERS: dict[str, type[AdvisoryScraper]] = {
    "us": USStateScraper,
    "uk": UKFCDOScraper,
    "ca": CanadaScraper,
    "au": AustraliaScraper,
    "de": GermanyScraper,
    "nl": NetherlandsScraper,
}

__all__ = [
    "Advisory",
    "AdvisoryScraper",
    "AustraliaScraper",
    "CanadaScraper",
    "GermanyScraper",
    "NetherlandsScraper",
    "SCRAPERS",
    "UKFCDOScraper",
    "USStateScraper",
    "write_advisories",
]
