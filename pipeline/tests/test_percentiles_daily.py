"""Within-month statistics from daily aggregates.

The band the site used to shade was p10/p90 across ten annual means —
interannual variability, which is 2-4 °C wide because averaging over a month
destroys the variance, and which was being printed as if it were a daily high
and low. These tests pin the replacement: percentiles over days pooled across
the whole window, plus the two threshold counts that cannot be recovered from
percentiles after the fact.
"""

from __future__ import annotations

import json

import pytest

np = pytest.importorskip("numpy")
pd = pytest.importorskip("pandas")
pytest.importorskip("pyarrow")

from wtg_pipeline.processing.percentiles import (  # noqa: E402
    DAILY_COLUMNS,
    build_percentiles,
    compute_daily_statistics,
    latitudes_path,
    load_latitudes,
    percentiles_path,
)
from wtg_pipeline.processing.sunshine import (  # noqa: E402
    SUNNY_DAY_FRACTION,
    day_length_hours,
    extraterrestrial_daily_j_m2,
)

DAYS_IN_JAN = 31


def _daily_rows(
    variable: str,
    values_by_year: dict[int, list[float]],
    *,
    polygon_id: str = "p1",
    month: int = 1,
) -> pd.DataFrame:
    rows = []
    for year, values in values_by_year.items():
        for day, value in enumerate(values, start=1):
            rows.append(
                {
                    "polygon_id": polygon_id,
                    "iso_a2": "PE",
                    "admin1_code": "",
                    "year": year,
                    "month": month,
                    "day": day,
                    "variable": variable,
                    "value": value,
                }
            )
    return pd.DataFrame(rows)


# ── Shape and semantics ──────────────────────────────────────────────


def test_percentiles_are_over_pooled_days_not_annual_means() -> None:
    """The whole point of the change.

    Ten years of a month whose daily values sweep 10..40 have an interannual
    spread of nothing at all — every year's mean is identical — while the
    day-to-day spread is the thing a traveller feels. p5/p95 must see the
    latter.
    """
    sweep = list(np.linspace(10.0, 40.0, DAYS_IN_JAN))
    frame = _daily_rows("t2m_max", {year: sweep for year in range(2016, 2026)})

    stats = compute_daily_statistics(frame, variable="t2m_max")
    row = stats.iloc[0]

    assert row["n_days"] == DAYS_IN_JAN * 10
    assert row["n_years"] == 10
    assert row["mean"] == pytest.approx(25.0, abs=0.01)
    # Every annual mean is 25.0, so an interannual band would be zero-wide.
    assert row["p95"] - row["p5"] > 20.0


def test_emits_the_documented_columns() -> None:
    frame = _daily_rows("t2m_min", {2020: [5.0] * DAYS_IN_JAN})
    stats = compute_daily_statistics(frame, variable="t2m_min")
    assert list(stats.columns) == list(DAILY_COLUMNS)
    assert set(stats["variable"]) == {"t2m_min"}


def test_monthly_aggregate_is_refused_not_silently_averaged() -> None:
    """A missing `day` column means someone passed the wrong aggregate."""
    frame = _daily_rows("t2m_max", {2020: [20.0] * DAYS_IN_JAN}).drop(columns=["day"])
    with pytest.raises(ValueError, match="no `day` column"):
        compute_daily_statistics(frame, variable="t2m_max")


def test_nan_days_are_dropped_from_the_sample() -> None:
    values = [20.0] * DAYS_IN_JAN
    values[3] = float("nan")
    values[9] = float("nan")
    stats = compute_daily_statistics(
        _daily_rows("t2m_max", {2020: values}), variable="t2m_max"
    )
    assert stats.iloc[0]["n_days"] == DAYS_IN_JAN - 2
    assert stats.iloc[0]["mean"] == pytest.approx(20.0)


# ── Wet days ─────────────────────────────────────────────────────────


def test_wet_days_counts_the_wmo_threshold() -> None:
    """1.0 mm, and ERA5 ships metres — so the threshold is 0.001."""
    # 8 wet days (2 mm), 23 dry (0.5 mm — rain, but not a wet day).
    values = [0.002] * 8 + [0.0005] * (DAYS_IN_JAN - 8)
    stats = compute_daily_statistics(
        _daily_rows("tp_sum", {y: values for y in range(2016, 2026)}),
        variable="tp_sum",
    )

    counts = stats[stats["variable"] == "wet_days"]
    assert len(counts) == 1
    assert counts.iloc[0]["mean"] == pytest.approx(8.0)

    # The rainfall series itself is still emitted alongside the count.
    assert "tp_sum" in set(stats["variable"])


