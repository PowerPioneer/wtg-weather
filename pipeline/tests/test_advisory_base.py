from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from wtg_pipeline.sources.advisories import base


def test_advisory_uppercases_iso2() -> None:
    a = base.Advisory(
        country_iso2="pe",
        level=2,
        summary="x",
        source_url="https://example",
        fetched_at=datetime(2026, 4, 1, tzinfo=timezone.utc),
    )
    assert a.country_iso2 == "PE"


def test_advisory_rejects_out_of_range_level() -> None:
    with pytest.raises(ValueError):
        base.Advisory(
            country_iso2="PE",
            level=5,
            summary="x",
            source_url="https://example",
            fetched_at=datetime.now(timezone.utc),
        )


def test_advisory_adds_utc_when_naive() -> None:
    a = base.Advisory(
        country_iso2="PE",
        level=1,
        summary="x",
        source_url="https://example",
        fetched_at=datetime(2026, 4, 1),
    )
    assert a.fetched_at.tzinfo is timezone.utc


def test_advisory_iso2_length_enforced() -> None:
    with pytest.raises(ValueError):
        base.Advisory(
            country_iso2="PER",
            level=1,
            summary="x",
            source_url="https://example",
            fetched_at=datetime.now(timezone.utc),
        )


def test_write_advisories_emits_dated_json(tmp_path: Path) -> None:
    adv = [
        base.Advisory(
            country_iso2="PE",
            level=2,
            summary="caution",
            source_url="https://example",
            fetched_at=datetime(2026, 4, 1, 12, 0, tzinfo=timezone.utc),
        )
    ]
    path = base.write_advisories(
        adv,
        source_id="demo",
        base_dir=tmp_path,
        timestamp=datetime(2026, 4, 1, 12, 0, tzinfo=timezone.utc),
    )
    assert path.parent.name == "demo"
    assert "2026-04-01" in path.name
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert len(payload) == 1
    assert payload[0]["country_iso2"] == "PE"


def test_load_mapping_roundtrip() -> None:
    mapping = base.load_mapping("us_state_countries")
    assert mapping["Japan"] == "JP"
    assert mapping["Afghanistan"] == "AF"
