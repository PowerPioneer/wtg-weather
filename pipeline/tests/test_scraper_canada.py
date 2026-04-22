from __future__ import annotations

from pathlib import Path

from wtg_pipeline.sources.advisories.canada import (
    CanadaScraper,
    _level_from_img,
    _level_from_text,
    extract_regional_carveouts,
)

FIXTURES = Path(__file__).parent / "fixtures" / "advisories"


def test_level_from_img() -> None:
    assert _level_from_img("/vt/images/taa/risklevels/do-not-travel.svg") == 4
    assert _level_from_img("/vt/images/taa/risklevels/reconsider-travel.svg") == 3
    assert _level_from_img("/vt/images/taa/risklevels/increased-caution.svg") == 2
    assert _level_from_img("/vt/images/taa/risklevels/normal-precautions.svg") == 1
    assert _level_from_img("/something-else.svg") is None


def test_level_from_text() -> None:
    assert _level_from_text("Avoid all travel") == 4
    assert _level_from_text("Avoid non-essential travel") == 3
    assert _level_from_text("Exercise a high degree of caution") == 2
    assert _level_from_text("Take normal security precautions") == 1


def test_parses_fixture(advisory_fixture) -> None:
    raw = advisory_fixture("canada.html")
    out = CanadaScraper(client=object(), fetch_detail_pages=False).parse(raw)
    by_iso = {a.country_iso2: a.level for a in out if a.region_code is None}
    assert by_iso["AF"] == 4
    assert by_iso["CO"] == 3
    assert by_iso["MX"] == 2
    assert by_iso["JP"] == 1


def test_unmapped_country_dropped(advisory_fixture) -> None:
    raw = advisory_fixture("canada.html")
    out = CanadaScraper(client=object(), fetch_detail_pages=False).parse(raw)
    iso = {a.country_iso2 for a in out}
    assert "ZZ" not in iso
    country_rows = [a for a in out if a.region_code is None]
    assert len(country_rows) == 4


def test_country_rows_have_null_region(advisory_fixture) -> None:
    raw = advisory_fixture("canada.html")
    out = CanadaScraper(client=object(), fetch_detail_pages=False).parse(raw)
    country_rows = [a for a in out if a.region_code is None]
    assert {a.country_iso2 for a in country_rows} == {"AF", "CO", "MX", "JP"}


def test_extract_regional_carveouts_parses_sections() -> None:
    html = (FIXTURES / "canada_mexico.html").read_text(encoding="utf-8")
    carveouts = extract_regional_carveouts(html)
    levels = {lvl for lvl, _ in carveouts}
    assert 4 in levels  # "Avoid all travel to"
    assert 3 in levels  # "Avoid non-essential travel to"


def test_regional_rows_emitted_when_detail_fetched(advisory_fixture) -> None:
    raw = advisory_fixture("canada.html")

    class _StubResp:
        def __init__(self, text: str) -> None:
            self.text = text

        def raise_for_status(self) -> None:
            return None

    mexico_html = (FIXTURES / "canada_mexico.html").read_text(encoding="utf-8")

    class _StubClient:
        def get(self, url: str):
            if "/mexico" in url:
                return _StubResp(mexico_html)
            return _StubResp("<html></html>")

    scraper = CanadaScraper(client=_StubClient(), request_delay_s=0.0)
    out = scraper.parse(raw)
    mx_country = [a for a in out if a.country_iso2 == "MX" and a.region_code is None]
    mx_regional = [a for a in out if a.country_iso2 == "MX" and a.region_code is not None]
    assert len(mx_country) == 1 and mx_country[0].level == 2
    # Country L2; L3 and L4 carveouts > country.
    assert {a.level for a in mx_regional} == {3, 4}
    assert all(a.region_code.startswith("regional-L") for a in mx_regional)
