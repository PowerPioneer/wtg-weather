from __future__ import annotations

from wtg_pipeline.sources.advisories.australia import (
    AustraliaScraper,
    classify,
    extract_regional_carveouts,
)


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
    by_iso = {a.country_iso2: a.level for a in out if a.region_code is None}
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
    # Five mapped countries with a real level. Antarctica and Atlantis drop.
    country_rows = [a for a in out if a.region_code is None]
    assert len(country_rows) == 5
    assert "ZZ" not in iso


def test_country_rows_have_null_region(advisory_fixture) -> None:
    raw = advisory_fixture("australia.json")
    out = AustraliaScraper(client=object()).parse(raw)
    country_rows = [a for a in out if a.region_code is None]
    assert {a.country_iso2 for a in country_rows} == {"AF", "CO", "MX", "JP", "CI"}


def test_source_url_from_feed(advisory_fixture) -> None:
    raw = advisory_fixture("australia.json")
    out = AustraliaScraper(client=object()).parse(raw)
    by_iso = {a.country_iso2: a for a in out if a.region_code is None}
    assert by_iso["AF"].source_url.endswith("/afghanistan")


def test_extract_regional_carveouts_parses_markers() -> None:
    prose = (
        "Reconsider your need to travel to Colombia overall. "
        "Do not travel to: Arauca and Cauca. "
        "Reconsider your need to travel to: Buenaventura."
    )
    carveouts = extract_regional_carveouts(prose)
    levels = {lvl for lvl, _ in carveouts}
    assert levels == {3, 4}


def test_regional_rows_emitted_from_advice_levels(advisory_fixture) -> None:
    raw = advisory_fixture("australia.json")
    out = AustraliaScraper(client=object()).parse(raw)
    regional = [a for a in out if a.region_code is not None]
    by_iso = {a.country_iso2: set() for a in regional}
    for a in regional:
        by_iso[a.country_iso2].add(a.level)
    # Colombia: country L3; only L4 (>country) regional surfaces.
    assert by_iso.get("CO") == {4}
    # Mexico: country L2, carveouts at L3 and L4 both surface.
    assert by_iso.get("MX") == {3, 4}
    # Japan has no carveout markers.
    assert "JP" not in by_iso
    assert all(a.region_code and a.region_code.startswith("regional-L") for a in regional)
