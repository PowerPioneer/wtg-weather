from __future__ import annotations

from wtg_pipeline.sources.advisories.canada import (
    CanadaScraper,
    _level_from_img,
    _level_from_text,
)


def test_level_from_img() -> None:
    assert _level_from_img("/vt/images/taa/risklevels/do-not-travel.svg") == 4
    assert _level_from_img("/vt/images/taa/risklevels/reconsider-travel.svg") == 3
    assert _level_from_img("/vt/images/taa/risklevels/increased-caution.svg") == 2
    assert _level_from_img("/vt/images/taa/risklevels/normal-precautions.svg") == 1
    assert _level_from_img("/something-else.svg") is None


def test_level_from_text() -> None:
    assert _level_from_text("Avoid all travel") == 4
    assert _level_from_text("Avoid non-essential travel") == 3
    assert _level_from_text("Exercise a high degree of caution") == 2
    assert _level_from_text("Take normal security precautions") == 1


def test_parses_fixture(advisory_fixture) -> None:
    raw = advisory_fixture("canada.html")
    out = CanadaScraper(client=object()).parse(raw)
    by_iso = {a.country_iso2: a.level for a in out}
    assert by_iso["AF"] == 4
    assert by_iso["CO"] == 3
    assert by_iso["MX"] == 2
    assert by_iso["JP"] == 1


def test_unmapped_country_dropped(advisory_fixture) -> None:
    raw = advisory_fixture("canada.html")
    out = CanadaScraper(client=object()).parse(raw)
    # "Atlantis" and "Textonly" have no mapping — must be absent.
    iso = {a.country_iso2 for a in out}
    assert "ZZ" not in iso
    assert len(out) == 4


def test_country_only_never_sets_region(advisory_fixture) -> None:
    raw = advisory_fixture("canada.html")
    out = CanadaScraper(client=object()).parse(raw)
    for a in out:
        assert a.region_code is None
