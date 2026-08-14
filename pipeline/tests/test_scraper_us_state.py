"""US State Department advisory parsing, off the Consular Affairs open-data API.

The fixture is a slice of the live API (2026-08-14), chosen to include every
GEC/ISO code collision the feed contains — because the field that looks like a
country code is not one.
"""

from __future__ import annotations

import re

import pytest
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


def _country_levels(advisory_fixture) -> dict[str, int]:
    """Country-wide rows only — carve-outs are separate records."""
    return {
        a.country_iso2: a.level for a in _parse(advisory_fixture) if a.region_code is None
    }


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
    by_iso = _country_levels(advisory_fixture)

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
    by_iso = _country_levels(advisory_fixture)

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


def test_a_region_code_is_either_a_real_subdivision_or_the_sentinel(
    advisory_fixture,
) -> None:
    # Anything else reaches `processing.advisories`, which would either reject
    # it or — worse, if it looked plausible — paint the wrong polygon.
    for advisory in _parse(advisory_fixture):
        if advisory.region_code is None:
            continue
        assert re.fullmatch(r"[A-Z]{2}-[A-Z0-9]{1,3}|regional-L[1-4]", advisory.region_code)
        if advisory.region_code.startswith("regional-"):
            continue
        assert advisory.region_code.startswith(f"{advisory.country_iso2}-")


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


def test_one_country_row_per_country(advisory_fixture) -> None:
    out = [a for a in _parse(advisory_fixture) if a.region_code is None]
    codes = [a.country_iso2 for a in out]
    assert len(codes) == len(set(codes))


def test_lookup_is_insensitive_to_punctuation_and_diacritics() -> None:
    """The feed is not stable about how it spells a name.

    "Côte d'Ivoire" has arrived as `Cote d Ivoire` and with a curly
    apostrophe in successive fetches. Each spelling that misses the table
    costs this source its opinion on that country, silently.
    """
    from wtg_pipeline.sources.advisories.us_state import fold_name

    assert fold_name("Côte d’Ivoire") == fold_name("Cote d Ivoire")
    assert fold_name("COTE D'IVOIRE") == fold_name("Cote d'Ivoire")
    assert fold_name("São Tomé and Príncipe") == fold_name("Sao Tome and Principe")


def test_folding_keeps_the_united_pair_apart() -> None:
    # An earlier cut of the fold stripped "kingdom" and "states" along with
    # the articles, which collapsed these two onto one key — and one of them
    # would then have carried the other's advisory.
    from wtg_pipeline.sources.advisories.us_state import fold_name

    assert fold_name("United Kingdom") != fold_name("United States")


def test_no_two_mapping_names_fold_together_with_different_codes() -> None:
    """A fold collision across *different* countries would be a silent swap."""
    import collections

    from wtg_pipeline.sources.advisories.base import load_mapping
    from wtg_pipeline.sources.advisories.us_state import fold_name

    by_fold = collections.defaultdict(set)
    for name, iso2 in load_mapping("us_state_countries").items():
        by_fold[fold_name(name)].add(iso2)

    conflicts = {k: v for k, v in by_fold.items() if len(v) > 1}
    assert not conflicts, f"names folding together but mapping to different codes: {conflicts}"


def test_the_mapping_covers_the_world() -> None:
    # 69 entries was the old HTML-era table and the reason the US contributed
    # 75 countries to a consensus the other sources gave 200+.
    from wtg_pipeline.sources.advisories.base import load_mapping

    mapping = load_mapping("us_state_countries")
    assert len(mapping) >= 200
    assert all(re.fullmatch(r"[A-Z]{2}", code) for code in mapping.values())


class _Response:
    def __init__(self, text: str) -> None:
        self.text = text

    def raise_for_status(self) -> None:
        return None


class _FlakyClient:
    """Answers `200 []` a few times, then the real payload."""

    def __init__(self, empties: int, payload: str = '[{"Title": "Japan - Level 1: x"}]') -> None:
        self.calls = 0
        self._empties = empties
        self._payload = payload

    def get(self, url: str, **kwargs: object) -> _Response:
        self.calls += 1
        return _Response("[]" if self.calls <= self._empties else self._payload)