def test_wet_days_is_a_per_year_average_not_a_total() -> None:
    """A month present in ten years must not read as ten times as wet."""
    wet = [0.002] * 10 + [0.0] * (DAYS_IN_JAN - 10)
    one_year = compute_daily_statistics(
        _daily_rows("tp_sum", {2020: wet}), variable="tp_sum"
    )
    ten_years = compute_daily_statistics(
        _daily_rows("tp_sum", {y: wet for y in range(2016, 2026)}),
        variable="tp_sum",
    )

    def count(frame):
        return frame[frame["variable"] == "wet_days"].iloc[0]["mean"]

    assert count(one_year) == pytest.approx(10.0)
    assert count(ten_years) == pytest.approx(10.0)


def test_exactly_one_millimetre_counts_as_wet() -> None:
    """The WMO threshold is inclusive."""
    stats = compute_daily_statistics(
        _daily_rows("tp_sum", {2020: [0.001] * DAYS_IN_JAN}), variable="tp_sum"
    )
    assert stats[stats["variable"] == "wet_days"].iloc[0]["mean"] == pytest.approx(
        float(DAYS_IN_JAN)
    )


# ── Sunshine and sunny days ──────────────────────────────────────────


def _ssrd_for_fraction(latitude: float, day: int, fraction: float) -> float:
    """SSRD that yields `fraction` of possible daylight as sunshine."""
    from wtg_pipeline.processing.sunshine import coefficients_for_latitude

    a, b = coefficients_for_latitude(latitude)
    kt = a + fraction * b
    return extraterrestrial_daily_j_m2(latitude, day) * kt


def test_ssrd_becomes_sunshine_hours_not_joules() -> None:
    latitude = -13.5
    values = [_ssrd_for_fraction(latitude, day, 0.8) for day in range(1, DAYS_IN_JAN + 1)]
    stats = compute_daily_statistics(
        _daily_rows("ssrd_sum", {2020: values}),
        variable="ssrd_sum",
        latitudes={"p1": latitude},
    )

    series = stats[stats["variable"] == "sun_hours"]
    assert len(series) == 1
    expected = 0.8 * day_length_hours(latitude, 16)  # mid-month day length
    assert series.iloc[0]["mean"] == pytest.approx(expected, abs=0.3)

    # The raw joule figure must not survive; nothing downstream wants it.
    assert "ssrd_sum" not in set(stats["variable"])


def test_sunny_days_uses_the_seventy_percent_rule() -> None:
    latitude = -13.5
    # 12 clearly sunny days, the rest clearly not.
    values = [_ssrd_for_fraction(latitude, day, 0.95) for day in range(1, 13)]
    values += [
        _ssrd_for_fraction(latitude, day, 0.2) for day in range(13, DAYS_IN_JAN + 1)
    ]

    stats = compute_daily_statistics(
        _daily_rows("ssrd_sum", {2020: values}),
        variable="ssrd_sum",
        latitudes={"p1": latitude},
    )
    counts = stats[stats["variable"] == "sunny_days"]
    assert counts.iloc[0]["mean"] == pytest.approx(12.0)
    assert SUNNY_DAY_FRACTION == 0.70


def test_sunshine_is_skipped_when_latitude_is_unknown() -> None:
    """Better to emit nothing than to derive every polygon at the equator."""
    frame = _daily_rows("ssrd_sum", {2020: [1.5e7] * DAYS_IN_JAN})
    stats = compute_daily_statistics(frame, variable="ssrd_sum", latitudes={})
    assert stats.empty


def test_polygons_without_latitude_are_dropped_not_defaulted() -> None:
    known = _daily_rows("ssrd_sum", {2020: [1.5e7] * DAYS_IN_JAN}, polygon_id="p1")
    unknown = _daily_rows("ssrd_sum", {2020: [1.5e7] * DAYS_IN_JAN}, polygon_id="p2")
    frame = pd.concat([known, unknown], ignore_index=True)

    stats = compute_daily_statistics(
        frame, variable="ssrd_sum", latitudes={"p1": -13.5}
    )
    assert set(stats["polygon_id"]) == {"p1"}


# ── Latitude sidecar ─────────────────────────────────────────────────


