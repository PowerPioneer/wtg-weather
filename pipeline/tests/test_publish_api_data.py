"""Tests for `publish.api_data` — the bundle the SSR country pages read.

The bundle is built from synthetic percentile frames rather than fixtures on
disk, for the same reason the tile tests are: the frames these exercise carry
raw ERA5 SI units, and the conversion into display units is half of what is
being pinned. The other half is the part with no numbers in it at all — that
the set of published slugs is the set the web will generate pages for, that a
suppressed country still gets a payload, and that a premium variable never
reaches one.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from wtg_pipeline.processing.country_registry import build_registry, slugify
from wtg_pipeline.publish import api_data

pd = pytest.importorskip("pandas")


# ─── synthetic inputs ────────────────────────────────────────────────────


class _Geometry:
    """The two things `representative_latitude` and `.area` need."""

    def __init__(self, latitude: float) -> None:
        self._latitude = latitude

    def representative_point(self):
        return type("P", (), {"y": self._latitude})()


def _percentile_rows(
    polygon_id: str,
    *,
    kelvin: float,
    metres_per_day: float,
    sun_hours: float,
    wind_m_s: float | None = 3.0,
    diurnal_range_k: float = 10.0,
) -> list[dict]:
    """Daily-shaped statistics for one polygon.

    `kelvin` is the 24-hour mean the old fixtures expressed, split into a
    daytime high and an overnight low around it — so a fixture that used to
    say "22 °C" still describes the same place, now with the day/night pair
    the product actually publishes.
    """
    rows: list[dict] = []
    half = diurnal_range_k / 2.0
    variables: list[tuple[str, float]] = [
        ("t2m_max", kelvin + half),
        ("t2m_min", kelvin - half),
        ("tp_sum", metres_per_day),
        ("sun_hours", sun_hours),
    ]
    if wind_m_s is not None:
        variables.append(("si10_mean", wind_m_s))
    for month in range(1, 13):
        for variable, value in variables:
            rows.append(
                {
                    "polygon_id": polygon_id,
                    "variable": variable,
                    "month": month,
                    "mean": value,
                    "p50": value,
                    "p5": value * 0.8,
                    "p95": value * 1.2,
                }
            )
    return rows


class _Row:
    """Stand-in for a GeoDataFrame row as `itertuples` yields it."""

    def __init__(self, **fields: object) -> None:
        for key, value in fields.items():
            setattr(self, key, value)


class _Frame:
    """The narrow slice of a GeoDataFrame `build_payloads` actually touches."""

    def __init__(self, rows: list[_Row], records: list[dict] | None = None) -> None:
        self._rows = rows
        self._records = records or []

    def itertuples(self, index: bool = False):  # noqa: FBT001 - mirrors pandas
        return iter(self._rows)

    def to_crs(self, _crs: str):
        raise RuntimeError("no PROJ in this test; areas are expected to be omitted")


def _country_frame() -> tuple[_Frame, list[dict]]:
    rows = [
        _Row(polygon_id="PER", iso_a2="PE", name="Peru", geometry=_Geometry(-10.0)),
        _Row(polygon_id="ARG", iso_a2="AR", name="Argentina", geometry=_Geometry(-35.0)),
        _Row(polygon_id="ISL", iso_a2="IS", name="Iceland", geometry=_Geometry(65.0)),
    ]
    records = [
        {"NAME_EN": "Peru", "ISO_A2": "PE", "ISO_A2_EH": "PE", "ADM0_A3": "PER",
         "CONTINENT": "South America", "POP_EST": 34_000_000},
        {"NAME_EN": "Argentina", "ISO_A2": "AR", "ISO_A2_EH": "AR", "ADM0_A3": "ARG",
         "CONTINENT": "South America", "POP_EST": 45_000_000},
        {"NAME_EN": "Iceland", "ISO_A2": "IS", "ISO_A2_EH": "IS", "ADM0_A3": "ISL",
         "CONTINENT": "Europe", "POP_EST": 400_000},
    ]
    return _Frame(rows, records), records


def _admin1_frame() -> _Frame:
    return _Frame(
        [
            _Row(polygon_id="PER-1", iso_a2="PE", name="Cusco", geometry=_Geometry(-13.0)),
            _Row(polygon_id="PER-2", iso_a2="PE", name="Loreto", geometry=_Geometry(-4.0)),
            # Argentina is suppressed: it has no country-level percentile row,
            # so these two are the only thing its page can be built from.
            _Row(polygon_id="ARG-1", iso_a2="AR", name="Mendoza", geometry=_Geometry(-33.0)),
            _Row(polygon_id="ARG-2", iso_a2="AR", name="Salta", geometry=_Geometry(-25.0)),
        ]
    )


def _build(monkeypatch: pytest.MonkeyPatch, **overrides):
    country_frame, records = _country_frame()

    # `build_registry` reads plain dicts; the fake frame has no `.to_dict`.
    monkeypatch.setattr(
        api_data, "registry_rows_from_gdf", lambda _gdf: records, raising=True
    )

    country_perc = pd.DataFrame(
        _percentile_rows("PER", kelvin=295.15, metres_per_day=0.001, sun_hours=8.4)
        + _percentile_rows("ISL", kelvin=278.15, metres_per_day=0.003, sun_hours=1.6)
    )
    admin1_perc = pd.DataFrame(
        _percentile_rows("PER-1", kelvin=292.15, metres_per_day=0.0015, sun_hours=7.9)
        + _percentile_rows("PER-2", kelvin=299.15, metres_per_day=0.008, sun_hours=5.2)
        + _percentile_rows("ARG-1", kelvin=290.15, metres_per_day=0.0005, sun_hours=8.1)
        + _percentile_rows("ARG-2", kelvin=294.15, metres_per_day=0.001, sun_hours=7.9)
    )

    kwargs = {
        "country_gdf": country_frame,
        "admin1_gdf": _admin1_frame(),
        "country_percentiles": country_perc,
        "admin1_percentiles": admin1_perc,
        "capitals": {"PER": ("Lima", "America/Lima")},
        "advisories": {},
    }
    kwargs.update(overrides)
    return api_data.build_payloads(**kwargs)  # type: ignore[arg-type]


# ─── the bundle ──────────────────────────────────────────────────────────


def test_payload_carries_the_free_series_in_display_units(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    entries, _skipped = _build(monkeypatch)
    peru = entries["peru"]
    climate = peru["climate"]

    # A 22 °C 24-hour mean with a 10 K diurnal range: 27 °C days, 17 °C
    # nights. 0.001 m/day → 1 mm/day → 31 mm in January.
    assert climate["tMax"][0] == pytest.approx(27.0, abs=0.01)
    assert climate["tMin"][0] == pytest.approx(17.0, abs=0.01)
    assert climate["rDay"][0] == pytest.approx(1.0, abs=0.01)
    assert climate["r"][0] == pytest.approx(31.0, abs=0.1)
    assert 3.0 < climate["s"][0] < 12.0
    assert climate["months"][0] == "Jan"
    # `t` is the headline temperature, and the headline is now the daytime
    # high rather than the 24-hour mean.
    assert climate["t"] == climate["tMax"]
    assert climate["tMin"][0] < climate["tMax"][0]


def test_premium_variables_never_reach_a_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Country pages are static, so the payload is the public HTML.

    Snow, sea-surface temperature, heat index and humidity are the four the
    premium tier sells; the pipeline already keeps them out of `free.pmtiles`
    on the grounds that a tier boundary is a file boundary. Same boundary.
    """
    entries, _skipped = _build(monkeypatch)
    serialised = json.dumps(entries)
    for premium_key in ("snow", "sst", "heat", "hum"):
        assert f'"{premium_key}"' not in serialised


