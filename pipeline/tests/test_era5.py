from __future__ import annotations

from pathlib import Path

import pytest

from wtg_pipeline.sources import era5


class _FakeCDS:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict, str]] = []

    def retrieve(self, name: str, request: dict, target: str) -> object:
        Path(target).parent.mkdir(parents=True, exist_ok=True)
        Path(target).write_bytes(b"NETCDF-MOCK")
        self.calls.append((name, dict(request), target))
        return object()


def test_parse_year_range_single() -> None:
    assert era5.parse_year_range("2020") == [2020]


def test_parse_year_range_span() -> None:
    assert era5.parse_year_range("2016-2018") == [2016, 2017, 2018]


def test_parse_year_range_rejects_reversed() -> None:
    with pytest.raises(ValueError):
        era5.parse_year_range("2025-2016")


def test_plan_requests_cartesian(tmp_path: Path) -> None:
    plan = era5.plan_requests(
        ["2m_temperature", "total_precipitation"],
        [2020, 2021],
        base_dir=tmp_path,
    )
    assert len(plan) == 4
    assert {r.variable for r in plan} == {"2m_temperature", "total_precipitation"}
    assert {r.year for r in plan} == {2020, 2021}


def test_plan_requests_rejects_unknown_variable(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        era5.plan_requests(["not_a_variable"], [2020], base_dir=tmp_path)


def test_download_writes_and_is_idempotent(tmp_path: Path) -> None:
    client = _FakeCDS()
    first = era5.download(
        [2020],
        variables=["2m_temperature", "total_precipitation"],
        client=client,
        base_dir=tmp_path,
    )
    assert len(first) == 2
    assert len(client.calls) == 2
    for p in first:
        assert p.exists() and p.stat().st_size > 0

    # Second call: all cache hits, no retrieve invocation.
    client2 = _FakeCDS()
    second = era5.download(
        [2020],
        variables=["2m_temperature", "total_precipitation"],
        client=client2,
        base_dir=tmp_path,
    )
    assert second == first
    assert client2.calls == []


def test_download_force_refetches(tmp_path: Path) -> None:
    era5.download([2020], variables=["2m_temperature"], client=_FakeCDS(), base_dir=tmp_path)
    client = _FakeCDS()
    era5.download(
        [2020], variables=["2m_temperature"], client=client, base_dir=tmp_path, force=True
    )
    assert len(client.calls) == 1


def test_cds_request_shape(tmp_path: Path) -> None:
    req = era5.ERA5Request(
        variable="surface_solar_radiation_downwards",
        year=2024,
        target=tmp_path / "ssrd_2024.nc",
    ).to_cds_request()
    assert req["product_type"] == "monthly_averaged_reanalysis"
    assert req["variable"] == "surface_solar_radiation_downwards"
    assert req["year"] == "2024"
    assert req["month"] == [f"{m:02d}" for m in range(1, 13)]
    assert req["format"] == "netcdf"


def test_nine_variables_registered() -> None:
    # The plan locks the nine vars listed in section 5 phase 2 of REBUILD_PLAN.
    assert set(era5.ERA5_VARIABLES) == {
        "2m_temperature",
        "total_precipitation",
        "surface_solar_radiation_downwards",
        "10m_u_component_of_wind",
        "10m_v_component_of_wind",
        "10m_wind_speed",
        "snow_depth",
        "sea_surface_temperature",
        "2m_dewpoint_temperature",
    }


def test_fetch_range_expands(tmp_path: Path) -> None:
    client = _FakeCDS()
    paths = era5.fetch(
        "2020-2022",
        variables=["2m_temperature"],
        client=client,
        base_dir=tmp_path,
    )
    assert len(paths) == 3
    assert len(client.calls) == 3
