from __future__ import annotations

from datetime import datetime, timezone

from wtg_pipeline.sources.advisories.us_state import USStateScraper


def test_parses_level_and_country(advisory_fixture) -> None:
    raw = advisory_fixture("us_state.html")
    scraper = USStateScraper(client=object())
    out = scraper.parse(raw, fetched_at=datetime(2026, 4, 1, tzinfo=timezone.utc))
    by_iso = {a.country_iso2: a for a in out}
    assert by_iso["AF"].level == 4
    assert by_iso["JP"].level == 1
    assert by_iso["MX"].level == 2
    assert by_iso["CO"].level == 3


def test_drops_unmapped_countries(advisory_fixture) -> None:
    raw = advisory_fixture("us_state.html")
    out = USStateScraper(client=object()).parse(raw)
    iso = {a.country_iso2 for a in out}
    # "Atlantis" is not in the mapping table and must be discarded.
    assert "AT" not in iso or all(a.country_iso2 != "AT" or a.level != 2 for a in out)
    assert len(out) == 4


def test_rows_without_level_are_ignored(advisory_fixture) -> None:
    raw = advisory_fixture("us_state.html")
    out = USStateScraper(client=object()).parse(raw)
    # France row has no Level N — must not appear.
    assert all(a.country_iso2 != "FR" for a in out)


def test_source_url_and_schema(advisory_fixture) -> None:
    raw = advisory_fixture("us_state.html")
    out = USStateScraper(client=object()).parse(raw)
    for a in out:
        assert a.source_url.startswith("https://travel.state.gov/")
        assert a.fetched_at.tzinfo is not None
        assert 1 <= a.level <= 4