def test_suppressed_country_is_published_from_its_regions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Argentina has no country-level row — `apply_country_rules` drops it.

    WS-5's acceptance criterion names `/argentina` explicitly, so "the map
    suppresses its national colour" must not become "the page 404s".
    """
    entries, skipped = _build(monkeypatch)
    assert skipped == []
    argentina = entries["argentina"]
    assert argentina["climateBasis"] == "admin1-mean"
    # The mean of Mendoza (17 °C) and Salta (21 °C).
    assert argentina["climate"]["t"][0] == pytest.approx(24.0, abs=0.01)
    assert "mosaic of its regions" in argentina["summary"]
    # Peru has a country row of its own and must not be labelled.
    assert "climateBasis" not in entries["peru"]


def test_country_with_no_series_at_all_is_skipped(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    entries, skipped = _build(
        monkeypatch,
        country_percentiles=pd.DataFrame(
            _percentile_rows("PER", kelvin=295.15, metres_per_day=0.001, sun_hours=8.4)
        ),
        admin1_percentiles=pd.DataFrame(
            _percentile_rows("PER-1", kelvin=292.15, metres_per_day=0.0015, sun_hours=7.9)
        ),
    )
    # Iceland lost its country row and has no regions to fall back on. It must
    # drop out of the bundle rather than be published with an empty chart —
    # the index is what `generateStaticParams` reads, and `dynamicParams =
    # false` turns a generated slug with no data into a build-time 404.
    assert "iceland" not in entries
    assert any("Iceland" in name for name in skipped)


def test_regions_carry_their_own_rain_and_sun(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    entries, _skipped = _build(monkeypatch)
    regions = entries["peru"]["regions"]
    assert [r["name"] for r in regions] == ["Cusco", "Loreto"]
    cusco, loreto = regions
    # Loreto is the wet one: 0.008 m/day → 8 mm/day against Cusco's 1.5.
    assert loreto["rl"][0] == pytest.approx(8.0, abs=0.01)
    assert cusco["rl"][0] == pytest.approx(1.5, abs=0.01)
    # ...which is why it scores worse under the default "warm, dry, sunny".
    assert cusco["score"] > loreto["score"]
    assert cusco["slug"] == "cusco"


def test_regions_carry_the_admin1_code_the_tiles_use(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The polygon id travels with the region row.

    A click on the map knows the polygon's `adm1_code` and its name, but not
    the de-duplicated slug this module assigns. Publishing the code is what
    lets the region page resolve the exact polygon that was clicked instead of
    the first region whose name happens to slug the same way.
    """
    entries, _skipped = _build(monkeypatch)
    codes = [r["code"] for r in entries["peru"]["regions"]]
    assert all(codes), "every region row needs the admin-1 polygon id"
    assert len(set(codes)) == len(codes)


