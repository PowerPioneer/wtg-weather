from __future__ import annotations

from pathlib import Path

from wtg_pipeline.sources.advisories.uk_fcdo import (
    UKFCDOScraper,
    classify_detail_text,
    classify_from_detail,
    extract_regional_carveouts,
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
    by_iso = {a.country_iso2: a for a in out if a.region_code is None}
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


def test_country_rows_have_null_region() -> None:
    index_html = (FIXTURES / "index.html").read_text(encoding="utf-8")
    scraper = UKFCDOScraper(client=_StubClient(_routes()), request_delay_s=0.0)
    out = scraper.parse(index_html)
    country_rows = [a for a in out if a.region_code is None]
    # One country row per mapped country present in the index fixture.
    assert {a.country_iso2 for a in country_rows} == {"AF", "UA", "TR", "EG", "FR", "JP"}


def test_extract_regional_carveouts_levels() -> None:
    turkey_html = (FIXTURES / "turkey.html").read_text(encoding="utf-8")
    carveouts = extract_regional_carveouts(turkey_html)
    levels = {lvl for lvl, _ in carveouts}
    assert 4 in levels  # "Areas where FCDO advises against all travel"
    assert 3 in levels  # "Areas ... all but essential travel"


def test_regional_rows_emitted_for_parts_of_countries() -> None:
    index_html = (FIXTURES / "index.html").read_text(encoding="utf-8")
    scraper = UKFCDOScraper(client=_StubClient(_routes()), request_delay_s=0.0)
    out = scraper.parse(index_html)
    regional = [a for a in out if a.region_code is not None]
    # Turkey country=L3; only L4 carveout (> country) surfaces.
    # Egypt country=L2; L3 carveout surfaces.
    tr_regional = [a for a in regional if a.country_iso2 == "TR"]
    eg_regional = [a for a in regional if a.country_iso2 == "EG"]
    assert {a.level for a in tr_regional} == {4}
    assert {a.level for a in eg_regional} == {3}
    # Region-code carries the level discriminator.
    assert all(a.region_code and a.region_code.startswith("regional-L") for a in regional)


def test_no_regional_rows_for_plain_countries() -> None:
    index_html = (FIXTURES / "index.html").read_text(encoding="utf-8")
    scraper = UKFCDOScraper(client=_StubClient(_routes()), request_delay_s=0.0)
    out = scraper.parse(index_html)
    regional = {a.country_iso2 for a in out if a.region_code is not None}
    assert "FR" not in regional
    assert "JP" not in regional
    assert "AF" not in regional  # L4 country-wide: no separate carveout section


def test_max_countries_caps_detail_fetches() -> None:
    index_html = (FIXTURES / "index.html").read_text(encoding="utf-8")
    scraper = UKFCDOScraper(
        client=_StubClient(_routes()), request_delay_s=0.0, max_countries=2
    )
    out = scraper.parse(index_html)
    # max_countries caps detail fetches; regional rows may still expand the
    # row count for countries that have carveout sections.
    country_rows = {a.country_iso2 for a in out if a.region_code is None}
    assert len(country_rows) <= 2