def test_latitude_sidecar_round_trip(tmp_path) -> None:
    path = latitudes_path("admin1", base_dir=tmp_path)
    path.write_text(json.dumps({"p1": -13.5, "p2": 51.5}), encoding="utf-8")
    assert load_latitudes("admin1", base_dir=tmp_path) == {"p1": -13.5, "p2": 51.5}


def test_missing_sidecar_is_empty_not_an_error(tmp_path) -> None:
    assert load_latitudes("admin1", base_dir=tmp_path) == {}


def test_corrupt_sidecar_degrades_rather_than_raising(tmp_path) -> None:
    """A broken sidecar costs sunny-day counts, not the whole rebuild."""
    latitudes_path("admin1", base_dir=tmp_path).write_text("{not json", encoding="utf-8")
    assert load_latitudes("admin1", base_dir=tmp_path) == {}


# ── Driver ───────────────────────────────────────────────────────────


def test_build_percentiles_daily_end_to_end(tmp_path) -> None:
    latitude = -13.5
    frames = [
        _daily_rows("t2m_max", {y: list(np.linspace(18, 32, DAYS_IN_JAN))
                                for y in range(2016, 2026)}),
        _daily_rows("tp_sum", {y: [0.002] * 5 + [0.0] * (DAYS_IN_JAN - 5)
                               for y in range(2016, 2026)}),
        _daily_rows("ssrd_sum", {y: [_ssrd_for_fraction(latitude, d, 0.8)
                                     for d in range(1, DAYS_IN_JAN + 1)]
                                 for y in range(2016, 2026)}),
    ]
    source = tmp_path / "aggregated"
    source.mkdir()
    aggregate = source / "admin1.parquet"
    pd.concat(frames, ignore_index=True).to_parquet(aggregate, index=False)

    out = build_percentiles(
        level="admin1",
        aggregated_parquet=aggregate,
        base_dir=tmp_path,
        daily=True,
        latitudes={"p1": latitude},
    )
    assert out == percentiles_path("admin1", base_dir=tmp_path)

    result = pd.read_parquet(out)
    assert set(result["variable"]) == {
        "t2m_max", "tp_sum", "wet_days", "sun_hours", "sunny_days",
    }
    assert list(result.columns) == list(DAILY_COLUMNS)

    wet = result[result["variable"] == "wet_days"].iloc[0]
    assert wet["mean"] == pytest.approx(5.0)

    temp = result[result["variable"] == "t2m_max"].iloc[0]
    assert temp["p5"] < temp["mean"] < temp["p95"]


def test_build_percentiles_is_cached(tmp_path) -> None:
    frame = _daily_rows("t2m_max", {2020: [20.0] * DAYS_IN_JAN})
    source = tmp_path / "aggregated"
    source.mkdir()
    aggregate = source / "admin1.parquet"
    frame.to_parquet(aggregate, index=False)

    first = build_percentiles(
        level="admin1", aggregated_parquet=aggregate, base_dir=tmp_path,
        daily=True, latitudes={},
    )
    stamp = first.stat().st_mtime_ns

    build_percentiles(
        level="admin1", aggregated_parquet=aggregate, base_dir=tmp_path,
        daily=True, latitudes={},
    )
    assert first.stat().st_mtime_ns == stamp, "cache hit should not rewrite"


def test_daily_is_detected_from_the_input_not_declared(tmp_path) -> None:
    """Passing the wrong flag would compute an interannual band and label it a
    within-month one, so the aggregate's own schema decides."""
    source = tmp_path / "aggregated"
    source.mkdir()

    daily_agg = source / "admin1.parquet"
    _daily_rows("t2m_max", {y: [20.0] * DAYS_IN_JAN for y in range(2016, 2026)}).to_parquet(
        daily_agg, index=False
    )
    result = pd.read_parquet(
        build_percentiles(level="admin1", aggregated_parquet=daily_agg, base_dir=tmp_path)
    )
    assert "n_days" in result.columns and "p5" in result.columns

    monthly_agg = source / "country.parquet"
    _daily_rows("t2m", {y: [20.0] * 12 for y in range(2016, 2026)}).drop(
        columns=["day"]
    ).to_parquet(monthly_agg, index=False)
    monthly = pd.read_parquet(
        build_percentiles(level="country", aggregated_parquet=monthly_agg, base_dir=tmp_path)
    )
    assert "p10" in monthly.columns and "p90" in monthly.columns
