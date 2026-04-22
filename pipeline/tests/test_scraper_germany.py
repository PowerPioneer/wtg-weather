from __future__ import annotations

from wtg_pipeline.sources.advisories.germany import GermanyScraper, classify_entry


def test_classify_entry_ladder() -> None:
    assert classify_entry({"warning": True}) == 4
    assert classify_entry({"partialWarning": True}) == 3
    assert classify_entry({"situationWarning": True}) == 2
    assert classify_entry({"situationPartWarning": True}) == 2
    assert classify_entry({}) == 1
    # "warning" dominates any combination of lower flags.
    assert classify_entry({"warning": True, "partialWarning": True}) == 4


def test_parses_fixture(advisory_fixture) -> None:
    raw = advisory_fixture("germany.json")
    out = GermanyScraper(client=object()).parse(raw)
    by_iso = {a.country_iso2: a.level for a in out}
    assert by_iso["AF"] == 4
    assert by_iso["EG"] == 3
    assert by_iso["MX"] == 2
    assert by_iso["JP"] == 1
    # lowercase codes are uppercased
    assert by_iso["CO"] == 2


def test_entry_without_country_code_dropped(advisory_fixture) -> None:
    raw = advisory_fixture("germany.json")
    out = GermanyScraper(client=object()).parse(raw)
    # Atlantis entry lacks countryCode — must be absent.
    assert len(out) == 5


def test_country_only_never_sets_region(advisory_fixture) -> None:
    raw = advisory_fixture("germany.json")
    out = GermanyScraper(client=object()).parse(raw)
    for a in out:
        assert a.region_code is None
