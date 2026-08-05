"""geoBoundaries ADM2 identity and country-code mapping.

Both behaviours here shipped broken and silent:

* ``shapeISO`` is empty in every ADM2 file geoBoundaries publishes, so using
  it as the polygon identity gave every district the same blank id. Aggregation
  keys results by id, so the whole level collapsed onto a single row.
* the ISO-2 code was derived by truncating the ISO-3 code to two characters,
  which is simply wrong for a large share of countries (DNK→DK, CHN→CN, DEU→DE).
"""

from __future__ import annotations

import pytest

pytest.importorskip("pandas")
pytest.importorskip("geopandas")

import pandas as pd  # noqa: E402

from wtg_pipeline.pipeline_runner import _admin2_polygon_ids  # noqa: E402


def test_prefers_shape_id_when_shape_iso_is_blank() -> None:
    frame = pd.DataFrame(
        {
            "shapeName": ["Abancay", "Acobamba", "Acomayo"],
            "shapeISO": ["", "", ""],
            "shapeID": ["86281439B95631", "86281439B92156", "86281439B20943"],
        }
    )

    ids = _admin2_polygon_ids(frame, "PER")

    assert list(ids) == ["86281439B95631", "86281439B92156", "86281439B20943"]
    assert ids.is_unique


def test_falls_back_to_shape_iso_when_shape_id_is_blank() -> None:
    frame = pd.DataFrame(
        {
            "shapeISO": ["PE-APU", "PE-HUV"],
            "shapeID": ["", ""],
        }
    )

    assert list(_admin2_polygon_ids(frame, "PER")) == ["PE-APU", "PE-HUV"]


def test_synthesises_ids_when_every_candidate_is_blank() -> None:
    # Never return blanks: identical ids silently merge districts' climate.
    frame = pd.DataFrame({"shapeISO": ["", ""], "shapeID": ["", ""]})

    ids = _admin2_polygon_ids(frame, "PER")

    assert list(ids) == ["PER-ADM2-0", "PER-ADM2-1"]
    assert ids.is_unique


def test_handles_a_file_with_no_identity_columns() -> None:
    frame = pd.DataFrame({"shapeName": ["Somewhere"]})

    assert list(_admin2_polygon_ids(frame, "PER")) == ["PER-ADM2-0"]


@pytest.mark.parametrize(
    ("iso3", "iso2"),
    [("PER", "PE"), ("DNK", "DK"), ("CHN", "CN"), ("DEU", "DE"), ("NAM", "NA")],
)
def test_iso3_to_iso2_is_a_lookup_not_a_truncation(iso3: str, iso2: str) -> None:
    # DNK/CHN/DEU all truncate to the wrong code; NAM guards the country whose
    # real ISO-2 code looks like a null token.
    from wtg_pipeline.pipeline_runner import _iso3_to_iso2

    try:
        mapping = _iso3_to_iso2()
    except FileNotFoundError:
        pytest.skip("Natural Earth country layer not downloaded")

    assert mapping[iso3] == iso2
