from __future__ import annotations

from wtg_pipeline.sources.advisories.australia import AustraliaScraper, classify


def test_classify_ladder() -> None:
    assert classify("Exercise normal safety precautions") == 1
    assert classify("Exercise a high degree of caution") == 2
    assert classify("Reconsider your need to travel") == 3
    assert classify("Do not travel") == 4
    # "No travel advice" is not a real level and must be skipped.
    assert classify("No travel advice") is None
    # Case / whitespace insensitive.
    assert classify("  DO NOT TRAVEL  ") == 4


def test_parses_fixture(advisory_fixture) -> None:
    raw = advisory_fixture("australia.json")
    out = AustraliaScraper(client=object()).parse(raw)
    by_iso = {a.country_iso2: a.level for a in out}
    assert by_iso["AF"] == 4
    assert by_iso["CO"] == 3
    assert by_iso["MX"] == 2
    assert by_iso["JP"] == 1
    # HTML entity-encoded + accented name resolves via the mapping table.
    assert by_iso["CI"] == 2


def test_no_travel_advice_and_unmapped_dropped(advisory_fixture) -> None:
    raw = advisory_fixture("australia.json")
    out = AustraliaScraper(client=object()).parse(raw)
    iso = {a.country_iso2 for a in out}
    # Antarctica has "No travel advice" and Atlantis has no mapping.
    assert len(out) == 5
    assert "ZZ" not in iso


def test_country_only_never_sets_region(advisory_fixture) -> None:
    raw = advisory_fixture("australia.json")
    out = AustraliaScraper(client=object()).parse(raw)
    for a in out:
        assert a.region_code is None


def test_source_url_from_feed(advisory_fixture) -> None:
    raw = advisory_fixture("australia.json")
    out = AustraliaScraper(client=object()).parse(raw)
    by_iso = {a.country_iso2: a for a in out}
    assert by_iso["AF"].source_url.endswith("/afghanistan")
