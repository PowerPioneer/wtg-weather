"""Dutch BZ advisory parsing.

The fixture is a slice of the real open-data feed (2026-08-06), not a
simplified stand-in. That matters: the previous fixture contained sentences
like "De kleurcode is groen." which the feed never actually emits, and every
test passed against a parser that rated 61 of 224 countries "rood" —
including Japan, South Korea, India and Thailand — because it took the first
colour word in a blob whose regional carve-outs come *before* the
country-wide code.
"""

from __future__ import annotations

from wtg_pipeline.sources.advisories.netherlands import (
    NetherlandsScraper,
    classify_introduction,
    classify_introduction_detailed,
    statements,
)

# The shape the feed actually uses: carve-out bullet first, country-wide last.
JAPAN_INTRO = (
    "<h2>In het kort</h2>\n  <ul>  <li>Op 28 juli 2026 was er een zware "
    "aardbeving in Kyushu.</li>  <li>De kleurcode van het reisadvies voor "
    "het zuidoosten van Fukushima is rood. Wat uw situatie ook is: reis er "
    "niet heen.</li>    <li>Voor de rest van Japan geldt kleurcode groen. "
    "U kunt hierheen reizen.</li> </ul>"
)


def test_country_wide_code_wins_over_an_earlier_carve_out() -> None:
    """The regression. Japan is green with one red prefecture, not red."""
    assert classify_introduction(JAPAN_INTRO, "Japan") == 1


def test_carve_out_is_reported_separately() -> None:
    country, regional = classify_introduction_detailed(JAPAN_INTRO, "Japan")
    assert country == 1
    assert regional == [4]


def test_single_sentence_records_still_parse() -> None:
    # Roughly half the feed is one sentence with no list at all.
    intro = (
        "In het kort De kleurcode van het reisadvies voor Duitsland is groen. "
        "U kunt erheen reizen."
    )
    assert classify_introduction(intro, "Duitsland") == 1


def test_colour_ladder() -> None:
    for colour, level in (("groen", 1), ("geel", 2), ("oranje", 3), ("rood", 4)):
        intro = f"De kleurcode van het reisadvies voor Ruritanië is {colour}."
        assert classify_introduction(intro, "Ruritanië") == level


def test_a_hedged_country_wide_code_is_still_country_wide() -> None:
    # "voor het grootste deel rood" — Burkina Faso's phrasing.
    intro = (
        "De kleurcode van het reisadvies voor Burkina Faso is voor het "
        "grootste deel rood. Wat uw situatie ook is: reis er niet heen."
    )
    assert classify_introduction(intro, "Burkina Faso") == 4


def test_region_clause_after_the_colour_is_not_the_country() -> None:
    """India's phrasing, and the second way the old parser went wrong.

    The region list is long enough that a bounded subject match fails; the
    parser must then report *nothing* for the country rather than falling
    back to reading "rood" as national.
    """
    intro = (
        "De kleurcode van het reisadvies van India is rood voor de regio’s "
        "Jammu en Kasjmir, Aksai Chin, voor de deelstaat Manipur en voor de "
        "grensstrook tussen India en Pakistan."
    )
    country, regional = classify_introduction_detailed(intro, "India")
    assert country is None
    assert regional == [4]


def test_unparseable_region_clause_never_becomes_a_country_level() -> None:
    # The guard in its own right: a colour followed by a "voor" this parser
    # cannot resolve must yield nothing, not the whole country.
    intro = "De kleurcode van het reisadvies is rood voor het gebied ergens."
    assert classify_introduction(intro, "Ruritanië") is None


def test_rest_van_tolerates_an_apposition() -> None:
    intro = (
        "Voor de rest van Pakistan, onder andere de hoofdstad Islamabad, "
        "geldt kleurcode geel."
    )
    assert classify_introduction(intro, "Pakistan") == 2


def test_rest_van_a_region_is_not_the_country() -> None:
    # Burundi says "de rest van het noordwesten van de provincie Bujumbura",
    # which is emphatically not "the rest of Burundi".
    intro = (
        "Kleurcode oranje geldt voor de rest van het noordwesten van de "
        "provincie Bujumbura. Voor de rest van Burundi geldt kleurcode geel."
    )
    country, regional = classify_introduction_detailed(intro, "Burundi")
    assert country == 2
    assert regional == [3]


def test_source_typos_do_not_cost_a_country_its_level() -> None:
    # Both of these are in the live feed.
    assert classify_introduction("Vor de rest van Marokko geldt kleurcode geel.", "Marokko") == 2
    assert (
        classify_introduction(
            "De kleurcode voor het reisadvies voor Zuid-Afrika is geel.", "Zuid-Afrika"
        )
        == 2
    )


def test_abbreviated_country_names_resolve() -> None:
    assert classify_introduction(
        "De kleurcode van het reisadvies voor het VK is groen.", "Verenigd Koninkrijk"
    ) == 1
    assert classify_introduction(
        "Voor de rest van de VAE geldt kleurcode oranje.", "Verenigde Arabische Emiraten"
    ) == 3


