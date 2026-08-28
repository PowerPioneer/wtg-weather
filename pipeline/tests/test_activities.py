"""Tests for the curated activity dataset and the prose built from it.

Two jobs here, and the second is the important one:

1. the schema loads, and refuses data that would put an unsupported claim on a
   page (no source, a status change with no reason);
2. every shipped file is *internally* honest — the statuses mean what
   ``activities.py`` says they mean, and the sentences the pipeline generates
   from them cannot contradict the rows underneath.

What these tests cannot check is whether a curated fact is *true*; that is what
the ``sources`` are for, and why the loader will not accept an activity without
them.
"""

from __future__ import annotations

import json

import pytest

from wtg_pipeline.processing import activities as A


# ─── schema ──────────────────────────────────────────────────────────────


def _activity(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "id": "thing",
        "name": "A Thing",
        "status": "open",
        "sources": [{"url": "https://example.test/a", "checked": "2026-08-28"}],
    }
    base.update(overrides)
    return base


def _write(tmp_path, iso2: str, activities: list[dict[str, object]]):
    path = tmp_path / f"{iso2.lower()}.json"
    path.write_text(
        json.dumps({"iso2": iso2, "reviewed": "2026-08-28", "activities": activities}),
        encoding="utf-8",
    )
    return path


def test_loads_a_minimal_activity(tmp_path):
    country = A.load_country(_write(tmp_path, "ZZ", [_activity()]))
    assert country.iso2 == "ZZ"
    assert [a.name for a in country.activities] == ["A Thing"]
    assert country.activities[0].year_round is True


def test_an_uncited_activity_is_refused(tmp_path):
    """The citation is the whole anti-hallucination mechanism."""
    with pytest.raises(ValueError, match="no sources"):
        A.load_country(_write(tmp_path, "ZZ", [_activity(sources=[])]))


def test_a_window_without_a_reason_is_refused(tmp_path):
    """A status a reader cannot check is the thing this dataset exists to avoid."""
    with pytest.raises(ValueError, match="must give a 'reason'"):
        A.load_country(
            _write(tmp_path, "ZZ", [_activity(windows=[{"status": "closed", "months": [2]}])])
        )


def test_an_unknown_status_is_refused(tmp_path):
    with pytest.raises(ValueError, match="is not one of"):
        A.load_country(_write(tmp_path, "ZZ", [_activity(status="probably-fine")]))


def test_a_month_outside_1_12_is_refused(tmp_path):
    with pytest.raises(ValueError, match="is not 1-12"):
        A.load_country(
            _write(
                tmp_path,
                "ZZ",
                [_activity(windows=[{"status": "closed", "months": [13], "reason": "x"}])],
            )
        )


def test_a_malformed_file_costs_only_itself(tmp_path, caplog):
    """One bad hand-edit must not strip every other country of its section."""
    _write(tmp_path, "AA", [_activity()])
    (tmp_path / "bb.json").write_text("{ not json", encoding="utf-8")
    A.load_all.cache_clear()
    loaded = A.load_all(tmp_path)
    A.load_all.cache_clear()
    assert set(loaded) == {"AA"}
    assert "ACTIVITY_INVALID" in caplog.text


def test_missing_directory_is_not_an_error(tmp_path):
    A.load_all.cache_clear()
    assert A.load_all(tmp_path / "nope") == {}
    A.load_all.cache_clear()


# ─── month resolution ────────────────────────────────────────────────────


def test_the_first_matching_window_wins(tmp_path):
    country = A.load_country(
        _write(
            tmp_path,
            "ZZ",
            [
                _activity(
                    windows=[
                        {"status": "closed", "months": [2], "reason": "carve-out"},
                        {"status": "best", "months": [1, 2, 3], "reason": "general case"},
                    ]
                )
            ],
        )
    )
    activity = country.activities[0]
    assert activity.month_status(2) == ("closed", "carve-out")
    assert activity.month_status(3) == ("best", "general case")


def test_a_month_no_window_names_falls_back_to_the_default(tmp_path):
    country = A.load_country(
        _write(
            tmp_path,
            "ZZ",
            [
                _activity(
                    note="the usual state",
                    windows=[{"status": "best", "months": [7], "reason": "peak"}],
                )
            ],
        )
    )
    assert country.activities[0].month_status(1) == ("open", "the usual state")


# ─── `not-on` is not `closed` ────────────────────────────────────────────
#
# The distinction this dataset would be useless without. A festival held on one
# date is not a country "closing something" for the other eleven months.


def _festival_country(tmp_path):
    return A.load_country(
        _write(
            tmp_path,
            "ZZ",
            [
                _activity(id="fest", name="A Festival", status="not-on", kind="festival",
                          windows=[{"status": "best", "months": [6], "reason": "held on 24 June"}]),
                _activity(id="site", name="A Site"),
            ],
        )
    )


def test_a_dated_event_never_counts_as_a_closure(tmp_path):
    assert A.closure_months(_festival_country(tmp_path).activities) == set()


