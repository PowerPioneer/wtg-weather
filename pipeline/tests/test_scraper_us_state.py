from __future__ import annotations

from datetime import datetime, timezone

from pathlib import Path

from wtg_pipeline.sources.advisories.us_state import (
    USStateScraper,
    extract_regional_carveouts,
)

FIXTURES = Path(__file__).parent / "fixtures" / "advisories"


def test_parses_level_and_country(advisory_fixture) -> None:
    raw = advisory_fixture("us_state.html")
    scraper = USStateScraper(client=object(), fetch_detail_pages=False)
    out = scraper.parse(raw, fetched_at=datetime(2026, 4, 1, tzinfo=timezone.utc))
    by_iso = {a.country_iso2: a for a in out if a.region_code is None}
    assert by_iso["AF"].level == 4
    assert by_iso["JP"].level == 1
    assert by_iso["MX"].level == 2
    assert by_iso["CO"].level == 3


def test_drops_unmapped_countries(advisory_fixture) -> None:
    raw = advisory_fixture("us_state.html")
    out = USStateScraper(client=object(), fetch_detail_pages=False).parse(raw)
    iso = {a.country_iso2 for a in out}
    assert "AT" not in iso or all(a.country_iso2 != "AT" or a.level != 2 for a in out)
    country_rows = [a for a in out if a.region_code is None]
    assert len(country_rows) == 4


def test_rows_without_level_are_ignored(advisory_fixture) -> None:
    raw = advisory_fixture("us_state.html")
    out = USStateScraper(client=object(), fetch_detail_pages=False).parse(raw)
    assert all(a.country_iso2 != "FR" for a in out)


def test_source_url_and_schema(advisory_fixture) -> None:
    raw = advisory_fixture("us_state.html")
    out = USStateScraper(client=object(), fetch_detail_pages=False).parse(raw)
    for a in out:
        assert a.source_url.startswith("https://travel.state.gov/")
        assert a.fetched_at.tzinfo is not None
        assert 1 <= a.level <= 4


def test_extract_regional_carveouts_parses_level_sections() -> None:
    html = (FIXTURES / "us_state_mexico.html").read_text(encoding="utf-8")
    carveouts = extract_regional_carveouts(html)
    levels = {lvl for lvl, _ in carveouts}
    assert levels == {2, 3, 4}


def test_regional_rows_emitted_when_detail_fetched() -> None:
    index_html = """
    <html><body><table>
      <tr data-country="Mexico">
        <td><a href="/content/travel/en/traveladvisories/mexico.html">Mexico</a></td>
        <td>Level 2: Exercise Increased Caution</td>
      </tr>
    </table></body></html>
    """

    class _StubResp:
        def __init__(self, text: str) -> None:
            self.text = text

        def raise_for_status(self) -> None:
            return None

    class _StubClient:
        def __init__(self, detail_html: str) -> None:
            self._detail_html = detail_html

        def get(self, url: str):
            return _StubResp(self._detail_html)

    detail_html = (FIXTURES / "us_state_mexico.html").read_text(encoding="utf-8")
    scraper = USStateScraper(
        client=_StubClient(detail_html),
        request_delay_s=0.0,
    )
    out = scraper.parse(index_html)
    mx_country = [a for a in out if a.country_iso2 == "MX" and a.region_code is None]
    mx_regional = [a for a in out if a.country_iso2 == "MX" and a.region_code is not None]
    assert len(mx_country) == 1 and mx_country[0].level == 2
    assert {a.level for a in mx_regional} == {3, 4}
    assert all(a.region_code.startswith("regional-L") for a in mx_regional)
