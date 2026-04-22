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

The whitelist is expressed in terms of the admin-1 ``iso_3166_2`` code used by
Natural Earth (e.g. ``FR-75``, ``US-CA``). Countries not present in either
table aggregate normally over every polygon.

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


# Opt-in whitelist: country ISO-2 → admin-1 ISO-3166-2 codes that count
# toward the country-level aggregate. Any region NOT listed is excluded.
#
# Countries that aren't in this mapping aggregate over every polygon they
# own, which is the right default for the ~170 remaining cases (small or
# climatically coherent mainland-only states).
MAINLAND_WHITELIST: dict[str, frozenset[str]] = {
    # France: metropolitan regions only. Drops Guyane (FR-GF), Réunion
    # (FR-RE), Martinique (FR-MQ), Guadeloupe (FR-GP), Mayotte (FR-YT),
    # Saint-Pierre-et-Miquelon, New Caledonia, French Polynesia, etc.
    "FR": frozenset(
        {
            "FR-ARA",  # Auvergne-Rhône-Alpes
            "FR-BFC",  # Bourgogne-Franche-Comté
            "FR-BRE",  # Bretagne
            "FR-CVL",  # Centre-Val de Loire
            "FR-COR",  # Corse
            "FR-GES",  # Grand Est
            "FR-HDF",  # Hauts-de-France
            "FR-IDF",  # Île-de-France
            "FR-NOR",  # Normandie
            "FR-NAQ",  # Nouvelle-Aquitaine
            "FR-OCC",  # Occitanie
            "FR-PDL",  # Pays de la Loire
            "FR-PAC",  # Provence-Alpes-Côte d'Azur
        }
    ),
    # Spain: Iberian peninsula + Balearic Islands only. Drops Canarias
    # (ES-CN), Ceuta (ES-CE), Melilla (ES-ML).
    "ES": frozenset(
        {
            "ES-AN",
            "ES-AR",
            "ES-AS",
            "ES-IB",
            "ES-CB",
            "ES-CL",
            "ES-CM",
            "ES-CT",
            "ES-EX",
            "ES-GA",
            "ES-MD",
            "ES-MC",
            "ES-NC",
            "ES-PV",
            "ES-RI",
            "ES-VC",
        }
    ),
    # Netherlands: European provinces only. Drops Bonaire / Saba / Sint
    # Eustatius (Caribbean Netherlands) which sit in BES codes.
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
    # Denmark: Jutland + islands only. Drops Greenland (GL — separate ISO
    # country anyway, but some boundary sources attach it) and Færøerne.
    "DK": frozenset(
        {
            "DK-81",  # Nordjylland
            "DK-82",  # Midtjylland
            "DK-83",  # Syddanmark
            "DK-84",  # Hovedstaden
            "DK-85",  # Sjælland
        }
    ),
    # Portugal: mainland only. Drops Açores (PT-20) and Madeira (PT-30).
    "PT": frozenset(
        {
            "PT-01",  # Aveiro
            "PT-02",  # Beja
            "PT-03",  # Braga
            "PT-04",  # Bragança
            "PT-05",  # Castelo Branco
            "PT-06",  # Coimbra
            "PT-07",  # Évora
            "PT-08",  # Faro
            "PT-09",  # Guarda
            "PT-10",  # Leiria
            "PT-11",  # Lisboa
            "PT-12",  # Portalegre
            "PT-13",  # Porto
            "PT-14",  # Santarém
            "PT-15",  # Setúbal
            "PT-16",  # Viana do Castelo
            "PT-17",  # Vila Real
            "PT-18",  # Viseu
        }
    ),
    # Norway: mainland only. Drops Svalbard (NO-21) and Jan Mayen (NO-22).
    "NO": frozenset(
        {
            "NO-03",  # Oslo
            "NO-11",  # Rogaland
            "NO-15",  # Møre og Romsdal
            "NO-18",  # Nordland
            "NO-30",  # Viken
            "NO-31",  # Vestfold og Telemark (older: 07/08)
            "NO-34",  # Innlandet
            "NO-38",  # Vestfold og Telemark (alt)
            "NO-42",  # Agder
            "NO-46",  # Vestland
            "NO-50",  # Trøndelag
            "NO-54",  # Troms og Finnmark
        }
    ),
    # United Kingdom: Great Britain + NI. Drops Gibraltar, Falklands,
    # British Overseas Territories, Crown Dependencies.
    "GB": frozenset(
        {
            "GB-ENG",
            "GB-SCT",
            "GB-WLS",
            "GB-NIR",
        }
    ),
    # Ecuador: continental only. Drops Galápagos (EC-W).
    "EC": frozenset(
        {
            "EC-A",  # Azuay
            "EC-B",  # Bolívar
            "EC-C",  # Carchi
            "EC-D",  # Orellana
            "EC-E",  # Esmeraldas
            "EC-F",  # Cañar
            "EC-G",  # Guayas
            "EC-H",  # Chimborazo
            "EC-I",  # Imbabura
            "EC-L",  # Loja
            "EC-M",  # Manabí
            "EC-N",  # Napo
            "EC-O",  # El Oro
            "EC-P",  # Pichincha
            "EC-R",  # Los Ríos
            "EC-S",  # Morona Santiago
            "EC-SD",  # Santo Domingo
            "EC-SE",  # Santa Elena
            "EC-T",  # Tungurahua
            "EC-U",  # Sucumbíos
            "EC-X",  # Cotopaxi
            "EC-Y",  # Pastaza
            "EC-Z",  # Zamora Chinchipe
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