def test_an_empty_body_is_retried_not_believed(monkeypatch) -> None:
    """`200 []` is indistinguishable from "no country has an advisory".

    Observed three times in an hour against the live endpoint, with retries
    seconds later returning 214 and 222 records.
    """
    monkeypatch.setattr("wtg_pipeline.sources.advisories.us_state.RETRY_DELAY_S", 0)
    client = _FlakyClient(empties=2)

    raw = USStateScraper(client=client).fetch_raw()

    assert client.calls == 3
    assert "Japan" in raw


def test_persistent_emptiness_raises_rather_than_returning_nothing(monkeypatch) -> None:
    # Raising lets the CLI record the source as failed and keep the previous
    # dump; returning "[]" would write a dump that shadows a good one.
    monkeypatch.setattr("wtg_pipeline.sources.advisories.us_state.RETRY_DELAY_S", 0)
    client = _FlakyClient(empties=99)

    with pytest.raises(RuntimeError, match="empty array"):
        USStateScraper(client=client).fetch_raw()

    assert client.calls == 3


def _regions(advisory_fixture, iso2: str) -> dict[str, int]:
    return {
        a.region_code: a.level
        for a in _parse(advisory_fixture)
        if a.country_iso2 == iso2 and a.region_code is not None
    }


def test_carve_outs_resolve_to_the_departments_named(advisory_fixture) -> None:
    # Colombia's real list item: "Arauca, Cauca (excluding Popayán), and
    # Norte de Santander departments". Popayán is a city, not a department,
    # and "Santander" must not be matched inside "Norte de Santander".
    regions = _regions(advisory_fixture, "CO")

    assert regions["CO-ARA"] == 4
    assert regions["CO-CAU"] == 4
    assert regions["CO-NSA"] == 4
    assert "CO-SAN" not in regions


def test_an_area_that_is_no_subdivision_still_travels_as_a_sentinel(
    advisory_fixture,
) -> None:
    # "The Colombia-Venezuela border region" names no polygon, but the fact
    # that somewhere is level 4 is worth keeping.
    assert _regions(advisory_fixture, "CO")["regional-L4"] == 4


def test_only_the_list_belonging_to_the_heading_is_read(advisory_fixture) -> None:
    """The false positive that made Quetzaltenango "do not travel".

    Guatemala's summary continues past the carve-out list into a section
    saying tourist police patrol "popular areas like Antigua, Lake Atitlán,
    Tikal, Quetzaltenango" — areas named for the opposite reason.
    """
    regions = _regions(advisory_fixture, "GT")

    assert regions["GT-SM"] == 4
    assert regions["GT-HU"] == 4
    assert "GT-QZ" not in regions, "read a list that does not belong to the heading"


def test_entity_encoded_place_names_resolve(advisory_fixture) -> None:
    """`Jun&#237;n` reaches the gazetteer as "jun 237 n" without decoding.

    Peru's carve-out is the VRAEM — Apurímac, Ayacucho, Cusco, Huancavelica
    and Junín — and three of those five carry an accent.
    """
    regions = _regions(advisory_fixture, "PE")

    assert {"PE-APU", "PE-AYA", "PE-CUS", "PE-HUV", "PE-JUN"} <= set(regions)
    assert all(level == 4 for code, level in regions.items() if code.startswith("PE-"))


def test_a_carve_out_no_worse_than_the_country_is_dropped(advisory_fixture) -> None:
    # Afghanistan is level 4 country-wide; nothing inside it can be worse.
    assert _regions(advisory_fixture, "AF") == {}


def test_clean_summary_decodes_entities() -> None:
    assert clean_summary("Jun&#237;n and Apur&#237;mac") == "Junín and Apurímac"
    assert clean_summary("<p>a&nbsp;b</p>") == "a b"
