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
    # Codes are Natural Earth 1:10m `iso_3166_2` values — French departments,
    # Spanish provinces, Portuguese districts — NOT the region-level codes an
    # earlier revision of the table used. See country_rules' module docstring.
    # France: Paris in, French Guiana / Réunion out.
    assert cr.admin1_contributes("FR", "FR-75")
    assert not cr.admin1_contributes("FR", "FR-GF")
    assert not cr.admin1_contributes("FR", "FR-RE")
    # Spain: Madrid in, Canaries / Ceuta / Melilla out.
    assert cr.admin1_contributes("ES", "ES-M")
    assert not cr.admin1_contributes("ES", "ES-GC")
    assert not cr.admin1_contributes("ES", "ES-TF")
    assert not cr.admin1_contributes("ES", "ES-CE")
    assert not cr.admin1_contributes("ES", "ES-ML")
    # Portugal: Lisboa in, Açores / Madeira out.
    assert cr.admin1_contributes("PT", "PT-11")
    assert not cr.admin1_contributes("PT", "PT-20")
    assert not cr.admin1_contributes("PT", "PT-30")
    # Netherlands: Zuid-Holland in, Caribbean municipalities out.
    assert cr.admin1_contributes("NL", "NL-ZH")
    assert not cr.admin1_contributes("NL", "NL-BQ1")
    # Norway: Oslo in, Svalbard / Bouvet out.
    assert cr.admin1_contributes("NO", "NO-03")
    assert not cr.admin1_contributes("NO", "NO-21")
    assert not cr.admin1_contributes("NO", "NO-X01~")
    # Ecuador: Pichincha in, Galápagos out.
    assert cr.admin1_contributes("EC", "EC-P")
    assert not cr.admin1_contributes("EC", "EC-W")


def test_united_kingdom_has_no_whitelist() -> None:
    # Every UK admin-1 unit in the 10m layer is domestic; the overseas
    # territories are separate admin-0 entries with their own ISO codes, so
    # GB must aggregate over everything rather than match an empty whitelist.
    assert "GB" not in cr.MAINLAND_WHITELIST
    assert cr.admin1_contributes("GB", "GB-ENG")
    assert cr.admin1_contributes("GB", "GB-EDH")


def test_filter_admin1_codes_round_trip() -> None:
    codes = ["FR-75", "FR-GF", "FR-RE", "FR-29"]
    assert cr.filter_admin1_codes("FR", codes) == ["FR-75", "FR-29"]


def test_plan_for_round_trip() -> None:
    plan = cr.plan_for("FR")
    assert plan.iso_a2 == "FR"
    assert not plan.suppressed
    assert "FR-75" in plan.mainland_only
    assert "FR-GF" not in plan.mainland_only

    plan = cr.plan_for("US")
    assert plan.suppressed
    assert plan.mainland_only == frozenset()


def test_whitelists_have_plausible_sizes() -> None:
    # Guards the failure mode this table shipped with: codes from the wrong
    # administrative vintage, matching nothing. Sizes track the 10m layer.
    expected = {"DK": 5, "EC": 23, "ES": 48, "FR": 96, "NL": 12, "NO": 19, "PT": 18}
    actual = {iso: len(codes) for iso, codes in cr.MAINLAND_WHITELIST.items()}
    assert actual == expected


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
