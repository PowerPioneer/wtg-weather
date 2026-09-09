"""Admin-2 reads daily rasters but stores monthly means.

At day resolution admin-2 is 719 million rows and ~22 GB for the four series,
and the percentile stage would have to pull 180 million of them into pandas per
variable. Rolled up it is the size the monthly aggregate has always been.

The rollup has to keep one property: `t` stays the mean daily maximum, so the
map does not change meaning when a reader crosses zoom 7 — which is the whole
reason this rebuild exists.
"""

from __future__ import annotations

import pytest

pd = pytest.importorskip("pandas")
pytest.importorskip("pyarrow")

from wtg_pipeline.processing.aggregate import _rollup_to_monthly  # noqa: E402
from wtg_pipeline.processing.sunshine import (  # noqa: E402
    sunshine_hours_for_day,
)

LAT = -12.0


class _StubGeometry:
    def __init__(self, latitude: float):
        self._latitude = latitude

    def representative_point(self):
        return type("_Point", (), {"y": self._latitude})()


class _StubPolygons:
    level = "admin2"
    id_col = "polygon_id"

    def __init__(self):
        self.gdf = pd.DataFrame(
            {"polygon_id": ["p1"], "geometry": [_StubGeometry(LAT)]}
        )


def _daily(variable: str, values: list[float]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "polygon_id": "p1",
            "iso_a2": "PE",
            "admin1_code": "",
            "year": 2020,
            "month": 1,
            "day": range(1, len(values) + 1),
            "variable": variable,
            "value": values,
        }
    )


def test_rollup_collapses_days_into_one_row_per_month() -> None:
    frame = _daily("t2m_max", [290.0, 292.0, 294.0])
    out = _rollup_to_monthly(frame, "t2m_max", _StubPolygons())

    assert len(out) == 1
    assert "day" not in out.columns
    row = out.iloc[0]
    assert row["variable"] == "t2m_max"
    # The mean of the daily maxima, which is what the red line and the map mean.
    assert row["value"] == pytest.approx(292.0)


def test_sunshine_is_derived_per_day_and_only_then_averaged() -> None:
    """The load-bearing one.

    Sunshine is non-linear in SSRD, so the sunshine of the average day is not
    the average of the days' sunshine. Averaging the joules first and
    converting once would quietly overstate sunshine in every cloudy climate —
    a bright day cannot make up for a dull one, but the arithmetic mean lets it.
    """
    overcast, brilliant = 4.0e6, 2.8e7
    frame = _daily("ssrd_sum", [overcast, brilliant])
    out = _rollup_to_monthly(frame, "ssrd_sum", _StubPolygons())

    row = out.iloc[0]
    # Renamed, because it is no longer joules.
    assert row["variable"] == "sun_hours"

    per_day = [
        sunshine_hours_for_day(v, latitude_deg=LAT, day_of_year=d)
        for d, v in ((1, overcast), (2, brilliant))
    ]
    assert row["value"] == pytest.approx(sum(per_day) / 2)

    # And it is genuinely not the same as converting the mean — if it were,
    # this test would be pinning nothing.
    convert_after = sunshine_hours_for_day(
        (overcast + brilliant) / 2, latitude_deg=LAT, day_of_year=1
    )
    assert row["value"] != pytest.approx(convert_after, rel=1e-3)


def test_rollup_keeps_the_polygon_keys() -> None:
    frame = _daily("tp_sum", [0.001, 0.003])
    out = _rollup_to_monthly(frame, "tp_sum", _StubPolygons())
    row = out.iloc[0]
    assert (row["polygon_id"], row["iso_a2"], row["year"], row["month"]) == (
        "p1", "PE", 2020, 1,
    )
    assert row["value"] == pytest.approx(0.002)
