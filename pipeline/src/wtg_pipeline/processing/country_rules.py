"""Country-level aggregation rules (Phase 3a).

Naive area-weighted averaging across every polygon attributed to a country
produces meaningless numbers for countries that are either too large to have
a single climate (Russia, Canada) or hold non-contiguous overseas territory
that dominates the mean (France with French Guiana, Spain with Canary
Islands, etc.).

Two declarative tables encode the fix:

* :data:`SUPPRESSED_COUNTRIES` — ISO-2 codes for which the pipeline emits
  *no* country-level row. The UI renders the country polygon as an admin-1
  mosaic at country-level zoom instead.

* :data:`MAINLAND_WHITELIST` — ISO-2 → set of admin-1 region codes that are
  allowed to contribute to the country-level aggregate. Opt-in: a region not
  listed is silently excluded, so a newly added overseas territory never
  contaminates the parent country's mean.

The whitelist is expressed in terms of the admin-1 ``iso_3166_2`` code as it
appears in the **Natural Earth 1:10m** admin-1 layer, which is the vintage the
pipeline downloads. That granularity matters: 10m subdivides France into 101
departments (``FR-75``), not the 13 post-2016 regions (``FR-IDF``), and the UK
into 232 districts rather than four constituent countries. An earlier version
of this table was written against region-level codes that do not occur in the
data at all, so every whitelisted country matched nothing and silently fell
back to a naive aggregate that still included its overseas territory.

Do not hand-edit the whitelist. Regenerate it with::

    uv run --directory pipeline python scripts/generate_mainland_whitelist.py

which derives the codes from Natural Earth's own ``type_en`` / ``region``
attributes and prints the literal below. Countries not present in either table
aggregate normally over every polygon.

The full QA rationale for these choices lives in
``pipeline/docs/aggregation-qa-2026.md``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


# Countries whose country-level aggregate is structurally meaningless.
# Rendered as admin-1 mosaic at country zoom instead of a single polygon.
SUPPRESSED_COUNTRIES: frozenset[str] = frozenset(
    {
        "RU",  # Moscow ≠ Vladivostok ≠ Sochi
        "CA",  # Vancouver ≠ Nunavut ≠ Halifax
        "US",  # Alaska + Hawaii + mainland + territories
        "CN",  # Beijing ≠ Kashgar ≠ Sanya
        "AU",  # Perth ≠ Hobart ≠ Darwin
        "BR",  # Manaus ≠ Porto Alegre
        "IN",  # Kashmir ≠ Kerala
        "AR",  # Salta ≠ Ushuaia
        "KZ",  # Aktau ≠ Almaty
        "CL",  # Atacama ≠ Tierra del Fuego ≠ Easter Island
    }
)


# Deliberately absent from MAINLAND_WHITELIST, recorded so the reasoning is
# not lost: every one of the United Kingdom's 232 admin-1 units in the 10m
# layer is domestic. Gibraltar, the Falklands and the other overseas
# territories are separate admin-0 entries carrying their own ISO codes (GI,
# FK, …), so they can never reach the GB aggregate and there is nothing to
# filter out.
_NO_WHITELIST_NEEDED: frozenset[str] = frozenset({"GB"})


# Opt-in whitelist: country ISO-2 → admin-1 ISO-3166-2 codes that count
# toward the country-level aggregate. Any region NOT listed is excluded.
#
# Countries that aren't in this mapping aggregate over every polygon they
# own, which is the right default for the ~230 remaining cases (small or
# climatically coherent mainland-only states).
#
# GENERATED — see the module docstring. Excluded units by country:
#   DK  none (Greenland and the Faroes are separate ISO countries)
#   EC  Galápagos
#   ES  Canary Is. (Las Palmas, Santa Cruz de Tenerife), Ceuta, Melilla
#   FR  French Guiana, Guadeloupe, Martinique, Mayotte, Réunion
#   NL  Bonaire, Saba, Sint Eustatius
#   NO  Svalbard, Bouvet Island
#   PT  Azores, Madeira
MAINLAND_WHITELIST: dict[str, frozenset[str]] = {
    "DK": frozenset(
        {
            "DK-81",
            "DK-82",
            "DK-83",
            "DK-84",
            "DK-85",
        }
    ),
    "EC": frozenset(
        {
            "EC-A",
            "EC-B",
            "EC-C",
            "EC-D",
            "EC-E",
            "EC-F",
            "EC-G",
            "EC-H",
            "EC-I",
            "EC-L",
            "EC-M",
            "EC-N",
            "EC-O",
            "EC-P",
            "EC-R",
            "EC-S",
            "EC-SD",
            "EC-SE",
            "EC-T",
            "EC-U",
            "EC-X",
            "EC-Y",
            "EC-Z",
        }
    ),
    "ES": frozenset(
        {
            "ES-A",
            "ES-AB",
            "ES-AL",
            "ES-AV",
            "ES-B",
            "ES-BA",
            "ES-BI",
            "ES-BU",
            "ES-C",
            "ES-CA",
            "ES-CC",
            "ES-CO",
            "ES-CR",
            "ES-CS",
            "ES-CU",
            "ES-GI",
            "ES-GR",
            "ES-GU",
            "ES-H",
            "ES-HU",
            "ES-J",
            "ES-L",
            "ES-LE",
            "ES-LO",
            "ES-LU",
            "ES-M",
            "ES-MA",
            "ES-MU",
            "ES-NA",
            "ES-O",
            "ES-OR",
            "ES-P",
            "ES-PM",
            "ES-PO",
            "ES-S",
            "ES-SA",
            "ES-SE",
            "ES-SG",
            "ES-SO",
            "ES-SS",
            "ES-T",
            "ES-TE",
            "ES-TO",
            "ES-V",
            "ES-VA",
            "ES-VI",
            "ES-Z",
            "ES-ZA",
        }
    ),
    "FR": frozenset(
        {
            "FR-01",
            "FR-02",
            "FR-03",
            "FR-04",
            "FR-05",
            "FR-06",
            "FR-07",
            "FR-08",
            "FR-09",
            "FR-10",
            "FR-11",
            "FR-12",
            "FR-13",
            "FR-14",
            "FR-15",
            "FR-16",
            "FR-17",
            "FR-18",
            "FR-19",
            "FR-21",
            "FR-22",
            "FR-23",
            "FR-24",
            "FR-25",
            "FR-26",
            "FR-27",
            "FR-28",
            "FR-29",
            "FR-2A",
            "FR-2B",
            "FR-30",
            "FR-31",
            "FR-32",
            "FR-33",
            "FR-34",
            "FR-35",
            "FR-36",
            "FR-37",
            "FR-38",
            "FR-39",
            "FR-40",
            "FR-41",
            "FR-42",
            "FR-43",
            "FR-44",
            "FR-45",
            "FR-46",
            "FR-47",
            "FR-48",
            "FR-49",
            "FR-50",
            "FR-51",
            "FR-52",
            "FR-53",
            "FR-54",
            "FR-55",
            "FR-56",
            "FR-57",
            "FR-58",
            "FR-59",
            "FR-60",
            "FR-61",
            "FR-62",
            "FR-63",
            "FR-64",
            "FR-65",
            "FR-66",
            "FR-67",
            "FR-68",
            "FR-69",
            "FR-70",
            "FR-71",
            "FR-72",
            "FR-73",
            "FR-74",
            "FR-75",
            "FR-76",
            "FR-77",
            "FR-78",
            "FR-79",
            "FR-80",
            "FR-81",
            "FR-82",
            "FR-83",
            "FR-84",
            "FR-85",
            "FR-86",
            "FR-87",
            "FR-88",
            "FR-89",
            "FR-90",
            "FR-91",
            "FR-92",
            "FR-93",
            "FR-94",
            "FR-95",
        }
    ),
    "NL": frozenset(
        {
            "NL-DR",
            "NL-FL",
            "NL-FR",
            "NL-GE",
            "NL-GR",
            "NL-LI",
            "NL-NB",
            "NL-NH",
            "NL-OV",
            "NL-UT",
            "NL-ZE",
            "NL-ZH",
        }
    ),
    "NO": frozenset(
        {
            "NO-01",
            "NO-02",
            "NO-03",
            "NO-04",
            "NO-05",
            "NO-06",
            "NO-07",
            "NO-08",
            "NO-09",
            "NO-10",
            "NO-11",
            "NO-12",
            "NO-14",
            "NO-15",
            "NO-16",
            "NO-17",
            "NO-18",
            "NO-19",
            "NO-20",
        }
    ),
    "PT": frozenset(
        {
            "PT-01",
            "PT-02",
            "PT-03",
            "PT-04",
            "PT-05",
            "PT-06",
            "PT-07",
            "PT-08",
            "PT-09",
            "PT-10",
            "PT-11",
            "PT-12",
            "PT-13",
            "PT-14",
            "PT-15",
            "PT-16",
            "PT-17",
            "PT-18",
        }
    ),
}


@dataclass(frozen=True)
class AggregationPlan:
    """The per-country decision for how to compute a country-level aggregate.

    Attributes:
        iso_a2: Country ISO-2 code.
        suppressed: If ``True``, no country-level aggregate should be emitted.
        mainland_only: If non-empty, only these admin-1 codes contribute to
            the aggregate. Empty frozenset means "use all polygons".
    """

    iso_a2: str
    suppressed: bool
    mainland_only: frozenset[str]


def plan_for(iso_a2: str) -> AggregationPlan:
    """Return the aggregation plan for a single country."""
    code = iso_a2.upper()
    return AggregationPlan(
        iso_a2=code,
        suppressed=code in SUPPRESSED_COUNTRIES,
        mainland_only=MAINLAND_WHITELIST.get(code, frozenset()),
    )


def is_suppressed(iso_a2: str) -> bool:
    return iso_a2.upper() in SUPPRESSED_COUNTRIES


def admin1_contributes(iso_a2: str, admin1_code: str) -> bool:
    """Should this admin-1 polygon contribute to its country's aggregate?

    Returns ``False`` if the country is entirely suppressed. Otherwise, if
    the country has a whitelist, membership is required; if not, all polygons
    are included.
    """
    code = iso_a2.upper()
    if code in SUPPRESSED_COUNTRIES:
        return False
    whitelist = MAINLAND_WHITELIST.get(code)
    if whitelist is None:
        return True
    return admin1_code in whitelist


def filter_admin1_codes(iso_a2: str, admin1_codes: Iterable[str]) -> list[str]:
    """Return the subset of admin-1 codes that should aggregate for a country."""
    return [c for c in admin1_codes if admin1_contributes(iso_a2, c)]
