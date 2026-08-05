"""`apply_country_rules` — the admin-1 → country recomputation.

These exercise the join key rather than the arithmetic. Getting the key wrong
does not raise: the recomputed country simply fails to match its geometry in
`build_feature_collection` and disappears from the tiles, which is invisible
until someone decodes an archive and notices France is missing.
"""

from __future__ import annotations

import pytest

pd = pytest.importorskip("pandas")

from wtg_pipeline.processing.aggregate import apply_country_rules  # noqa: E402

COLUMNS = ["polygon_id", "iso_a2", "admin1_code", "year", "month", "variable", "value"]


def _admin1_rows(iso: str, codes_and_values: dict[str, float]):
    return pd.DataFrame(
        [
            {
                "polygon_id": f"{iso}-poly-{index}",
                "iso_a2": iso,
                "admin1_code": code,
                "year": 2020,
                "month": 1,
                "variable": "t2m",
                "value": value,
            }
            for index, (code, value) in enumerate(codes_and_values.items())
        ],
        columns=COLUMNS,
    )


def _country_row(polygon_id: str, iso: str, value: float):
    return pd.DataFrame(
        [
            {
                "polygon_id": polygon_id,
                "iso_a2": iso,
                "admin1_code": "",
                "year": 2020,
                "month": 1,
                "variable": "t2m",
                "value": value,
            }
        ],
        columns=COLUMNS,
    )


def test_recomputed_country_keeps_the_country_layers_polygon_id() -> None:
    # The country layer is keyed by ADM0_A3 ("FRA"), not by ISO-2 ("FR").
    admin1 = _admin1_rows("FR", {"FR-75": 12.0, "FR-29": 10.0, "FR-GF": 27.0})
    country = _country_row("FRA", "FR", 16.0)

    result = apply_country_rules(admin1, country)

    france = result[result["iso_a2"] == "FR"]
    assert len(france) == 1
    assert france.iloc[0]["polygon_id"] == "FRA", (
        "recomputed country row must carry the country layer's polygon id, "
        "otherwise it cannot be joined back to its geometry"
    )


def test_overseas_departments_are_excluded_from_the_mean() -> None:
    # French Guiana at 27°C must not drag the metropolitan mean upward.
    admin1 = _admin1_rows("FR", {"FR-75": 12.0, "FR-29": 10.0, "FR-GF": 27.0})
    country = _country_row("FRA", "FR", 16.0)

    result = apply_country_rules(admin1, country)

    assert result[result["iso_a2"] == "FR"].iloc[0]["value"] == pytest.approx(11.0)


def test_suppressed_country_is_dropped() -> None:
    admin1 = _admin1_rows("AR", {"AR-C": 18.0})
    country = _country_row("ARG", "AR", 18.0)

    result = apply_country_rules(admin1, country)

    assert result[result["iso_a2"] == "AR"].empty


def test_country_without_whitelist_passes_through_untouched() -> None:
    admin1 = _admin1_rows("BE", {"BE-VLG": 11.0})
    country = _country_row("BEL", "BE", 10.5)

    result = apply_country_rules(admin1, country)

    belgium = result[result["iso_a2"] == "BE"]
    assert len(belgium) == 1
    # Untouched means the naive country aggregate survives, not the admin-1 mean.
    assert belgium.iloc[0]["value"] == pytest.approx(10.5)
    assert belgium.iloc[0]["polygon_id"] == "BEL"


def test_missing_admin1_falls_back_to_the_naive_aggregate() -> None:
    # No admin-1 rows for Portugal at all — keep the naive row rather than
    # dropping the country off the map.
    admin1 = _admin1_rows("FR", {"FR-75": 12.0})
    country = pd.concat(
        [_country_row("FRA", "FR", 16.0), _country_row("PRT", "PT", 17.0)],
        ignore_index=True,
    )

    result = apply_country_rules(admin1, country)

    portugal = result[result["iso_a2"] == "PT"]
    assert len(portugal) == 1
    assert portugal.iloc[0]["polygon_id"] == "PRT"
    assert portugal.iloc[0]["value"] == pytest.approx(17.0)
