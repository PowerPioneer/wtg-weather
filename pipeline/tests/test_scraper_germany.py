"""German Auswärtiges Amt advisory parsing.

The fixture is a slice of the live open-data feed (2026-08-06) plus three
synthetic rows for contract cases the live vintage does not exercise. The
previous fixture was entirely synthetic and, crucially, invented `title`
values — "Teilreisewarnung", "Sicherheitshinweis" — that the feed never
emits; its real titles are always "<Land>: Reise- und Sicherheitshinweise".
Those invented titles made a wrong mapping read as obviously right.
"""

from __future__ import annotations

from wtg_pipeline.sources.advisories.germany import (
    GermanyScraper,
    classify_entry,
    classify_entry_detailed,
)


def test_full_travel_warning_is_country_wide() -> None:
    assert classify_entry_detailed({"warning": True}) == (4, [])


def test_partial_warning_is_a_carve_out_not_a_country_level() -> None:
    """The regression.

    A Teilreisewarnung is a Reisewarnung for *part* of a country — Japan's is
    the Fukushima exclusion zone. Reported as a country-wide 3 it put Japan,
    India and Thailand on "Reconsider travel" and made this source the sole
    driver of 16 of the 31 countries the consensus rated 3.
    """
    assert classify_entry_detailed({"partialWarning": True}) == (1, [4])


def test_situation_warning_is_country_wide_caution() -> None:
    assert classify_entry_detailed({"situationWarning": True}) == (2, [])


def test_partial_situation_warning_is_also_a_carve_out() -> None:
    assert classify_entry_detailed({"situationPartWarning": True}) == (1, [2])


def test_a_carve_out_no_worse_than_the_country_is_dropped() -> None:
    # A partial situation warning inside a country already at 2 tells a
    # traveller nothing new.
    assert classify_entry_detailed(
        {"situationWarning": True, "situationPartWarning": True}
    ) == (2, [])


def test_full_warning_dominates_any_partial_flag() -> None:
    assert classify_entry_detailed({"warning": True, "partialWarning": True}) == (4, [])
    assert classify_entry({"warning": True, "partialWarning": True}) == 4


def test_no_flags_is_routine_information() -> None:
    assert classify_entry_detailed({}) == (1, [])


def test_parses_fixture(advisory_fixture) -> None:
    raw = advisory_fixture("germany.json")
    out = GermanyScraper(client=object()).parse(raw)
    by_iso = {a.country_iso2: a.level for a in out if a.region_code is None}

    # Real Reisewarnungen.
    assert by_iso["AF"] == 4
    assert by_iso["UA"] == 4
    # Teilreisewarnungen — the country itself is not warned against.
    assert by_iso["JP"] == 1
    assert by_iso["IN"] == 1
    assert by_iso["TH"] == 1
    assert by_iso["EG"] == 1
    assert by_iso["CO"] == 1
    # No flags at all.
    assert by_iso["FR"] == 1
    assert by_iso["NZ"] == 1
    # Lowercase codes are uppercased.
    assert by_iso["MX"] == 2


def test_partial_warnings_reach_the_output_as_sentinels(advisory_fixture) -> None:
    raw = advisory_fixture("germany.json")
    out = GermanyScraper(client=object()).parse(raw)
    japan = sorted((a.level, a.region_code) for a in out if a.country_iso2 == "JP")
    assert japan == [(1, None), (4, "regional-L4")]
    ghana = sorted((a.level, a.region_code) for a in out if a.country_iso2 == "GH")
    assert ghana == [(1, None), (2, "regional-L2")]


def test_the_feed_names_no_regions_so_no_iso_code_is_claimed(advisory_fixture) -> None:
    # The entry carries four booleans and nothing else — there is no area to
    # resolve, so a carve-out must never claim an ISO-3166-2 code, which
    # `processing.advisories` would paint onto a polygon.
    raw = advisory_fixture("germany.json")
    out = GermanyScraper(client=object()).parse(raw)
    for advisory in out:
        assert advisory.region_code is None or advisory.region_code.startswith("regional-L")


def test_a_country_wide_warning_emits_no_carve_out(advisory_fixture) -> None:
    raw = advisory_fixture("germany.json")
    out = GermanyScraper(client=object()).parse(raw)
    assert [a.region_code for a in out if a.country_iso2 == "AF"] == [None]


def test_entry_without_country_code_dropped(advisory_fixture) -> None:
    raw = advisory_fixture("germany.json")
    out = GermanyScraper(client=object()).parse(raw)
    # The Atlantis row has no countryCode. Twelve countries, plus one
    # carve-out for each of the five partial warnings and one for Ghana.
    countries = [a for a in out if a.region_code is None]
    assert len(countries) == 12
    assert len(out) == 12 + 6


def test_only_real_reisewarnungen_reach_level_four(advisory_fixture) -> None:
    """A shape guard.

    The defect was a level distribution no government would recognise: 200
    records, 27 threes, and not one level 2. Nothing here is country-wide 4
    except the two countries under a full Reisewarnung.
    """
    raw = advisory_fixture("germany.json")
    out = GermanyScraper(client=object()).parse(raw)
    red = {a.country_iso2 for a in out if a.region_code is None and a.level == 4}
    assert red == {"AF", "UA"}
