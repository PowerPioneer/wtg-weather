"""Consolidation of the five governments' advisories into one state.

These tests run the real scrapers over the recorded HTML/JSON fixtures — no
network — so they pin the whole path the weekly cron walks: scrape output →
consolidated JSON → safety index. The tile-side half of the join lives in
`test_advisories_tiles.py`.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from wtg_pipeline.processing.advisories import (
    LEVEL_LABELS,
    SafetyIndex,
    consolidate,
    index_payload,
    latest_source_files,
    load_advisories,
    load_safety_index,
    safety_index,
    to_payload,
    write_json_if_changed,
)
from wtg_pipeline.sources.advisories.australia import AustraliaScraper
from wtg_pipeline.sources.advisories.germany import GermanyScraper
from wtg_pipeline.sources.advisories.us_state import USStateScraper
from wtg_pipeline.sources.advisories.base import Advisory, write_advisories

SCRAPED_AT = datetime(2026, 4, 1, tzinfo=timezone.utc)
LATER = datetime(2026, 4, 8, tzinfo=timezone.utc)


def _scrape_fixtures(advisory_fixture, *, fetched_at: datetime = SCRAPED_AT):
    """The three snapshot sources, parsed exactly as the cron would.

    US State, Australia and Germany between them cover the interesting
    cases: agreement (Afghanistan 4, Japan 1), disagreement (Colombia 3/3/2),
    and a country only one of them lists (Egypt).
    """
    return {
        "us_state": USStateScraper(client=object()).parse(
            advisory_fixture("us_state.json"), fetched_at=fetched_at
        ),
        "australia": AustraliaScraper(client=object()).parse(
            advisory_fixture("australia.json"), fetched_at=fetched_at
        ),
        "germany": GermanyScraper(client=object()).parse(
            advisory_fixture("germany.json"), fetched_at=fetched_at
        ),
    }


def test_consensus_is_the_highest_level_any_government_publishes(advisory_fixture) -> None:
    # The web legend says "Highest of 5 sources"; Colombia is where the
    # sources actually disagree. Germany reads 1 because its position on
    # Colombia is a Teilreisewarnung — a carve-out, not a national level.
    consolidated = consolidate(_scrape_fixtures(advisory_fixture))

    assert consolidated["CO"].level == 3
    assert {s.source_id: s.level for s in consolidated["CO"].sources} == {
        "us_state": 3,
        "australia": 3,
        "germany": 1,
    }
    assert consolidated["CO"].regional_max == 4


def test_unanimous_countries_keep_their_level(advisory_fixture) -> None:
    consolidated = consolidate(_scrape_fixtures(advisory_fixture))

    assert consolidated["AF"].level == 4
    assert consolidated["JP"].level == 1
    assert consolidated["MX"].level == 2


def test_a_country_only_one_government_lists_still_appears(advisory_fixture) -> None:
    # Egypt is in the German feed alone. Requiring a quorum would drop it.
    consolidated = consolidate(_scrape_fixtures(advisory_fixture))

    assert consolidated["EG"].level == 1
    assert [s.source_id for s in consolidated["EG"].sources] == ["germany"]
    # Germany's position on Egypt is a Teilreisewarnung, so the country reads
    # as unwarned with a carve-out — not as a country-wide "reconsider".
    assert consolidated["EG"].regional_max == 4


def test_a_partial_warning_never_becomes_a_countrys_level(advisory_fixture) -> None:
    """Japan end to end, across the two scrapers that used to get it wrong.

    The Netherlands read the first colour in a blob whose carve-outs come
    first, and Germany mapped a Teilreisewarnung to a country-wide 3. Either
    one alone was enough, under `max`, to tell a traveller not to go to Japan.
    """
    consolidated = consolidate(_scrape_fixtures(advisory_fixture))

    assert consolidated["JP"].level == 1
    assert {s.level for s in consolidated["JP"].sources} == {1}
    assert consolidated["JP"].regional_max == 4


def test_every_country_carries_the_ladder_label(advisory_fixture) -> None:
    consolidated = consolidate(_scrape_fixtures(advisory_fixture))
    payload = to_payload(consolidated)

    for country in payload["countries"]:
        assert country["label"] == LEVEL_LABELS[country["level"]]


def test_regional_sentinel_never_raises_the_country_level() -> None:
    """A carve-out describes a part of a country, not the country.

    The scrapers emit `regional-L4` for "somewhere in here is level 4" with
    no way to say where. Folding that into the national level would paint the
    whole of Mexico as Do Not Travel on the strength of four states.
    """
    records = [
        Advisory(
            country_iso2="MX",
            region_code=None,
            level=2,
            summary="Exercise increased caution",
            source_url="https://travel.state.gov/mexico",
            fetched_at=SCRAPED_AT,
        ),
        Advisory(
            country_iso2="MX",
            region_code="regional-L4",
            level=4,
            summary="Do not travel to Colima state",
            source_url="https://travel.state.gov/mexico",
            fetched_at=SCRAPED_AT,
        ),
    ]
    consolidated = consolidate({"us_state": records})

    assert consolidated["MX"].level == 2
    # But the knowledge is not thrown away — the country page can surface it.
    assert consolidated["MX"].regional_max == 4
    # And it never reaches the tiles, because it names no polygon.
    assert safety_index(consolidated).by_region == {}


def test_resolved_iso_3166_2_region_reaches_the_index() -> None:
    # No scraper resolves one yet, but the schema allows it and the join is
    # wired, so a future detail-page pass needs no build change.
    records = [
        Advisory(
            country_iso2="CO",
            region_code=None,
            level=2,
            summary="Exercise increased caution",
            source_url="https://example.gov/co",
            fetched_at=SCRAPED_AT,
        ),
        Advisory(
            country_iso2="CO",
            region_code="CO-ARA",
            level=4,
            summary="Do not travel to Arauca",
            source_url="https://example.gov/co",
            fetched_at=SCRAPED_AT,
        ),
    ]
    index = safety_index(consolidate({"us_state": records}))

    assert index.by_country["CO"] == 2
    assert index.by_region["CO-ARA"] == 4
    assert index.level_for("CO", "CO-ARA") == 4
    assert index.level_for("CO", "CO-BOY") == 2


def test_region_code_from_another_country_is_rejected() -> None:
    # A mis-parsed detail page must not stamp one country's level onto a
    # subdivision of another.
    records = [
        Advisory(
            country_iso2="CO",
            region_code="MX-GRO",
            level=4,
            summary="Mis-parsed",
            source_url="https://example.gov/co",
            fetched_at=SCRAPED_AT,
        ),
    ]
    index = safety_index(consolidate({"us_state": records}))

    assert index.by_region == {}


def test_country_with_only_a_carve_out_gets_no_country_level() -> None:
    """No government said anything country-wide, so we assert nothing.

    Level 1 would be a claim on nobody's authority; absence paints grey,
    which is what "nobody has said" looks like on the map.
    """
    records = [
        Advisory(
            country_iso2="CO",
            region_code="CO-ARA",
            level=4,
            summary="Do not travel to Arauca",
            source_url="https://example.gov/co",
            fetched_at=SCRAPED_AT,
        ),
    ]
    consolidated = consolidate({"us_state": records})

    assert consolidated["CO"].level is None
    assert "CO" not in safety_index(consolidated).by_country


def test_level_for_prefers_the_worse_of_country_and_region() -> None:
    index = SafetyIndex(by_country={"CO": 3}, by_region={"CO-ARA": 2})

    # A subdivision is never safer than the country it is in; a low region
    # level cannot mask a country-wide "reconsider travel".
    assert index.level_for("CO", "CO-ARA") == 3
    assert index.level_for("co", "") == 3
    assert index.level_for("ZZ", "") is None


def test_last_changed_survives_an_unchanged_rescrape(advisory_fixture) -> None:
    """Scraping again is not the advisory changing.

    Without this the country page would print "updated today" every Sunday
    regardless of whether any government moved.
    """
    first = to_payload(consolidate(_scrape_fixtures(advisory_fixture)))
    second = to_payload(
        consolidate(
            _scrape_fixtures(advisory_fixture, fetched_at=LATER), previous=first
        )
    )

    assert second == first


def test_last_changed_moves_when_a_government_moves(advisory_fixture) -> None:
    baseline = to_payload(consolidate(_scrape_fixtures(advisory_fixture)))

    scraped = _scrape_fixtures(advisory_fixture, fetched_at=LATER)
    scraped["germany"] = [
        a.model_copy(update={"level": 4}) if a.country_iso2 == "EG" else a
        for a in scraped["germany"]
    ]
    updated = consolidate(scraped, previous=baseline)

    egypt = {s.source_id: s for s in updated["EG"].sources}["germany"]
    assert egypt.level == 4
    assert egypt.last_changed == LATER
    # Everything else keeps the date it actually changed on.
    japan = {s.source_id: s for s in updated["JP"].sources}["germany"]
    assert japan.last_changed == SCRAPED_AT


def test_reworded_summary_changes_the_detail_but_not_the_levels(advisory_fixture) -> None:
    """The distinction the weekly cron branches on.

    A reworded advisory should reach the API's country page; it should not
    cost every user a re-download of the PMTiles archive.
    """
    scraped = _scrape_fixtures(advisory_fixture)
    baseline = consolidate(scraped)

    reworded = dict(scraped)
    reworded["germany"] = [
        a.model_copy(update={"summary": a.summary + " (updated wording)"})
        if a.country_iso2 == "EG"
        else a
        for a in scraped["germany"]
    ]
    after = consolidate(reworded, previous=to_payload(baseline))

    assert to_payload(after) != to_payload(baseline)
    assert index_payload(safety_index(after)) == index_payload(safety_index(baseline))


def test_whitespace_only_reflow_is_not_a_change(advisory_fixture) -> None:
    scraped = _scrape_fixtures(advisory_fixture)
    baseline = to_payload(consolidate(scraped))

    reflowed = dict(scraped)
    reflowed["germany"] = [
        a.model_copy(update={"summary": a.summary.replace(" ", "  \n ")})
        for a in scraped["germany"]
    ]
    after = to_payload(
        consolidate(reflowed, previous=baseline)
    )

    assert after == baseline


def test_payload_is_deterministic_and_clock_independent(advisory_fixture) -> None:
    # pipeline/CLAUDE.md: re-running a step with the same inputs is a no-op.
    # A `generated_at` read off the wall clock would make every run a change.
    first = to_payload(consolidate(_scrape_fixtures(advisory_fixture)))
    second = to_payload(consolidate(_scrape_fixtures(advisory_fixture)))

    assert json.dumps(first) == json.dumps(second)
    assert first["generated_at"] == "2026-04-01T00:00:00Z"


def test_write_json_if_changed_reports_and_skips(tmp_path: Path) -> None:
    target = tmp_path / "advisories.json"

    assert write_json_if_changed({"a": 1}, target) is True
    stamp = target.stat().st_mtime_ns
    assert write_json_if_changed({"a": 1}, target) is False
    assert target.stat().st_mtime_ns == stamp, "unchanged file must not be rewritten"
    assert write_json_if_changed({"a": 2}, target) is True


def test_latest_dump_per_source_wins(tmp_path: Path) -> None:
    record = Advisory(
        country_iso2="JP",
        region_code=None,
        level=1,
        summary="Normal",
        source_url="https://example.gov/jp",
        fetched_at=SCRAPED_AT,
    )
    write_advisories([record], source_id="us_state", base_dir=tmp_path, timestamp=SCRAPED_AT)
    write_advisories(
        [record.model_copy(update={"level": 3, "fetched_at": LATER})],
        source_id="us_state",
        base_dir=tmp_path,
        timestamp=LATER,
    )

    assert len(list((tmp_path / "us_state").glob("*.json"))) == 2
    assert latest_source_files(tmp_path)["us_state"].name.startswith("2026-04-08")

    loaded = load_advisories(tmp_path)
    assert [a.level for a in loaded["us_state"]] == [3]


def test_index_round_trips_through_disk(tmp_path: Path, advisory_fixture) -> None:
    index = safety_index(consolidate(_scrape_fixtures(advisory_fixture)))
    target = tmp_path / "safety_index.json"
    write_json_if_changed(index_payload(index), target)

    restored = load_safety_index(target)
    assert restored is not None
    assert restored.by_country == index.by_country
    assert restored.by_region == index.by_region


def test_missing_index_is_none_not_an_error(tmp_path: Path) -> None:
    # A climate rebuild must not require a successful scrape.
    assert load_safety_index(tmp_path / "nope.json") is None


@pytest.mark.parametrize("level", [1, 2, 3, 4])
def test_every_ladder_level_has_a_label(level: int) -> None:
    # The web's four legend bins map onto these one-for-one.
    assert LEVEL_LABELS[level]


def test_a_source_listing_a_country_twice_keeps_the_worse_level() -> None:
    records = [
        Advisory(
            country_iso2="TR",
            region_code=None,
            level=1,
            summary="Most of the country",
            source_url="https://example.gov/tr",
            fetched_at=SCRAPED_AT,
        ),
        Advisory(
            country_iso2="TR",
            region_code=None,
            level=3,
            summary="Border provinces",
            source_url="https://example.gov/tr",
            fetched_at=SCRAPED_AT,
        ),
    ]
    consolidated = consolidate({"uk_fcdo": records})

    assert consolidated["TR"].level == 3
    assert len(consolidated["TR"].sources) == 1


def test_fetched_at_gap_does_not_reorder_sources(advisory_fixture) -> None:
    # Source order is alphabetical and stable so the payload diff stays
    # readable and byte-comparison stays meaningful.
    consolidated = consolidate(_scrape_fixtures(advisory_fixture))
    for entry in consolidated.values():
        ids = [s.source_id for s in entry.sources]
        assert ids == sorted(ids)


def test_generated_at_tracks_the_newest_change(advisory_fixture) -> None:
    baseline = to_payload(consolidate(_scrape_fixtures(advisory_fixture)))
    scraped = _scrape_fixtures(advisory_fixture, fetched_at=SCRAPED_AT + timedelta(days=14))
    scraped["australia"] = [
        a.model_copy(update={"level": 4}) if a.country_iso2 == "JP" else a
        for a in scraped["australia"]
    ]
    after = to_payload(consolidate(scraped, previous=baseline))

    assert after["generated_at"] == "2026-04-15T00:00:00Z"


def _dump(tmp_path: Path, source_id: str, when: datetime) -> None:
    write_advisories(
        [
            Advisory(
                country_iso2="JP",
                region_code=None,
                level=1,
                summary="Normal",
                source_url="https://example.gov/jp",
                fetched_at=when,
            )
        ],
        source_id=source_id,
        base_dir=tmp_path,
        timestamp=when,
    )


def test_a_source_falling_behind_the_others_is_reported(tmp_path: Path) -> None:
    """The check whose absence hid a four-month-old US snapshot.

    `latest_source_files` serves the newest dump per source, so a scraper that
    starts failing keeps contributing its last successful result forever — and
    the consensus goes on calling itself six governments.
    """
    from wtg_pipeline.processing.advisories import stale_sources

    fresh = datetime(2026, 8, 14, tzinfo=timezone.utc)
    for source_id in ("australia", "germany", "netherlands"):
        _dump(tmp_path, source_id, fresh)
    _dump(tmp_path, "us_state", datetime(2026, 4, 24, tzinfo=timezone.utc))

    stale = stale_sources(latest_source_files(tmp_path))

    assert list(stale) == ["us_state"]
    assert stale["us_state"] == 112


def test_sources_scraped_together_are_not_stale(tmp_path: Path) -> None:
    from wtg_pipeline.processing.advisories import stale_sources

    fresh = datetime(2026, 8, 14, tzinfo=timezone.utc)
    for source_id in ("australia", "germany", "us_state"):
        _dump(tmp_path, source_id, fresh)

    assert stale_sources(latest_source_files(tmp_path)) == {}


def test_staleness_is_relative_not_absolute(tmp_path: Path) -> None:
    # A pipeline that has not run in a year is not six stale sources; the
    # question is whether one source is falling behind the others.
    from wtg_pipeline.processing.advisories import stale_sources

    old = datetime(2024, 1, 1, tzinfo=timezone.utc)
    for source_id in ("australia", "germany", "us_state"):
        _dump(tmp_path, source_id, old)

    assert stale_sources(latest_source_files(tmp_path)) == {}


def test_a_single_source_cannot_be_behind_anything(tmp_path: Path) -> None:
    from wtg_pipeline.processing.advisories import stale_sources

    _dump(tmp_path, "us_state", datetime(2024, 1, 1, tzinfo=timezone.utc))

    assert stale_sources(latest_source_files(tmp_path)) == {}