def test_region_slugs_are_unique_within_a_country() -> None:
    """Two regions whose names slug identically must not share a URL.

    `findRegion` returns the first match, so a collision makes the second
    region unreachable — a page that exists in the sitemap and renders its
    neighbour's climate.
    """
    slugs = api_data._region_slugs(
        ["Alto Paraná", "Alto Parana", "Cusco"], ["PY-10", "PY-11", "PE-CUS"]
    )
    assert len(set(slugs)) == 3
    assert slugs[0] == "alto-parana"
    assert slugs[1] != slugs[0]


def test_related_countries_prefer_the_same_continent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    entries, _skipped = _build(monkeypatch)
    related = entries["peru"]["related"]
    assert [r["slug"] for r in related]
    assert "peru" not in [r["slug"] for r in related]
    # Every related entry has to be routable — these are internal links on a
    # page with `dynamicParams = false` behind them.
    for row in related:
        assert row["slug"] in entries


def test_capital_and_timezone_are_optional(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    entries, _skipped = _build(monkeypatch)
    assert entries["peru"]["capital"] == "Lima"
    assert entries["peru"]["tz"] == "America/Lima"
    # Iceland has no populated-places row here. Omitted, not invented.
    assert "capital" not in entries["iceland"]
    assert "tz" not in entries["iceland"]
    # And no area either, because the fake frame cannot reproject.
    assert "area" not in entries["iceland"]


def test_generated_prose_reports_the_series_it_was_built_from(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    entries, _skipped = _build(monkeypatch)
    peru = entries["peru"]
    assert "27 °C" in peru["summary"]
    # These fixtures are flat across the year, which is the case that used to
    # produce "from 27 °C in January to 27 °C in January".
    assert "holds near 27 °C all year" in peru["summary"]
    # Guard the degenerate phrasing itself rather than counting month names.
    # A month may legitimately be named once per fact — January is both the
    # wettest month and one of the strongest here — so a bare count also fires
    # on correct prose, which it did once the sunshine model stopped
    # understating how many months clear the preference threshold.
    assert "in January to" not in peru["summary"]
    assert set(peru["monthNotes"]) == set(api_data.MONTH_LABELS)
    assert "27 °C" in peru["monthNotes"]["Jan"]
    assert len(peru["bestMonths"]) == 3
    assert all(0 <= month["score"] <= 100 for month in peru["bestMonths"])


# ─── writing ─────────────────────────────────────────────────────────────


def test_possessive_handles_country_names_ending_in_s() -> None:
    """About twenty of them do, and they are not obscure ones."""
    assert api_data.possessive("Peru") == "Peru's"
    for name in ("United States", "Netherlands", "Philippines", "Maldives", "Bahamas"):
        assert api_data.possessive(name) == f"{name}'"


# ─── writing ─────────────────────────────────────────────────────────────


def test_write_bundle_is_a_no_op_when_nothing_changed(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    entries, _skipped = _build(monkeypatch)
    changed, pruned = api_data.write_bundle(entries, base_dir=tmp_path)
    assert changed == len(entries) + 1  # payloads + index
    assert pruned == 0

    changed, pruned = api_data.write_bundle(entries, base_dir=tmp_path)
    assert (changed, pruned) == (0, 0)


def test_write_bundle_prunes_a_country_that_went_away(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    entries, _skipped = _build(monkeypatch)
    api_data.write_bundle(entries, base_dir=tmp_path)
    entries.pop("iceland")
    _changed, pruned = api_data.write_bundle(entries, base_dir=tmp_path)
    assert pruned == 1
    assert not (api_data.countries_dir(tmp_path) / "iceland.json").exists()


def test_index_lists_exactly_the_payloads_on_disk(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """The index is the web's route manifest, so it cannot over-promise."""
    entries, _skipped = _build(monkeypatch)
    api_data.write_bundle(entries, base_dir=tmp_path)

    index = json.loads(api_data.index_path(tmp_path).read_text(encoding="utf-8"))
    listed = {row["slug"] for row in index["countries"]}
    on_disk = {p.stem for p in api_data.countries_dir(tmp_path).glob("*.json")}
    assert listed == on_disk == set(entries)


def test_slugs_match_the_registry_the_web_generates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """One rule, two consumers.

    `generateStaticParams` reads the index; a slug the two modules disagreed
    about would be a page the API cannot answer for.
    """
    _country_frame_unused, records = _country_frame()
    entries, _skipped = _build(monkeypatch)
    registry = {entry.slug for entry in build_registry(records)}
    assert set(entries) <= registry
    assert slugify("Côte d'Ivoire") == "cote-d-ivoire"


# ─── advisories ──────────────────────────────────────────────────────────


def test_advisory_summary_maps_the_detail_file_onto_the_web_shape() -> None:
    payload = {
        "countries": [
            {
                "iso2": "PE",
                "level": 2,
                "sources": [
                    {
                        "source": "netherlands",
                        "level": 2,
                        "label": "Exercise increased caution",
                        "summary": "…",
                        "url": "https://example.nl/peru",
                        "last_changed": "2026-04-14T00:00:00Z",
                    },
                    {
                        "source": "us_state",
                        "level": 1,
                        "label": "Exercise normal precautions",
                        "summary": "…",
                        "url": "https://example.gov/peru",
                        "last_changed": "2026-04-18T00:00:00Z",
                    },
                ],
                "regional_max": 4,
            }
        ]
    }
    summaries = api_data.advisory_summaries(payload)
    peru = summaries["PE"]
    assert peru["combined"] == {"level": 2, "label": "Exercise increased caution"}
    assert peru["lastUpdated"] == "2026-04-18"
    assert [s["gov"] for s in peru["sources"]] == ["Netherlands", "United States"]
    assert peru["sources"][0]["date"] == "2026-04-14"
    # WS-4 kept the carve-out out of the tiles because it names no polygon.
    # The country page is where it can finally be said out loud.
    assert peru["regionalMax"] == 4
    assert peru["regionalMaxLabel"] == "Do not travel"


def test_advisory_summary_carries_the_checked_date() -> None:
    """The field the web's staleness rule reads.

    `date` is when the government last moved; a stable advisory keeps it for
    years. `checked` is when we last read that government, so it is the only
    one that can distinguish "nothing has changed" from "nothing has run".
    """
    payload = {
        "countries": [
            {
                "iso2": "PE",
                "level": 2,
                "sources": [
                    {
                        "source": "netherlands",
                        "level": 2,
                        "label": "Exercise increased caution",
                        "url": "https://example.nl/peru",
                        "last_changed": "2026-04-14T00:00:00Z",
                        "checked": "2026-08-16T03:11:00Z",
                    }
                ],
            }
        ]
    }
    summaries = api_data.advisory_summaries(payload)

    assert summaries["PE"]["sources"][0]["date"] == "2026-04-14"
    assert summaries["PE"]["sources"][0]["checked"] == "2026-08-16"


def test_advisory_summary_omits_checked_when_the_bundle_predates_it() -> None:
    """An older `advisories.json` must keep publishing.

    The response model would drop an unknown field anyway; the point here is
    that the pipeline does not invent one. A source with no `checked` date is
    a source the web cannot judge the freshness of, and it says so by leaving
    the badge alone rather than guessing.
    """
    payload = {
        "countries": [
            {
                "iso2": "PE",
                "level": 2,
                "sources": [
                    {
                        "source": "us_state",
                        "level": 2,
                        "label": "Exercise increased caution",
                        "url": "https://example.gov/peru",
                        "last_changed": "2026-04-14T00:00:00Z",
                    }
                ],
            }
        ]
    }

    assert "checked" not in api_data.advisory_summaries(payload)["PE"]["sources"][0]


def test_advisory_summary_omits_a_country_with_no_national_level() -> None:
    """A resolved carve-out alone is not a claim about the whole country."""
    payload = {"countries": [{"iso2": "IQ", "level": None, "sources": []}]}
    assert api_data.advisory_summaries(payload) == {}


def test_region_advisory_levels_reads_resolved_carve_outs() -> None:
    from wtg_pipeline.publish.api_data import region_advisory_levels

    payload = {
        "countries": [
            {
                "iso2": "PE",
                "level": 2,
                "regions": [{"code": "PE-AYA", "level": 4}, {"code": "PE-CUS", "level": 4}],
            },
            {"iso2": "FR", "level": 2},
        ]
    }

    assert region_advisory_levels(payload) == {"PE": {"PE-AYA": 4, "PE-CUS": 4}}


def test_a_region_row_carries_a_carve_out_worse_than_its_country() -> None:
    from wtg_pipeline.publish.api_data import _region_advisory

    assert _region_advisory({"PE-AYA": 4}, "PE-AYA", country_level=2) == {
        "advisory": {"level": 4, "label": "Do not travel", "code": "PE-AYA"}
    }


def test_a_carve_out_matching_the_country_level_is_not_repeated() -> None:
    # The country-wide safety panel renders on the region page too, so
    # restating its level as a region-specific warning would be noise.
    from wtg_pipeline.publish.api_data import _region_advisory

    assert _region_advisory({"PE-AYA": 2}, "PE-AYA", country_level=2) == {}
    assert _region_advisory({"PE-AYA": 4}, "PE-LIM", country_level=2) == {}
    assert _region_advisory({}, "", country_level=2) == {}


def test_the_temperature_envelope_is_published(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The band is free, so it belongs in the static payload.

    It was going to be premium. On a statically generated page that would have
    meant an authenticated endpoint and a client-side fetch — for a shape drawn
    behind two lines that are free anyway.
    """
    entries, _skipped = _build(monkeypatch)
    climate = entries["peru"]["climate"]

    assert len(climate["tBandLow"]) == 12
    assert len(climate["tBandHigh"]) == 12

    for i in range(12):
        # The envelope must contain both lines, or it is not an envelope.
        assert climate["tBandLow"][i] <= climate["tMin"][i]
        assert climate["tBandHigh"][i] >= climate["tMax"][i]


def test_the_envelope_edges_come_from_different_series(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Low from the daily *minima*, high from the daily *maxima*.

    Taking both from one series would draw a band around one line rather than
    around the pair, which is the shape the old chart had and the reason it
    looked wrong.
    """
    entries, _skipped = _build(monkeypatch)
    climate = entries["peru"]["climate"]

    # The fixture puts p5 at 0.8x and p95 at 1.2x of each series in Kelvin, so
    # the two edges cannot coincide unless they were read from the same row.
    assert climate["tBandLow"] != climate["tBandHigh"]
    span = climate["tBandHigh"][0] - climate["tBandLow"][0]
    lines = climate["tMax"][0] - climate["tMin"][0]
    assert span > lines, "the envelope must be wider than the gap between the lines"


def test_both_envelope_edges_or_neither(monkeypatch: pytest.MonkeyPatch) -> None:
    """A half-drawn envelope is worse than none."""
    entries, _skipped = _build(monkeypatch)
    for entry in entries.values():
        climate = entry["climate"]
        assert ("tBandLow" in climate) == ("tBandHigh" in climate)
        assert ("wBandLow" in climate) == ("wBandHigh" in climate)
