from __future__ import annotations

from pathlib import Path

from wtg_pipeline.sources.advisories.uk_fcdo import (
    UKFCDOScraper,
    classify_detail_text,
    classify_from_detail,
)


FIXTURES = Path(__file__).parent / "fixtures" / "advisories" / "uk_fcdo"


def test_classify_detail_text_ladder() -> None:
    assert classify_detail_text("FCDO advises against all travel to Afghanistan") == 4
    assert (
        classify_detail_text("FCDO advises against all but essential travel to Ukraine")
        == 3
    )
    # "all travel to PARTS OF" demotes to 3.
    assert (
        classify_detail_text("FCDO advises against all travel to parts of Turkey") == 3
    )
    # "all but essential to PARTS OF" is 2.
    assert (
        classify_detail_text(
            "FCDO advises against all but essential travel to parts of Egypt"
        )
        == 2
    )
    # Neutral / no advisory phrasing falls through.
    assert classify_detail_text("Before you travel, check the FCDO advice.") == 1
    # Generic boilerplate words ("Warnings and insurance") must NOT bump the
    # level — gov.uk has that H2 on every country page.
    assert classify_detail_text("Warnings and insurance") == 1


def test_classify_from_detail_returns_heading_summary() -> None:
    html = (FIXTURES / "afghanistan.html").read_text(encoding="utf-8")
    level, summary = classify_from_detail(html, country="Afghanistan")
    assert level == 4
    assert "all travel" in summary.lower()


class _StubClient:
    """Minimal httpx-like stub serving fixture files keyed by URL."""

    def __init__(self, routes: dict[str, Path]) -> None:
        self._routes = routes

    def get(self, url: str) -> "_StubResponse":
        path = self._routes[url]
        return _StubResponse(path.read_text(encoding="utf-8"))


class _StubResponse:
    def __init__(self, text: str) -> None:
        self.text = text

    def raise_for_status(self) -> None:
        return None


def _routes() -> dict[str, Path]:
    base = "https://www.gov.uk/foreign-travel-advice/"
    return {
        base + "afghanistan": FIXTURES / "afghanistan.html",
        base + "egypt": FIXTURES / "egypt.html",
        base + "turkey": FIXTURES / "turkey.html",
        base + "ukraine": FIXTURES / "ukraine.html",
        base + "france": FIXTURES / "france.html",
        base + "japan": FIXTURES / "japan.html",
        base + "atlantis": FIXTURES / "afghanistan.html",  # would-be red herring
    }


def test_parses_two_stage() -> None:
    index_html = (FIXTURES / "index.html").read_text(encoding="utf-8")
    scraper = UKFCDOScraper(client=_StubClient(_routes()), request_delay_s=0.0)
    out = scraper.parse(index_html)
    by_iso = {a.country_iso2: a for a in out}
    assert by_iso["AF"].level == 4
    # Ukraine: "all but essential" country-wide → 3.
    assert by_iso["UA"].level == 3
    # Turkey: "all travel" to parts → 3.
    assert by_iso["TR"].level == 3
    # Egypt: "all but essential" to parts → 2.
    assert by_iso["EG"].level == 2
    assert by_iso["FR"].level == 1
    assert by_iso["JP"].level == 1


def test_unmapped_country_dropped() -> None:
    index_html = (FIXTURES / "index.html").read_text(encoding="utf-8")
    scraper = UKFCDOScraper(client=_StubClient(_routes()), request_delay_s=0.0)
    out = scraper.parse(index_html)
    # Atlantis has no mapping — must not appear.
    iso = {a.country_iso2 for a in out}
    assert "ZZ" not in iso


def test_source_urls_absolute() -> None:
    index_html = (FIXTURES / "index.html").read_text(encoding="utf-8")
    scraper = UKFCDOScraper(client=_StubClient(_routes()), request_delay_s=0.0)
    out = scraper.parse(index_html)
    for a in out:
        assert a.source_url.startswith("https://www.gov.uk/")


def test_country_only_never_sets_region() -> None:
    index_html = (FIXTURES / "index.html").read_text(encoding="utf-8")
    scraper = UKFCDOScraper(client=_StubClient(_routes()), request_delay_s=0.0)
    out = scraper.parse(index_html)
    for a in out:
        assert a.region_code is None


def test_max_countries_caps_detail_fetches() -> None:
    index_html = (FIXTURES / "index.html").read_text(encoding="utf-8")
    scraper = UKFCDOScraper(
        client=_StubClient(_routes()), request_delay_s=0.0, max_countries=2
    )
    out = scraper.parse(index_html)
    assert len(out) <= 2
