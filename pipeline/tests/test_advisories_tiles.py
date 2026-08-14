"""The advisory → tile join, end to end from the recorded fixtures.

RC-5: the web's Safety display mode reads a month-less `safety` feature
property that no build step ever emitted, so every polygon painted
missing-grey. These tests walk the whole path the weekly cron walks —
scrape fixtures → `wtg process advisories` → `wtg build geojson` — and assert
the levels that come out the far end.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from wtg_pipeline.processing.advisories import (
    SafetyIndex,
    consolidate,
    safety_index,
)
from wtg_pipeline.sources.advisories.australia import AustraliaScraper
from wtg_pipeline.sources.advisories.base import write_advisories
from wtg_pipeline.sources.advisories.germany import GermanyScraper
from wtg_pipeline.sources.advisories.us_state import USStateScraper
from wtg_pipeline.tiles.build_geojson import BuildInput, build_feature_collection

pd = pytest.importorskip("pandas")

SCRAPED_AT = datetime(2026, 4, 1, tzinfo=timezone.utc)


class _Geom:
    """Minimal stand-in for a shapely geometry (mirrors test_build_geojson)."""

    __geo_interface__ = {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}

    def representative_point(self):
        return self

    @property
    def y(self) -> float:
        return 0.0


def _row(variable: str, month: int, p50: float) -> dict:
    return {"variable": variable, "month": month, "p10": p50 * 0.9, "p50": p50, "p90": p50 * 1.1}


def _build_input(level: str, polygons: list[tuple[str, str, str]]) -> BuildInput:
    """``polygons`` is a list of ``(polygon_id, iso_a2, admin1_code)``."""
    gdf = pd.DataFrame(
        {
            "polygon_id": [pid for pid, _, _ in polygons],
            "iso_a2": [iso for _, iso, _ in polygons],
            "name": [pid for pid, _, _ in polygons],
            "admin1_code": [code for _, _, code in polygons],
            "geometry": [_Geom() for _ in polygons],
        }
    )
    percentiles = pd.DataFrame(
        [
            {"polygon_id": pid, **_row(variable, 1, value)}
            for pid, _, _ in polygons
            for variable, value in (("t2m", 297.15), ("tp", 0.002), ("ssrd", 13_000_000.0))
        ]
    )
    return BuildInput(
        level=level,
        polygons_gdf=gdf,
        id_col="polygon_id",
        iso_a2_col="iso_a2",
        name_col="name",
        admin1_code_col="admin1_code",
        percentiles_df=percentiles,
    )


def _safety_from_fixtures(advisory_fixture) -> SafetyIndex:
    """The three snapshot sources, consolidated exactly as the cron would."""
    by_source = {
        "us_state": USStateScraper(client=object()).parse(
            advisory_fixture("us_state.json"), fetched_at=SCRAPED_AT
        ),
        "australia": AustraliaScraper(client=object()).parse(
            advisory_fixture("australia.json"), fetched_at=SCRAPED_AT
        ),
        "germany": GermanyScraper(client=object()).parse(
            advisory_fixture("germany.json"), fetched_at=SCRAPED_AT
        ),
    }
    return safety_index(consolidate(by_source))


def _by_iso(fc: dict) -> dict[str, dict]:
    return {f["properties"]["iso_a2"]: f["properties"] for f in fc["features"]}


def test_country_features_carry_the_consensus_level(advisory_fixture) -> None:
    safety = _safety_from_fixtures(advisory_fixture)
    fc = build_feature_collection(
        _build_input("country", [("AFG", "AF", ""), ("COL", "CO", ""), ("JPN", "JP", "")]),
        tier="free",
        safety=safety,
    )
    props = _by_iso(fc)

    assert props["AF"]["safety"] == 4
    # Colombia is the disagreement case: US 3, AU 3, DE 2 → highest wins.
    assert props["CO"]["safety"] == 3
    assert props["JP"]["safety"] == 1


def test_safety_is_not_indexed_by_month(advisory_fixture) -> None:
    # `web/src/lib/display-modes.ts` reads the bare `safety` prop, unlike
    # every other mode, which reads `<prop>_<mm>`. An advisory is a statement
    # about now, not about April.
    fc = build_feature_collection(
        _build_input("country", [("AFG", "AF", "")]),
        tier="free",
        safety=_safety_from_fixtures(advisory_fixture),
    )
    props = fc["features"][0]["properties"]

    assert props["safety"] == 4
    assert not any(key.startswith("safety_") for key in props)


def test_a_country_no_government_lists_carries_no_safety_property(advisory_fixture) -> None:
    # The web paints an absent property as missing-grey, which is the
    # truthful rendering of "nobody has published anything".
    fc = build_feature_collection(
        _build_input("country", [("ISL", "IS", "")]),
        tier="free",
        safety=_safety_from_fixtures(advisory_fixture),
    )

    assert "safety" not in fc["features"][0]["properties"]


def test_admin1_inherits_its_country_level(advisory_fixture) -> None:
    # Zooming past the country handover must not lose the advisory colour.
    fc = build_feature_collection(
        _build_input("admin1", [("COL-1", "CO", "CO-ANT"), ("JPN-1", "JP", "JP-13")]),
        tier="free",
        safety=_safety_from_fixtures(advisory_fixture),
    )
    props = _by_iso(fc)

    assert props["CO"]["safety"] == 3
    assert props["JP"]["safety"] == 1


def test_a_resolved_subdivision_overrides_its_country(advisory_fixture) -> None:
    base = _safety_from_fixtures(advisory_fixture)
    safety = SafetyIndex(
        by_country=base.by_country, by_region={**base.by_region, "CO-ARA": 4}
    )
    fc = build_feature_collection(
        _build_input("admin1", [("COL-1", "CO", "CO-ARA"), ("COL-2", "CO", "CO-BOY")]),
        tier="free",
        safety=safety,
    )
    by_id = {f["properties"]["id"]: f["properties"] for f in fc["features"]}

    assert by_id["COL-1"]["safety"] == 4
    assert by_id["COL-2"]["safety"] == 3


def test_admin2_districts_inherit_the_country_level(advisory_fixture) -> None:
    # geoBoundaries ADM2 carries no ISO-3166-2 code, so the country level is
    # all there is — but premium users zoom past 6 and must still see it.
    fc = build_feature_collection(
        _build_input("admin2", [("COL-ADM2-1", "CO", "")]),
        tier="premium",
        safety=_safety_from_fixtures(advisory_fixture),
    )

    assert fc["features"][0]["properties"]["safety"] == 3


def test_both_tiers_emit_safety(advisory_fixture) -> None:
    # Safety is `tier: "free"` in the display-mode catalog, and premium
    # sessions read country/admin-1 from the premium archive (RC-8), so it
    # has to be in both files.
    safety = _safety_from_fixtures(advisory_fixture)
    for tier in ("free", "premium"):
        fc = build_feature_collection(
            _build_input("country", [("AFG", "AF", "")]), tier=tier, safety=safety
        )
        assert fc["features"][0]["properties"]["safety"] == 4, tier


def test_build_without_advisories_still_produces_tiles(advisory_fixture) -> None:
    # A failed scrape degrades one display mode; it must not block the
    # yearly climate rebuild.
    fc = build_feature_collection(_build_input("country", [("AFG", "AF", "")]), tier="free")

    assert len(fc["features"]) == 1
    assert "safety" not in fc["features"][0]["properties"]


def test_runner_writes_both_artifacts_and_reports_change(tmp_path: Path, advisory_fixture) -> None:
    """`wtg process advisories`, minus the CLI wrapper."""
    from wtg_pipeline.pipeline_runner import run_process_advisories

    raw = tmp_path / "raw"
    scraped = {
        "us_state": USStateScraper(client=object()).parse(
            advisory_fixture("us_state.json"), fetched_at=SCRAPED_AT
        ),
        "australia": AustraliaScraper(client=object()).parse(
            advisory_fixture("australia.json"), fetched_at=SCRAPED_AT
        ),
        "germany": GermanyScraper(client=object()).parse(
            advisory_fixture("germany.json"), fetched_at=SCRAPED_AT
        ),
    }
    for source_id, records in scraped.items():
        write_advisories(records, source_id=source_id, base_dir=raw, timestamp=SCRAPED_AT)

    detail = tmp_path / "advisories.json"
    index = tmp_path / "safety_index.json"
    first = run_process_advisories(raw_dir=raw, final_path=detail, index_path=index)

    assert first.detail_changed and first.levels_changed
    assert first.countries >= 5
    payload = json.loads(detail.read_text(encoding="utf-8"))
    assert {c["iso2"] for c in payload["countries"]} >= {"AF", "CO", "JP", "MX"}
    assert json.loads(index.read_text(encoding="utf-8"))["countries"]["AF"] == 4

    # Second run over identical inputs is a no-op (pipeline/CLAUDE.md).
    second = run_process_advisories(raw_dir=raw, final_path=detail, index_path=index)
    assert not second.detail_changed
    assert not second.levels_changed


def test_runner_fails_loudly_with_no_scrape(tmp_path: Path) -> None:
    from wtg_pipeline.pipeline_runner import run_process_advisories

    with pytest.raises(FileNotFoundError, match="download advisories"):
        run_process_advisories(
            raw_dir=tmp_path / "empty",
            final_path=tmp_path / "advisories.json",
            index_path=tmp_path / "safety_index.json",
        )


def test_a_resolved_carve_out_reaches_the_tiles_from_a_real_scrape(
    advisory_fixture,
) -> None:
    """End to end: US summary prose -> ISO-3166-2 -> a painted admin-1 polygon.

    Peru is level 2 country-wide and its VRAEM departments are level 4. Before
    the gazetteer this could only travel as a sentinel, which names no polygon
    — so the map showed the whole country at 2 and the carve-out nowhere.
    """
    safety = _safety_from_fixtures(advisory_fixture)
    assert safety.by_country["PE"] == 2
    assert safety.by_region["PE-AYA"] == 4

    fc = build_feature_collection(
        _build_input(
            "admin1",
            [("PER-1", "PE", "PE-AYA"), ("PER-2", "PE", "PE-LIM")],
        ),
        tier="free",
        safety=safety,
    )
    by_id = {f["properties"]["id"]: f["properties"] for f in fc["features"]}

    assert by_id["PER-1"]["safety"] == 4, "the carve-out department"
    assert by_id["PER-2"]["safety"] == 2, "the rest of the country"
