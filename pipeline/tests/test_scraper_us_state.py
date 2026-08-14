"""US State Department advisory parsing, off the Consular Affairs open-data API.

The fixture is a slice of the live API (2026-08-14), chosen to include every
GEC/ISO code collision the feed contains — because the field that looks like a
country code is not one.
"""

from __future__ import annotations

from datetime import datetime, timezone

from wtg_pipeline.sources.advisories.us_state import (
    USStateScraper,
    clean_summary,
    parse_title,
)

FETCHED_AT = datetime(2026, 8, 14, tzinfo=timezone.utc)


def _parse(advisory_fixture):
    return USStateScraper(client=object()).parse(
        advisory_fixture("us_state.json"), fetched_at=FETCHED_AT
    )


def test_parse_title_splits_country_from_level() -> None:
    assert parse_title("Mexico - Level 2: Exercise Increased Caution") == ("Mexico", 2)
    assert parse_title("Afghanistan - Level 4: Do Not Travel") == ("Afghanistan", 4)
    # Names containing a hyphen must survive — the split is on " - Level N".
    assert parse_title("Timor-Leste - Level 1: Exercise Normal Precautions") == (
        "Timor-Leste",
        1,
    )
    assert parse_title("Atlantis - No Level Assigned") is None
    assert parse_title("") is None


def test_the_ladder_is_read_off_the_title(advisory_fixture) -> None:
    by_iso = {a.country_iso2: a.level for a in _parse(advisory_fixture)}

    assert by_iso["AF"] == 4
    assert by_iso["CO"] == 3
    assert by_iso["MX"] == 2
    assert by_iso["JP"] == 1


def test_the_category_field_is_never_read_as_an_iso_code(advisory_fixture) -> None:
    """The trap this scraper exists to avoid.

    ``Category`` is a GEC/FIPS code, and three of them in this feed are valid
    ISO-3166 codes belonging to *other countries*. Reading it as ISO-2 yields
    a plausible-looking code for almost every record and paints Serbia with
    Russia's "Do Not Travel".
    """
    by_iso = {a.country_iso2: a.level for a in _parse(advisory_fixture)}

    # Russia's Category is "RS", which is Serbia's real ISO-3166 code.
    assert by_iso["RU"] == 4
    assert by_iso["RS"] == 2, "Serbia must keep its own level, not Russia's"
    # Mongolia's Category is "MG" — Madagascar's ISO code.
    assert by_iso["MN"] == 1
    assert "MG" not in by_iso
    # Switzerland's Category is "SR" (Suriname's ISO code); Japan's is "JA".
    assert by_iso["CH"] == 1
    assert "SR" not in by_iso
    assert "JA" not in by_iso


def test_a_title_naming_no_single_country_is_dropped(advisory_fixture) -> None:
    # "French West Indies" is a grouping of four territories with no single
    # ISO-3166 code. Dropping loses this source's opinion; guessing would
    # attach it to a country that was never assessed.
    out = _parse(advisory_fixture)
    assert all("french west indies" not in a.summary.lower() for a in out)


def test_a_title_without_a_level_is_ignored(advisory_fixture) -> None:
    out = _parse(advisory_fixture)
    assert all(a.country_iso2 != "ZZ" for a in out)


def test_every_record_satisfies_the_shared_schema(advisory_fixture) -> None:
    for advisory in _parse(advisory_fixture):
        assert len(advisory.country_iso2) == 2
        assert 1 <= advisory.level <= 4
        assert advisory.source_url.startswith("https://")
        assert advisory.fetched_at.tzinfo is not None
        assert advisory.summary


def test_country_rows_never_claim_a_region(advisory_fixture) -> None:
    # Carve-outs are deliberately not extracted from this source; the prose
    # says "do not travel to <country>" as often as it names a region.
    for advisory in _parse(advisory_fixture):
        assert advisory.region_code is None


def test_summary_is_prose_not_markup(advisory_fixture) -> None:
    by_iso = {a.country_iso2: a for a in _parse(advisory_fixture)}
    summary = by_iso["MX"].summary

    assert "<" not in summary and ">" not in summary
    assert "&nbsp;" not in summary
    assert "Mexico" in summary


def test_clean_summary_strips_markup_and_entities() -> None:
    assert clean_summary("<p>Exercise&nbsp;caution in <b>Kenya</b>.</p>") == (
        "Exercise caution in Kenya ."
    )
    assert clean_summary("") == ""


def test_one_row_per_country(advisory_fixture) -> None:
    out = _parse(advisory_fixture)
    codes = [a.country_iso2 for a in out]
    assert len(codes) == len(set(codes))
