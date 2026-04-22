from __future__ import annotations

from wtg_pipeline.sources.advisories.netherlands import (
    NetherlandsScraper,
    classify_introduction,
)


def test_classify_introduction_ladder() -> None:
    assert classify_introduction("De kleurcode is groen.") == 1
    assert classify_introduction("De kleurcode is geel. Let op.") == 2
    assert classify_introduction("De kleurcode is oranje.") == 3
    assert classify_introduction("De kleurcode is rood. Reis er niet heen.") == 4
    # Case insensitive + html wrapping.
    assert classify_introduction("<p>De KLEURCODE is ROOD.</p>") == 4
    # No colour → None.
    assert classify_introduction("Geen informatie beschikbaar.") is None
    assert classify_introduction("") is None


def test_parses_fixture(advisory_fixture) -> None:
    raw = advisory_fixture("netherlands.json")
    out = NetherlandsScraper(client=object()).parse(raw)
    by_iso = {a.country_iso2: a.level for a in out}
    assert by_iso["AF"] == 4
    assert by_iso["UA"] == 3
    assert by_iso["MX"] == 2
    assert by_iso["JP"] == 1


def test_missing_isocode_or_colour_dropped(advisory_fixture) -> None:
    raw = advisory_fixture("netherlands.json")
    out = NetherlandsScraper(client=object()).parse(raw)
    # "NOCODE" lacks an isocode; Antarctica lacks the kleurcode phrase.
    assert len(out) == 4


def test_country_only_never_sets_region(advisory_fixture) -> None:
    raw = advisory_fixture("netherlands.json")
    out = NetherlandsScraper(client=object()).parse(raw)
    for a in out:
        assert a.region_code is None


def test_summary_includes_location_and_colour(advisory_fixture) -> None:
    raw = advisory_fixture("netherlands.json")
    out = NetherlandsScraper(client=object()).parse(raw)
    by_iso = {a.country_iso2: a for a in out}
    assert "rood" in by_iso["AF"].summary.lower()
    assert "afghanistan" in by_iso["AF"].summary.lower()


def test_source_url_from_feed(advisory_fixture) -> None:
    raw = advisory_fixture("netherlands.json")
    out = NetherlandsScraper(client=object()).parse(raw)
    by_iso = {a.country_iso2: a for a in out}
    assert by_iso["AF"].source_url.endswith("/afghanistan")
