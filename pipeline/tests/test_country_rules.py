from __future__ import annotations

import pytest

from wtg_pipeline.processing import country_rules as cr


def test_suppressed_countries_have_expected_members() -> None:
    # Non-regressive canaries — if one of these drops off the list, the
    # Phase 3a rationale in pipeline/docs/aggregation-qa-2026.md must be
    # revisited.
    for iso in ("US", "CA", "RU", "CN", "AU", "BR", "IN", "AR", "KZ", "CL"):
        assert cr.is_suppressed(iso), f"{iso} should be suppressed"


def test_non_suppressed_country_is_not_suppressed() -> None:
    assert not cr.is_suppressed("BE")
    assert not cr.is_suppressed("CH")
    assert not cr.is_suppressed("PE")


def test_is_suppressed_case_insensitive() -> None:
    assert cr.is_suppressed("us")
    assert cr.is_suppressed("Ru")


def test_admin1_contributes_suppressed_country_always_false() -> None:
    # Suppressed countries emit no country-level row, so nothing contributes.
    assert not cr.admin1_contributes("US", "US-CA")
    assert not cr.admin1_contributes("RU", "RU-MOW")


def test_admin1_contributes_unknown_country_includes_all() -> None:
    # Countries without a whitelist aggregate over everything they own.
    assert cr.admin1_contributes("BE", "BE-BRU")
    assert cr.admin1_contributes("BE", "BE-VLG")


def test_admin1_contributes_whitelisted_country_filters() -> None:
    # France: Île-de-France in, French Guiana out.
    assert cr.admin1_contributes("FR", "FR-IDF")
    assert not cr.admin1_contributes("FR", "FR-GF")
    # Spain: Andalucía in, Canarias out.
    assert cr.admin1_contributes("ES", "ES-AN")
    assert not cr.admin1_contributes("ES", "ES-CN")
    # Portugal: Lisboa in, Açores out.
    assert cr.admin1_contributes("PT", "PT-11")
    assert not cr.admin1_contributes("PT", "PT-20")


def test_filter_admin1_codes_round_trip() -> None:
    codes = ["FR-IDF", "FR-GF", "FR-RE", "FR-BRE"]
    assert cr.filter_admin1_codes("FR", codes) == ["FR-IDF", "FR-BRE"]


def test_plan_for_round_trip() -> None:
    plan = cr.plan_for("FR")
    assert plan.iso_a2 == "FR"
    assert not plan.suppressed
    assert "FR-IDF" in plan.mainland_only
    assert "FR-GF" not in plan.mainland_only

    plan = cr.plan_for("US")
    assert plan.suppressed
    assert plan.mainland_only == frozenset()


@pytest.mark.parametrize("iso", sorted(cr.MAINLAND_WHITELIST))
def test_whitelists_nonempty_and_prefixed(iso: str) -> None:
    # Every whitelist entry should contain at least one admin-1 code that
    # is prefixed with the country ISO-2 (the Natural Earth iso_3166_2
    # convention).
    allowed = cr.MAINLAND_WHITELIST[iso]
    assert allowed
    assert any(code.startswith(f"{iso}-") for code in allowed), (
        f"{iso}: no admin-1 code has the {iso}- prefix"
    )
