"""Advisory scraper base classes and the normalised output schema.

Every government scraper inherits from :class:`AdvisoryScraper` and yields
:class:`Advisory` records with the canonical shape::

    {country_iso2, region_code | None, level: 1..4, summary, source_url, fetched_at}

The level ladder is common across every government:

====  =======================================
1     No advisory / exercise normal precautions
2     Exercise increased caution / heightened
3     Reconsider travel / avoid non-essential
4     Do not travel / leave immediately
====  =======================================

Each source maps its own scale onto this ladder — the mapping is documented
in the concrete subclass.
"""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import ClassVar, Iterable, Protocol

import httpx
from pydantic import BaseModel, Field, field_validator

from wtg_pipeline.config import advisories_raw_dir, ensure_dir

log = logging.getLogger(__name__)

USER_AGENT = "wtg-pipeline/0.1 (+https://wheretogoforgreatweather.com)"


class Advisory(BaseModel):
    """Normalised advisory record — the schema every scraper must produce."""

    country_iso2: str = Field(min_length=2, max_length=2)
    region_code: str | None = None
    level: int = Field(ge=1, le=4)
    summary: str
    source_url: str
    fetched_at: datetime

    @field_validator("country_iso2")
    @classmethod
    def _upper_iso2(cls, v: str) -> str:
        return v.upper()

    @field_validator("fetched_at")
    @classmethod
    def _ensure_tz(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class HTTPClient(Protocol):
    def get(self, url: str, **kwargs: object) -> httpx.Response: ...


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def build_default_client() -> httpx.Client:
    return httpx.Client(
        timeout=httpx.Timeout(30.0, connect=10.0),
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    )


class AdvisoryScraper(ABC):
    """Base class. Subclasses override :meth:`fetch_raw` and :meth:`parse`."""

    source_id: ClassVar[str]
    source_url: ClassVar[str]

    def __init__(self, client: HTTPClient | None = None) -> None:
        self._client = client
        self._owns_client = client is None

    @property
    def client(self) -> HTTPClient:
        if self._client is None:
            self._client = build_default_client()
        return self._client

    def close(self) -> None:
        if self._owns_client and self._client is not None and hasattr(self._client, "close"):
            self._client.close()  # type: ignore[attr-defined]
            self._client = None

    def __enter__(self) -> AdvisoryScraper:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    @abstractmethod
    def fetch_raw(self) -> str | bytes:
        """Return raw source payload (usually HTML)."""

    @abstractmethod
    def parse(self, raw: str | bytes, *, fetched_at: datetime | None = None) -> list[Advisory]:
        """Parse the raw payload into normalised advisories."""

    def run(self) -> list[Advisory]:
        raw = self.fetch_raw()
        return self.parse(raw, fetched_at=utcnow())


def write_advisories(
    advisories: Iterable[Advisory],
    *,
    source_id: str,
    base_dir: Path | None = None,
    timestamp: datetime | None = None,
) -> Path:
    """Serialise advisories as a dated JSON array under ``advisories/<source>/``.

    Returns the path of the written file.
    """
    out_dir = ensure_dir((base_dir or advisories_raw_dir()) / source_id)
    ts = (timestamp or utcnow()).strftime("%Y-%m-%dT%H%M%SZ")
    target = out_dir / f"{ts}.json"
    records = [a.model_dump(mode="json") for a in advisories]
    target.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")
    return target


def load_mapping(name: str) -> dict[str, str]:
    """Load a JSON mapping table shipped next to the scrapers."""
    path = Path(__file__).resolve().parent / "mappings" / f"{name}.json"
    return json.loads(path.read_text(encoding="utf-8"))
