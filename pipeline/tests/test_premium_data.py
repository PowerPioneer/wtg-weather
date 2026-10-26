"""Tests for `publish.premium_data` — the premium four, beside the free bundle.

The bundle the static country pages are built from must never carry a premium
number (`test_publish_api_data.py` pins that). These pin the other half: the
premium series *are* published, in their own directory, in display units, and
for the suppressed countries as the mean of their regions.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from wtg_pipeline.publish import api_data, premium_data

pd = pytest.importorskip("pandas")


class _Geometry:
    def __init__(self, latitude: float) -> None:
        self._latitude = latitude

    def representative_point(self):
        return type("P", (), {"y": self._latitude})()


class _Row:
    def __init__(self, **fields: object) -> None:
        for key, value in fields.items():
            setattr(self, key, value)


class _Frame:
    def __init__(self, rows: list[_Row]) -> None:
        self._rows = rows

    def itertuples(self, index: bool = False):  # noqa: FBT001 - mirrors pandas
        return iter(self._rows)


RECORDS = [
    {"NAME_EN": "Peru", "ISO_A2": "PE", "ISO_A2_EH": "PE", "ADM0_A3": "PER",
     "CONTINENT": "South America", "POP_EST": 34_000_000},
    {"NAME_EN": "Argentina", "ISO_A2": "AR", "ISO_A2_EH": "AR", "ADM0_A3": "ARG",
     "CONTINENT": "South America", "POP_EST": 45_000_000},
    {"NAME_EN": "Iceland", "ISO_A2": "IS", "ISO_A2_EH": "IS", "ADM0_A3": "ISL",
     "CONTINENT": "Europe", "POP_EST": 400_000},
]


def _rows(polygon_id: str, *, snow_m: float | None, sst_k: float | None, t_k: float, dew_k: float) -> list[dict]:
    """Monthly-shaped premium rows (p10/p50/p90) plus the daily-shaped inputs."""
    rows: list[dict] = []
    for month in range(1, 13):
        monthly = []
        if snow_m is not None:
            monthly.append(("sd", snow_m))
        if sst_k is not None:
            monthly.append(("sst", sst_k))
        for variable, value in monthly:
            rows.append({"polygon_id": polygon_id, "variable": variable, "month": month,
                         "p10": value * 0.5, "p50": value, "p90": value * 1.5})
        for variable, value in (("t2m_mean", t_k), ("d2m_mean", dew_k), ("t2m_max", t_k + 5)):
            rows.append({"polygon_id": polygon_id, "variable": variable, "month": month,
                         "mean": value, "p50": value, "p5": value - 3, "p95": value + 3})
    return rows


def _build(monkeypatch: pytest.MonkeyPatch, published=("peru", "argentina", "iceland")):
    monkeypatch.setattr(premium_data, "registry_rows_from_gdf", lambda _gdf: RECORDS)
    country_gdf = _Frame([
        _Row(polygon_id="PER", geometry=_Geometry(-10.0)),
        _Row(polygon_id="ISL", geometry=_Geometry(65.0)),
    ])
    admin1_gdf = _Frame([
        _Row(polygon_id="ARG-1", iso_a2="AR", geometry=_Geometry(-33.0)),
        _Row(polygon_id="ARG-2", iso_a2="AR", geometry=_Geometry(-25.0)),
    ])
    country = pd.DataFrame(
        _rows("PER", snow_m=0.0, sst_k=293.15, t_k=295.15, dew_k=288.15)
        # Iceland's row carries no premium inputs at all.
        + [{"polygon_id": "ISL", "variable": "tp_sum", "month": m, "mean": 0.003, "p50": 0.003}
           for m in range(1, 13)]
    )
    admin1 = pd.DataFrame(
        _rows("ARG-1", snow_m=0.2, sst_k=None, t_k=285.15, dew_k=278.15)
        + _rows("ARG-2", snow_m=0.4, sst_k=None, t_k=289.15, dew_k=280.15)
    )
    return premium_data.build_premium_payloads(
        country_gdf=country_gdf,
        admin1_gdf=admin1_gdf,
        country_percentiles=country,
        admin1_percentiles=admin1,
        published=published,
    )


def test_the_premium_four_are_published_in_display_units(monkeypatch: pytest.MonkeyPatch) -> None:
    peru = _build(monkeypatch)["peru"]
    assert peru["slug"] == "peru"
    assert peru["sst"][0] == pytest.approx(20.0, abs=0.01)  # 293.15 K
    assert peru["snow"][0] == pytest.approx(0.0)
    assert 0 < peru["humidity"][0] <= 100
    # The heat index is built on the daily maximum, so it is above the mean.
    assert peru["heat"][0] > 22.0
    assert len(peru["humidity"]) == 12


def test_envelopes_come_in_pairs(monkeypatch: pytest.MonkeyPatch) -> None:
    peru = _build(monkeypatch)["peru"]
    assert peru["sstBandLow"][0] < peru["sst"][0] < peru["sstBandHigh"][0]
    # Humidity and heat have no envelope in the tiles, so none here either.
    assert "humidityBandLow" not in peru and "heatBandHigh" not in peru


def test_a_suppressed_country_gets_the_mean_of_its_regions(monkeypatch: pytest.MonkeyPatch) -> None:
    argentina = _build(monkeypatch)["argentina"]
    # 0.2 m and 0.4 m of snow → 20 cm and 40 cm → a 30 cm mean.
    assert argentina["snow"][0] == pytest.approx(30.0, abs=0.01)
    # Neither region has a sea temperature, so the mean has none either.
    assert "sst" not in argentina


def test_a_country_with_no_premium_series_gets_no_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    assert "iceland" not in _build(monkeypatch)


def test_only_published_countries_get_a_premium_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    """A premium file for a country with no page would be served by nothing."""
    assert set(_build(monkeypatch, published=("peru",))) == {"peru"}


def test_written_beside_the_free_bundle_never_inside_it(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    payloads = _build(monkeypatch)
    (tmp_path / "api" / "premium").mkdir(parents=True)
    (tmp_path / "api" / "premium" / "atlantis.json").write_text("{}", encoding="utf-8")

    changed, pruned = premium_data.write_premium_bundle(payloads, base_dir=tmp_path)

    assert changed == len(payloads) and pruned == 1
    written = json.loads((tmp_path / "api" / "premium" / "peru.json").read_text(encoding="utf-8"))
    assert written["sst"] == payloads["peru"]["sst"]
    # The static pages read `countries/`; nothing premium may land there.
    assert not list(api_data.countries_dir(tmp_path).glob("*.json"))
    # And a re-run with nothing changed writes nothing.
    assert premium_data.write_premium_bundle(payloads, base_dir=tmp_path) == (0, 0)