def test_unknown_country_name_yields_nothing_rather_than_a_guess() -> None:
    """The failure direction that matters.

    An unrecognised name costs this source's opinion on one country, which
    the other five governments cover. Guessing would put a wrong colour on a
    real place, and `max` consensus would then propagate it to the map.
    """
    intro = "Voor de rest van Absurdistan geldt kleurcode rood."
    assert classify_introduction(intro, "Ruritanië") is None


def test_statements_keep_list_items_apart() -> None:
    # A carve-out and the country-wide code must never merge into one
    # sentence, which is what makes the word-order rule usable.
    parts = statements(JAPAN_INTRO)
    assert any("zuidoosten van Fukushima" in p for p in parts)
    assert any(p.startswith("Voor de rest van Japan") for p in parts)
    # …and no single statement carries both claims.
    assert not any("Fukushima" in p and "rest van Japan" in p for p in parts)


def test_parses_fixture(advisory_fixture) -> None:
    raw = advisory_fixture("netherlands.json")
    out = NetherlandsScraper(client=object()).parse(raw)
    by_iso = {a.country_iso2: a.level for a in out if a.region_code is None}

    # Countries the broken parser rated 4. Every other government says 1-2.
    assert by_iso["JP"] == 1
    assert by_iso["IN"] == 2
    assert by_iso["GE"] == 2
    assert by_iso["MA"] == 2
    assert by_iso["MX"] == 2
    # Countries that really are at the top of the ladder.
    assert by_iso["AF"] == 4
    assert by_iso["UA"] == 4
    # The remaining parse shapes.
    assert by_iso["DE"] == 1
    assert by_iso["GB"] == 1
    assert by_iso["FR"] == 2
    assert by_iso["PK"] == 2
    assert by_iso["ZA"] == 2


def test_a_region_only_country_reports_no_country_level(advisory_fixture) -> None:
    # Iraq is described purely region by region; the feed publishes no
    # national colour, so neither do we.
    raw = advisory_fixture("netherlands.json")
    out = NetherlandsScraper(client=object()).parse(raw)
    assert not [a for a in out if a.country_iso2 == "IQ" and a.region_code is None]


def test_carve_outs_reach_the_output_as_sentinels(advisory_fixture) -> None:
    raw = advisory_fixture("netherlands.json")
    out = NetherlandsScraper(client=object()).parse(raw)
    japan = [a for a in out if a.country_iso2 == "JP"]
    assert sorted((a.level, a.region_code) for a in japan) == [
        (1, None),
        (4, "regional-L4"),
    ]
    # The feed names areas in prose, so no carve-out may claim an ISO-3166-2
    # code — `processing.advisories` would paint that polygon directly.
    for advisory in out:
        assert advisory.region_code is None or advisory.region_code.startswith("regional-L")


def test_carve_outs_are_only_reported_when_worse_than_the_country(
    advisory_fixture,
) -> None:
    raw = advisory_fixture("netherlands.json")
    out = NetherlandsScraper(client=object()).parse(raw)
    by_country = {a.country_iso2: a.level for a in out if a.region_code is None}
    for advisory in out:
        if advisory.region_code:
            assert advisory.level > by_country[advisory.country_iso2]


def test_missing_isocode_or_colour_dropped(advisory_fixture) -> None:
    raw = advisory_fixture("netherlands.json")
    out = NetherlandsScraper(client=object()).parse(raw)
    iso = {a.country_iso2 for a in out}
    # "Nergenshuizen" has no isocode; Antarctica states no kleurcode.
    assert "AQ" not in iso
    assert len(iso) == 12, sorted(iso)


def test_summary_includes_location_and_colour(advisory_fixture) -> None:
    raw = advisory_fixture("netherlands.json")
    out = NetherlandsScraper(client=object()).parse(raw)
    by_iso = {a.country_iso2: a for a in out if a.region_code is None}
    assert "rood" in by_iso["AF"].summary.lower()
    assert "afghanistan" in by_iso["AF"].summary.lower()


def test_source_url_from_feed(advisory_fixture) -> None:
    raw = advisory_fixture("netherlands.json")
    out = NetherlandsScraper(client=object()).parse(raw)
    by_iso = {a.country_iso2: a for a in out if a.region_code is None}
    assert by_iso["AF"].source_url.endswith("/afghanistan")


def test_no_country_is_read_as_do_not_travel_without_saying_so(
    advisory_fixture,
) -> None:
    """A shape guard on the whole fixture.

    The defect was not one bad country, it was a level-4 count that no
    government would recognise. Nothing in this fixture is red except the two
    countries that really are.
    """
    raw = advisory_fixture("netherlands.json")
    out = NetherlandsScraper(client=object()).parse(raw)
    red = {a.country_iso2 for a in out if a.region_code is None and a.level == 4}
    assert red == {"AF", "UA"}
