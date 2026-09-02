"""ERA5 daily-statistics downloader. Never touches the live CDS API.

The request shape is pinned here rather than trusted, because three of its
fields are correctness settings that look like tuning knobs:

* ``frequency`` at anything coarser than ``1_hourly`` can miss the afternoon
  peak, which silently turns "daily maximum" into "some afternoon sample";
* ``daily_statistic`` must be ``daily_sum`` for accumulated variables and
  never for the others;
* ``time_zone`` decides where a day starts, and changing it changes every
  max and min in the product.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from wtg_pipeline.sources import era5_daily


class FakeClient:
    """Records retrievals and writes a placeholder file, like cdsapi does."""

    def __init__(self, fail_on: set[str] | None = None):
        self.calls: list[tuple[str, dict, str]] = []
        self.fail_on = fail_on or set()

    def retrieve(self, name: str, request: dict, target: str):
        self.calls.append((name, request, target))
        stem = Path(target).name
        if any(token in stem for token in self.fail_on):
            raise RuntimeError(f"simulated CDS failure for {stem}")
        Path(target).write_bytes(b"netcdf-ish")
        return object()


def test_seven_series_and_their_statistics():
    stems = {v.stem: v for v in era5_daily.ERA5_DAILY_VARIABLES}
    assert set(stems) == {
        "t2m_max", "t2m_min", "t2m_mean",
        "tp_sum", "si10_mean", "d2m_mean", "ssrd_sum",
    }
    assert stems["t2m_max"].daily_statistic == "daily_maximum"
    assert stems["t2m_min"].daily_statistic == "daily_minimum"

    # daily_sum is only meaningful for accumulated variables, and both of the
    # accumulated ones must use it.
    summed = {s for s, v in stems.items() if v.daily_statistic == "daily_sum"}
    assert summed == {"tp_sum", "ssrd_sum"}


def test_request_pins_the_correctness_settings(tmp_path):
    req = era5_daily.ERA5DailyRequest(
        daily=era5_daily.DAILY_BY_STEM["t2m_max"],
        year=2020,
        month=7,
        target=tmp_path / "x.nc",
    )
    body = req.to_cds_request()

    assert body["frequency"] == "1_hourly", "coarser sampling misses the diurnal peak"
    assert body["time_zone"] == "utc+00:00"
    assert body["daily_statistic"] == "daily_maximum"
    assert body["product_type"] == "reanalysis"
    assert body["variable"] == ["2m_temperature"]
    assert body["year"] == "2020"
    assert body["month"] == ["07"]
    assert len(body["day"]) == 31


def test_plans_one_request_per_month_when_asked(tmp_path):
    plan = era5_daily.plan_requests(
        ["t2m_max", "t2m_min"], [2020, 2021], base_dir=tmp_path, chunk="month"
    )
    assert len(plan) == 2 * 2 * 12

    months = sorted({r.month for r in plan})
    assert months == list(range(1, 13))
    assert all(r.target.parent == tmp_path for r in plan)


def test_plans_one_request_per_year_by_default(tmp_path):
    plan = era5_daily.plan_requests(["t2m_max", "t2m_min"], [2020, 2021], base_dir=tmp_path)
    assert len(plan) == 2 * 2
    assert all(r.month is None for r in plan)
    assert all(r.target.parent == tmp_path for r in plan)


def test_the_full_set_is_seventy_yearly_requests(tmp_path):
    """The default. 70, not 840 — see `plan_requests` for why that matters."""
    plan = era5_daily.plan_requests(
        [v.stem for v in era5_daily.ERA5_DAILY_VARIABLES],
        list(range(2016, 2026)),
        base_dir=tmp_path,
    )
    assert len(plan) == 7 * 10 == 70
    assert all(r.month is None for r in plan)
    # One request, twelve months inside it.
    assert plan[0].to_cds_request()["month"] == list(era5_daily.MONTHS)


def test_month_chunking_is_still_available(tmp_path):
    plan = era5_daily.plan_requests(
        [v.stem for v in era5_daily.ERA5_DAILY_VARIABLES],
        list(range(2016, 2026)),
        base_dir=tmp_path,
        chunk="month",
    )
    assert len(plan) == 7 * 10 * 12 == 840
    assert plan[0].to_cds_request()["month"] == ["01"]


def test_an_unknown_chunk_mode_is_refused(tmp_path):
    with pytest.raises(ValueError, match="chunk must be"):
        era5_daily.plan_requests(["t2m_max"], [2020], base_dir=tmp_path, chunk="week")


def test_year_and_month_files_are_named_apart(tmp_path):
    """Both shapes coexist in one directory, so the names must not collide."""
    year = era5_daily.target_path("t2m_max", 2016, None, base_dir=tmp_path)
    month = era5_daily.target_path("t2m_max", 2016, 1, base_dir=tmp_path)
    assert year.name == "t2m_max_2016.nc"
    assert month.name == "t2m_max_201601.nc"
    assert year != month


def test_year_inputs_prefers_the_whole_year_file(tmp_path):
    """A year file wins over monthly chunks for the same (variable, year)."""
    for m in (1, 2):
        era5_daily.target_path("t2m_max", 2016, m, base_dir=tmp_path).write_bytes(b"x")
    assert len(era5_daily.year_inputs("t2m_max", 2016, base_dir=tmp_path)) == 2

    era5_daily.target_path("t2m_max", 2016, None, base_dir=tmp_path).write_bytes(b"x")
    picked = era5_daily.year_inputs("t2m_max", 2016, base_dir=tmp_path)
    assert [p.name for p in picked] == ["t2m_max_2016.nc"]


def test_year_inputs_returns_monthly_chunks_in_order(tmp_path):
    """The real run left t2m_max as twelve files per year and the rest as one.

    Both have to aggregate as one dataset, so this is the seam that matters.
    """
    for m in (3, 1, 2):
        era5_daily.target_path("tp_sum", 2019, m, base_dir=tmp_path).write_bytes(b"x")
    picked = era5_daily.year_inputs("tp_sum", 2019, base_dir=tmp_path)
    assert [p.name for p in picked] == [
        "tp_sum_201901.nc", "tp_sum_201902.nc", "tp_sum_201903.nc",
    ]


def test_year_inputs_ignores_an_empty_file(tmp_path):
    """A zero-byte file is a failed download, not a month with no weather."""
    era5_daily.target_path("tp_sum", 2019, 1, base_dir=tmp_path).write_bytes(b"x")
    era5_daily.target_path("tp_sum", 2019, 2, base_dir=tmp_path).write_bytes(b"")
    picked = era5_daily.year_inputs("tp_sum", 2019, base_dir=tmp_path)
    assert [p.name for p in picked] == ["tp_sum_201901.nc"]


def test_unknown_series_is_refused(tmp_path):
    with pytest.raises(ValueError, match="unknown daily series"):
        era5_daily.plan_requests(["t2m_p99"], [2020], base_dir=tmp_path)


def test_downloads_and_then_resumes(tmp_path):
    client = FakeClient()
    first = era5_daily.download(
        [2020], ["t2m_max"], client=client, base_dir=tmp_path, chunk="month"
    )

    assert len(first) == 12
    assert len(client.calls) == 12
    assert all(p.exists() for p in first)

    # Second run must be a no-op: the whole download is one long resumable job.
    again = FakeClient()
    second = era5_daily.download(
        [2020], ["t2m_max"], client=again, base_dir=tmp_path, chunk="month"
    )
    assert len(second) == 12
    assert again.calls == []

    forced = FakeClient()
    era5_daily.download(
        [2020], ["t2m_max"], client=forced, base_dir=tmp_path, force=True, chunk="month"
    )
    assert len(forced.calls) == 12


def test_partial_file_is_not_mistaken_for_a_finished_chunk(tmp_path):
    """A chunk counts as done because it exists — so it must land atomically."""
    client = FakeClient(fail_on={"202003"})

    with pytest.raises(RuntimeError, match="simulated CDS failure"):
        era5_daily.download(
            [2020], ["t2m_max"], client=client, base_dir=tmp_path, chunk="month"
        )

    march = era5_daily.target_path("t2m_max", 2020, 3, base_dir=tmp_path)
    assert not march.exists(), "a failed chunk must leave nothing behind"
    assert not list(tmp_path.glob("*.tmp")), "temp file leaked"

    # January and February did land, and a resume picks up from March.
    assert era5_daily.target_path("t2m_max", 2020, 1, base_dir=tmp_path).exists()
    assert era5_daily.target_path("t2m_max", 2020, 2, base_dir=tmp_path).exists()


def test_year_paths_are_in_month_order(tmp_path):
    paths = era5_daily.year_paths("tp_sum", 2022, base_dir=tmp_path)
    assert len(paths) == 12
    assert [p.name for p in paths][:3] == [
        "tp_sum_202201.nc", "tp_sum_202202.nc", "tp_sum_202203.nc",
    ]


def test_parse_year_range():
    assert era5_daily.parse_year_range("2016-2025") == list(range(2016, 2026))
    assert era5_daily.parse_year_range("2020") == [2020]
    with pytest.raises(ValueError):
        era5_daily.parse_year_range("2025-2016")


def test_a_year_request_is_satisfied_by_twelve_monthly_files(tmp_path):
    """The resume seam across the mid-flight chunking change.

    The first real run left 120 complete `t2m_max` monthly files behind. A
    year-chunked resume must treat those as done rather than re-fetch them.
    """
    for m in range(1, 13):
        era5_daily.target_path("t2m_max", 2020, m, base_dir=tmp_path).write_bytes(b"x")

    client = FakeClient()
    era5_daily.download([2020], ["t2m_max"], client=client, base_dir=tmp_path)
    assert client.calls == [], "re-fetched a year that was already complete"


def test_an_incomplete_year_is_still_fetched(tmp_path):
    """Eleven months is not a year — the twelfth would be a hole in the data."""
    for m in range(1, 12):
        era5_daily.target_path("t2m_min", 2020, m, base_dir=tmp_path).write_bytes(b"x")

    client = FakeClient()
    era5_daily.download([2020], ["t2m_min"], client=client, base_dir=tmp_path)
    assert len(client.calls) == 1
    assert era5_daily.target_path("t2m_min", 2020, None, base_dir=tmp_path).exists()