def test_a_dated_event_is_not_listed_outside_its_months(tmp_path):
    country = _festival_country(tmp_path)
    assert [r["name"] for r in A.month_rows(country.activities, 2)] == ["A Site"]
    assert {r["name"] for r in A.month_rows(country.activities, 6)} == {"A Festival", "A Site"}


def test_a_dated_event_does_not_dilute_the_year_lede_total(tmp_path):
    """"1 of 2 run all year" would be counting a festival as a thing that shut."""
    lede = A.build_year_lede(_festival_country(tmp_path).activities, country_name="Zedland")
    assert "1 of 1" not in lede  # the festival is excluded from both halves
    assert "does not" not in lede
    assert "Nothing on this list closes for the season in Zedland" in lede


# ─── ledes ───────────────────────────────────────────────────────────────


def test_a_lone_closure_month_gets_the_only_month_lede(tmp_path):
    country = A.load_country(
        _write(
            tmp_path,
            "ZZ",
            [_activity(windows=[{"status": "closed", "months": [2], "reason": "maintenance"}])],
        )
    )
    assert (
        A.build_month_lede(country.activities, 2, country_name="Zedland")
        == "February is the only month Zedland closes anything — 1 thing below."
    )
    assert "closes anything" in A.build_year_lede(country.activities, country_name="Zedland")


def test_the_lede_leads_with_peaks_when_they_outnumber_the_caveats(tmp_path):
    """A month with five peaks and one caveat is a good month, and must read as one."""
    country = A.load_country(
        _write(
            tmp_path,
            "ZZ",
            [
                _activity(id=f"a{i}", name=f"Thing {i}",
                          windows=[{"status": "best", "months": [6], "reason": "peak"}])
                for i in range(3)
            ]
            + [
                _activity(id="z", name="Thing Z",
                          windows=[{"status": "limited", "months": [6], "reason": "cloud"}])
            ],
        )
    )
    lede = A.build_month_lede(country.activities, 6, country_name="Zedland")
    assert lede.index("at their best") < lede.index("weather-dependent")


def test_the_lede_counts_only_what_the_rows_show(tmp_path):
    """The sentence and the list must never disagree about how many of anything."""
    country = _festival_country(tmp_path)
    for month in range(1, 13):
        rows = A.month_rows(country.activities, month)
        lede = A.build_month_lede(country.activities, month, country_name="Zedland")
        for status, word in (("closed", "closes"), ("limited", "weather-dependent")):
            if not any(r["status"] == status for r in rows):
                assert word not in lede, f"month {month}: lede claims {status!r} with no such row"


def test_no_activities_means_no_prose(tmp_path):
    empty = A.load_country(_write(tmp_path, "ZZ", []))
    assert A.build_month_lede(empty.activities, 1, country_name="Zedland") == ""
    assert A.build_year_lede(empty.activities, country_name="Zedland") == ""


# ─── region scoping ──────────────────────────────────────────────────────


def test_an_unscoped_activity_belongs_to_no_region(tmp_path):
    """Otherwise every subdivision claims everything the country has."""
    country = A.load_country(
        _write(tmp_path, "ZZ", [_activity(), _activity(id="local", regions=["ZZ-A"])])
    )
    assert [a.id for a in country.for_region(["ZZ-A"])] == ["local"]
    assert country.for_region(["ZZ-B"]) == ()
    assert country.for_region([]) == ()


# ─── the shipped files ───────────────────────────────────────────────────


def _shipped():
    A.load_all.cache_clear()
    loaded = A.load_all()
    A.load_all.cache_clear()
    return loaded


def test_every_shipped_file_parses():
    """`load_all` swallows a broken file by design; this is what notices."""
    for path in sorted(A.ACTIVITY_DATA_DIR.glob("*.json")):
        A.load_country(path)  # raises on anything malformed


def test_shipped_files_are_named_for_the_country_they_declare():
    for path in sorted(A.ACTIVITY_DATA_DIR.glob("*.json")):
        assert A.load_country(path).iso2 == path.stem.upper()


def test_shipped_activity_ids_are_unique_within_a_country():
    """The web keys a month row back to its item by id."""
    for iso2, country in _shipped().items():
        ids = [a.id for a in country.activities]
        assert len(ids) == len(set(ids)), f"{iso2}: duplicate activity id"


def test_shipped_region_codes_exist_in_the_gazetteer():
    """A code naming no polygon silently shows the activity on no region page."""
    from wtg_pipeline.processing.subdivisions import gazetteer

    known = {code for country in gazetteer().values() for code in country.values()}
    if not known:  # gazetteer is generated; absent in a bare checkout
        pytest.skip("subdivisions gazetteer not present")
    for iso2, country in _shipped().items():
        for activity in country.activities:
            for code in activity.regions:
                assert code in known, f"{iso2}/{activity.id}: unknown region code {code}"
                assert code.startswith(f"{iso2}-"), (
                    f"{iso2}/{activity.id}: region {code} belongs to another country"
                )


