"""Corrections to the handful of admin-1 names Natural Earth gets wrong.

The frame these are applied to feeds *both* the tiles and the published API
bundle, so a name is either right in both or wrong in both. That is the whole
reason the override sits in the loader rather than in either consumer.
"""

from __future__ import annotations

import pandas as pd
import pytest

from wtg_pipeline.pipeline_runner import (
    ADMIN1_NAME_OVERRIDES,
    _apply_admin1_name_overrides,
    _coalesce_column,
)


def _frame(rows: list[tuple[str, str]]) -> pd.DataFrame:
    """`[(adm1_code, name)]` → the two columns the override reads."""
    return pd.DataFrame(
        {"polygon_id": [c for c, _ in rows], "name": [n for _, n in rows]}
    )


def test_an_override_replaces_only_its_own_row():
    gdf = _frame([("PER-571", "Cusco Departament"), ("PER-572", "Arequipa")])
    names = _apply_admin1_name_overrides(gdf)
    assert list(names) == ["Cusco", "Arequipa"]


def test_a_stale_override_warns_rather_than_failing(caplog, monkeypatch):
    """The codes are tied to a boundary vintage; a re-download can retire one.

    A stale entry must not stop a build — but it must be findable, because the
    silent failure is a name quietly reverting to Natural Earth's version.
    """
    monkeypatch.setattr(
        "wtg_pipeline.pipeline_runner.ADMIN1_NAME_OVERRIDES", {"NOPE-999": "Nowhere"}
    )
    gdf = _frame([("PER-571", "Cusco")])
    with caplog.at_level("WARNING"):
        names = _apply_admin1_name_overrides(gdf)
    assert list(names) == ["Cusco"]
    assert "ADMIN1_NAME_OVERRIDE_STALE" in caplog.text


def test_cusco_is_corrected_and_keyed_by_the_unique_identity():
    """`iso_3166_2` is not unique in the 10m layer; `adm1_code` is.

    Keying an override by the wrong one would rename an unrelated polygon in
    another country — the exact failure the admin-1 loader's comment warns
    about.
    """
    assert ADMIN1_NAME_OVERRIDES["PER-571"] == "Cusco"
    assert all(not code.startswith("PE-") for code in ADMIN1_NAME_OVERRIDES), (
        "overrides must be keyed by adm1_code (e.g. PER-571), not iso_3166_2"
    )


def test_overrides_stay_a_short_list():
    """A growing list means the preference for `name_en` is the wrong default.

    This is a guard against the map becoming a style sheet for region names.
    Raise it deliberately if a boundary vintage genuinely needs more.
    """
    assert len(ADMIN1_NAME_OVERRIDES) <= 10


@pytest.mark.parametrize(
    "name_en, name, expected",
    [
        ("Bavaria", "Bayern", "Bavaria"),  # why we prefer name_en at all
        (None, "Møre og Romsdal", "Møre og Romsdal"),  # NE leaves name_en null
    ],
)
def test_coalesce_still_prefers_the_english_name(name_en, name, expected):
    """The override corrects exceptions; it must not invert the general rule."""
    gdf = pd.DataFrame({"name_en": [name_en], "name": [name]})
    assert list(_coalesce_column(gdf, "name_en", "name")) == [expected]
