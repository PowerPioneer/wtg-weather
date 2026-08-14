"""Resolving advisory carve-out prose to ISO-3166-2 codes.

A resolved carve-out paints a real subdivision at a level the country does not
carry, so every test here is about the resolver declining to guess. The
gazetteer is generated from the same Natural Earth admin-1 layer the tiles are
built from (`scripts/generate_subdivisions.py`).
"""

from __future__ import annotations

import pytest

from wtg_pipeline.processing.subdivisions import fold, gazetteer, resolve


def test_the_gazetteer_shipped() -> None:
    gaz = gazetteer()
    assert len(gaz) >= 150, "gazetteer looks unbuilt — regenerate it"
    assert sum(len(v) for v in gaz.values()) >= 3000


def test_every_code_is_a_real_iso_3166_2_code() -> None:
    """Natural Earth ships ~200 placeholders shaped `AQ-X01~`.

    They resolve to no polygon the web can key off, and one reaching the
    tiles would be an advisory attached to nothing while looking like it
    worked.
    """
    import re

    for country, names in gazetteer().items():
        for name, code in names.items():
            assert re.fullmatch(r"[A-Z]{2}-[A-Z0-9]{1,3}", code), (country, name, code)
            assert code.startswith(f"{country}-"), (country, name, code)


def test_resolves_the_colombia_carve_out() -> None:
    # The real list item from the US advisory.
    codes = resolve(
        "CO", "Arauca, Cauca (excluding Popayán), and Norte de Santander departments"
    )
    assert codes == ["CO-ARA", "CO-CAU", "CO-NSA"]


def test_the_longer_name_wins_an_overlap() -> None:
    """`Santander` sits inside `Norte de Santander`.

    Without longest-match-wins the substring stamps CO-SAN too — a different
    department that the advisory never mentioned.
    """
    assert resolve("CO", "Norte de Santander department") == ["CO-NSA"]
    # And the shorter name still resolves when it is genuinely what is named.
    assert resolve("CO", "Santander department") == ["CO-SAN"]


def test_prose_naming_only_the_country_resolves_to_nothing() -> None:
    """The disambiguator.

    "Do not travel to Afghanistan" and "Do Not Travel to: <list>" are the same
    words; only the second names a subdivision, so only the second resolves.
    """
    assert resolve("AF", "Do not travel to Afghanistan for any reason") == []
    assert resolve("BF", "Do Not Travel to Burkina Faso for any reason") == []


def test_a_subdivision_of_another_country_is_not_matched() -> None:
    # Belarus's advisory mentions Ukraine; Ukrainian oblasts must not resolve
    # under BY, and the search is scoped to the country's own gazetteer.
    codes = resolve("BY", "the border region between Belarus and Ukraine")
    assert all(c.startswith("BY-") for c in codes)


def test_matching_is_on_whole_words() -> None:
    # A name must not be found inside a longer word.
    assert resolve("CO", "Araucaria trees grow here") == []


def test_diacritics_and_case_do_not_matter() -> None:
    assert resolve("PE", "the VRAEM region of Ayacucho") == resolve(
        "PE", "the vraem region of AYACUCHO"
    )
    assert "PE-AYA" in resolve("PE", "Ayacucho")


def test_an_unknown_country_resolves_to_nothing() -> None:
    assert resolve("ZZ", "anywhere at all") == []
    assert resolve("", "anywhere at all") == []


def test_empty_prose_resolves_to_nothing() -> None:
    assert resolve("CO", "") == []


def test_fold_preserves_word_boundaries() -> None:
    # Unlike the country-name folds elsewhere, which strip spaces entirely —
    # these names are matched inside prose.
    assert fold("Norte de Santander") == "norte de santander"
    assert fold("Ayacucho, Perú") == "ayacucho peru"


@pytest.mark.parametrize(
    ("country", "prose", "expected"),
    [
        ("PE", "the VRAEM region including Ayacucho and Cusco", {"PE-AYA", "PE-CUS"}),
        ("MZ", "Cabo Delgado province", {"MZ-P"}),
        ("ET", "the Tigray region", {"ET-TI"}),
    ],
)
def test_known_carve_outs_resolve(country: str, prose: str, expected: set[str]) -> None:
    assert expected <= set(resolve(country, prose))
