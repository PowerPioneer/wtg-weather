"""Smartraveller (Australian DFAT) travel advisories.

Source: https://www.smartraveller.gov.au/destinations-export (JSON)

Smartraveller publishes a machine-readable JSON export containing one
record per destination. The relevant field is ``field_overall_advice_level``,
whose string value maps 1:1 onto our canonical ladder:

================================================  ======
Smartraveller level string                         Level
================================================  ======
Exercise normal safety precautions                  1
Exercise a high degree of caution                   2
Reconsider your need to travel                      3
Do not travel                                       4
No travel advice                                    (skipped)
================================================  ======

The public-facing site (``/destinations``) sits behind an Akamai bot
defence that blocks stock HTTP clients via TLS fingerprinting. The JSON
export requires the same defence to be satisfied, so by default we build
the client using ``curl_cffi`` with Chrome impersonation. The scraper
still accepts an injected client for tests.
"""

from __future__ import annotations

import html
import json
import logging
from datetime import datetime
from typing import Protocol

from wtg_pipeline.sources.advisories.base import (
    Advisory,
    AdvisoryScraper,
    load_mapping,
    utcnow,
)

log = logging.getLogger(__name__)

EXPORT_URL = "https://www.smartraveller.gov.au/destinations-export"
INDEX_URL = "https://www.smartraveller.gov.au/destinations"

_LEVEL_TEXT: dict[str, int] = {
    "exercise normal safety precautions": 1,
    "exercise a high degree of caution": 2,
    "reconsider your need to travel": 3,
    "do not travel": 4,
}


def classify(level_text: str) -> int | None:
    """Map a Smartraveller overall-advice-level string onto 1..4."""
    return _LEVEL_TEXT.get(level_text.strip().lower())


class _Response(Protocol):
    text: str

    def raise_for_status(self) -> None: ...


class _CurlCFFISession:
    """Thin adapter matching the tiny interface the base class expects."""

    def __init__(self) -> None:
        # Import here so tests that inject a client don't need curl_cffi.
        from curl_cffi import requests as _cffi_requests

        self._session = _cffi_requests.Session(impersonate="chrome")

    def get(self, url: str, **kwargs: object) -> _Response:
        r = self._session.get(url, timeout=30, **kwargs)  # type: ignore[arg-type]
        return r  # type: ignore[return-value]

    def close(self) -> None:
        self._session.close()


class AustraliaScraper(AdvisoryScraper):
    source_id = "australia"
    source_url = INDEX_URL

    @property
    def client(self):  # type: ignore[override]
        if self._client is None:
            self._client = _CurlCFFISession()
        return self._client

    def fetch_raw(self) -> str:
        resp = self.client.get(EXPORT_URL)
        resp.raise_for_status()
        return resp.text

    def parse(self, raw: str | bytes, *, fetched_at: datetime | None = None) -> list[Advisory]:
        when = fetched_at or utcnow()
        payload = json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
        if not isinstance(payload, list):
            raise ValueError("smartraveller export: expected a JSON array")
        country_map = load_mapping("australia_countries")
        out: list[Advisory] = []
        seen: set[str] = set()
        for entry in payload:
            if not isinstance(entry, dict):
                continue
            name = html.unescape((entry.get("title") or "").strip())
            level_text = (entry.get("field_overall_advice_level") or "").strip()
            if not name or not level_text:
                continue
            level = classify(level_text)
            if level is None:
                # "No travel advice" and any future new level string.
                continue
            iso2 = country_map.get(name)
            if not iso2:
                log.debug("australia: unmapped country %r", name)
                continue
            if iso2 in seen:
                continue
            seen.add(iso2)
            url = entry.get("field_url") or INDEX_URL
            summary = f"{name}: {level_text}"
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
    with AustraliaScraper() as scraper:
        return scraper.run()
