"""Daily-mean wind speed derived from 6-hourly u/v. Never touches live CDS."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest
import xarray as xr

from wtg_pipeline.sources import era5_daily, era5_wind


def _usable_engine() -> str | None:
    """A NetCDF engine that actually loads here, or None.

    On the owner's Windows machine application control blocks netCDF4's DLL
    and h5py is absent, so the file-based tests skip there and run on the box,
    which is where this code runs.
    """
    for engine in ("netcdf4", "h5netcdf"):
        try:
            xr.Dataset({"x": ("t", [1.0])}).to_netcdf(engine=engine)
            return engine
        except Exception:  # noqa: BLE001 — ImportError, or a blocked DLL
            continue
    return None


ENGINE = _usable_engine()
needs_netcdf = pytest.mark.skipif(ENGINE is None, reason="no usable NetCDF engine")


def _write_uv(path: Path, u: np.ndarray, v: np.ndarray, days: int) -> None:
    """A tiny 6-hourly file in the layout CDS returns (valid_time, lat, lon)."""
    times = pd.date_range("2020-01-01", periods=days * 4, freq="6h")
    ds = xr.Dataset(
        {
            "u10": (("valid_time", "latitude", "longitude"), u.astype(np.float32)),
            "v10": (("valid_time", "latitude", "longitude"), v.astype(np.float32)),
        },
        coords={
            "valid_time": times,
            "latitude": [10.0, 9.75],
            "longitude": [0.0, 0.25, 0.5],
        },
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    ds.to_netcdf(path, engine=ENGINE)


class FakeClient:
    def __init__(self, u: np.ndarray, v: np.ndarray, days: int, fail: bool = False):
        self.u, self.v, self.days, self.fail = u, v, days, fail
        self.calls: list[tuple[str, dict]] = []

    def retrieve(self, name: str, request: dict, target: str):
        self.calls.append((name, request))
        if self.fail:
            raise RuntimeError("simulated CDS failure")
        _write_uv(Path(target), self.u, self.v, self.days)
        return object()


@needs_netcdf
def test_daily_mean_is_of_the_speed_not_of_the_vector(tmp_path):
    """A wind that reverses during the day is windy, not calm.

    u = +5, +5, -5, -5 has a vector mean of zero and a speed of 5 all day.
    """
    shape = (4, 2, 3)
    u = np.stack([np.full(shape[1:], x) for x in (5.0, 5.0, -5.0, -5.0)])
    v = np.zeros(shape)
    raw = tmp_path / "uv.nc"
    _write_uv(raw, u, v, days=1)

    out = era5_wind.derive_daily_mean(raw, tmp_path / "si10_mean_2020.nc")
    ds = xr.open_dataset(out, engine=ENGINE)
    np.testing.assert_allclose(ds["si10"].values, 5.0, rtol=1e-6)
    assert list(ds["si10"].dims) == ["valid_time", "latitude", "longitude"]
    assert ds["valid_time"].values[0] == np.datetime64("2020-01-01")
    ds.close()


@needs_netcdf
def test_mean_of_pythagorean_speeds_per_day(tmp_path):
    rng = np.random.default_rng(1)
    u = rng.normal(size=(8, 2, 3))
    v = rng.normal(size=(8, 2, 3))
    raw = tmp_path / "uv.nc"
    _write_uv(raw, u, v, days=2)

    out = era5_wind.derive_daily_mean(raw, tmp_path / "out.nc")
    got = xr.open_dataset(out, engine=ENGINE)["si10"].values
    speed = np.hypot(u.astype(np.float32), v.astype(np.float32))
    np.testing.assert_allclose(got[0], speed[:4].mean(axis=0), rtol=1e-5)
    np.testing.assert_allclose(got[1], speed[4:].mean(axis=0), rtol=1e-5)


@needs_netcdf
def test_a_short_day_is_refused(tmp_path):
    """Three samples instead of four is a truncated file, not a day."""
    raw = tmp_path / "uv.nc"
    u = np.ones((8, 2, 3))
    _write_uv(raw, u, u, days=2)
    ds = xr.open_dataset(raw, engine=ENGINE).load()
    ds.close()
    ds.isel(valid_time=slice(0, 7)).to_netcdf(tmp_path / "short.nc", engine=ENGINE)

    with pytest.raises(ValueError, match="3 samples"):
        era5_wind.derive_daily_mean(tmp_path / "short.nc", tmp_path / "out.nc")
    assert not (tmp_path / "out.nc").exists()


def test_request_shape():
    body = era5_wind.cds_request(2020)
    assert body["variable"] == [
        "10m_u_component_of_wind", "10m_v_component_of_wind",
    ]
    assert body["time"] == ["00:00", "06:00", "12:00", "18:00"]
    assert body["year"] == ["2020"]
    assert len(body["month"]) == 12


@needs_netcdf
def test_era5_daily_routes_si10_through_the_wind_source(tmp_path):
    """`wtg download era5-daily --series si10_mean` must not ask the daily
    dataset for it — MARS rejects that on every attempt."""
    u = np.ones((4, 2, 3)) * 3.0
    v = np.ones((4, 2, 3)) * 4.0
    client = FakeClient(u, v, days=1)

    paths = era5_daily.download([2020], stems=["si10_mean"], client=client, base_dir=tmp_path)

    assert [name for name, _ in client.calls] == [era5_wind.DATASET]
    assert paths == [tmp_path / "si10_mean_2020.nc"]
    assert era5_daily.have_complete_year("si10_mean", 2020, base_dir=tmp_path)
    # The raw 6-hourly year is deleted once derived: it is ~9 GB at 0.25°.
    assert not era5_wind.raw_path(2020, tmp_path).exists()
    got = xr.open_dataset(paths[0], engine=ENGINE)["si10"].values
    np.testing.assert_allclose(got, 5.0, rtol=1e-6)


@needs_netcdf
def test_a_complete_year_is_not_fetched_again(tmp_path):
    u = np.ones((4, 2, 3))
    client = FakeClient(u, u, days=1)
    era5_wind.download([2020], client=client, base_dir=tmp_path)
    era5_wind.download([2020], client=client, base_dir=tmp_path)
    assert len(client.calls) == 1


@needs_netcdf
def test_a_raw_file_left_by_a_killed_run_is_derived_without_refetching(tmp_path):
    u = np.ones((4, 2, 3))
    _write_uv(era5_wind.raw_path(2020, tmp_path), u, u, days=1)
    client = FakeClient(u, u, days=1, fail=True)

    era5_wind.download([2020], client=client, base_dir=tmp_path)

    assert client.calls == []
    assert era5_daily.have_complete_year("si10_mean", 2020, base_dir=tmp_path)