def test_peru_says_the_inca_trail_closes_and_machu_picchu_does_not():
    """The claim the previous version of this site got backwards.

    Machu Picchu is open every day of the year. The classic Inca Trail closes
    every February. Pinned because it is the exact shape of error the whole
    dataset exists to prevent, and because it is the one a plausible-sounding
    generator reproduces.
    """
    peru = _shipped()["PE"]
    by_id = {a.id: a for a in peru.activities}
    assert by_id["machu-picchu"].year_round is True
    assert all(
        by_id["machu-picchu"].month_status(m)[0] != "closed" for m in range(1, 13)
    )
    assert by_id["inca-trail"].month_status(2)[0] == "closed"
    assert A.closure_months(peru.activities) == {2}


# ─── year-lede shapes ────────────────────────────────────────────────────
#
# Each of these was a sentence the first draft got wrong against real curated
# data, which is why they are pinned individually.


def test_month_runs_are_compressed_and_wrap_the_year():
    assert A.format_month_run([2]) == "February"
    assert A.format_month_run([5, 6, 7, 8, 9]) == "May–September"
    # Japan's Fuji off-season. Spelled out it is nine month names.
    assert A.format_month_run([10, 11, 12, 1, 2, 3, 4, 5, 6]) == "October–June"
    assert A.format_month_run([2, 6, 7]) == "February and June–July"
    assert A.format_month_run(range(1, 13)) == "every month of the year"
    assert A.format_month_run([]) == ""


def test_a_wholly_seasonal_country_does_not_list_twelve_months(tmp_path):
    """Iceland: something is out of season in every month. Naming them all is the joke version."""
    country = A.load_country(
        _write(
            tmp_path,
            "ZZ",
            [
                _activity(id="summer", name="Summer thing", status="closed",
                          windows=[{"status": "best", "months": [6, 7, 8], "reason": "warm"}]),
                _activity(id="winter", name="Winter thing", status="closed",
                          windows=[{"status": "best", "months": [12, 1, 2], "reason": "cold"}]),
            ],
        )
    )
    lede = A.build_year_lede(country.activities, country_name="Zedland")
    assert "January, February" not in lede
    assert "seasonal end to end" in lede


def test_a_country_of_only_dated_events_still_gets_a_sentence(tmp_path):
    """Tanzania's list is two migration windows. "0 of 0 run all year" is arithmetic, not prose."""
    country = A.load_country(
        _write(
            tmp_path,
            "ZZ",
            [
                _activity(id="a", name="A", status="not-on",
                          windows=[{"status": "best", "months": [1], "reason": "then"}]),
                _activity(id="b", name="B", status="not-on",
                          windows=[{"status": "best", "months": [7], "reason": "then"}]),
            ],
        )
    )
    lede = A.build_year_lede(country.activities, country_name="Zedland")
    assert lede
    assert "2 things, each with its own window" in lede


def test_the_year_lede_never_says_nought_of_one(tmp_path):
    """"0 of 1 things below run all year" — wrong number, wrong verb, wrong framing."""
    country = A.load_country(
        _write(
            tmp_path,
            "ZZ",
            [_activity(windows=[{"status": "closed", "months": [1, 2], "reason": "snow"}])],
        )
    )
    lede = A.build_year_lede(country.activities, country_name="Zedland")
    assert "0 of" not in lede
    assert "1 of 1" not in lede
    assert "nothing below runs the whole year" in lede


def test_every_shipped_country_produces_a_lede_for_every_month():
    """A blank sentence above a populated list is a rendering hole."""
    for iso2, country in _shipped().items():
        assert A.build_year_lede(country.activities, country_name=iso2), f"{iso2}: no year lede"
        for month in range(1, 13):
            rows = A.month_rows(country.activities, month)
            lede = A.build_month_lede(country.activities, month, country_name=iso2)
            assert bool(lede) == bool(rows), f"{iso2}/{month}: lede and rows disagree on emptiness"


def test_every_shipped_country_keeps_its_lede_counts_honest():
    """The invariant that matters, across all shipped data rather than a fixture."""
    for iso2, country in _shipped().items():
        for month in range(1, 13):
            rows = A.month_rows(country.activities, month)
            lede = A.build_month_lede(country.activities, month, country_name=iso2)
            if not any(r["status"] == "closed" for r in rows):
                assert "closes" not in lede, f"{iso2}/{month}: claims a closure with no closed row"
            if not any(r["status"] == "limited" for r in rows):
                assert "weather-dependent" not in lede, f"{iso2}/{month}: claims a caveat with none"


def test_every_shipped_file_names_a_country_the_web_can_route_to():
    """A file for a code no polygon carries is a section that never renders.

    Checked against `countries.generated.ts` — the same admin-0 vintage the
    tiles are built from, and what turns an `iso_a2` into a slug and a page.
    """
    import re
    from pathlib import Path

    registry = Path(__file__).resolve().parents[2] / "web" / "src" / "lib" / "countries.generated.ts"
    if not registry.exists():
        pytest.skip("web country registry not present")
    known = set(re.findall(r'iso2: "([A-Z]{2})"', registry.read_text(encoding="utf-8")))
    unknown = sorted({p.stem.upper() for p in A.ACTIVITY_DATA_DIR.glob("*.json")} - known)
    assert not unknown, f"curated countries with no routable polygon: {unknown}"
