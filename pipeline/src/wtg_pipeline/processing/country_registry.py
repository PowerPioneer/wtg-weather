"""One country per ISO-2 code, derived from the Natural Earth admin-0 layer.

Two consumers, and they have to agree exactly:

* ``scripts/generate_country_registry.py`` renders
  ``web/src/lib/countries.generated.ts``, which is what turns a painted
  polygon's ``iso_a2`` into a name and a URL;
* :mod:`wtg_pipeline.publish.api_data` names the per-country files the SSR
  pages fetch by slug.

If those two produced slugs by different rules, `generateStaticParams` would
emit a slug the API cannot answer for and `dynamicParams = false` would turn
it into a build-time 404 — the exact failure mode WS-2 gated `routableCountries`
against. So the rule lives here once and both import it.

The slug rule mirrors ``regionSlug`` in ``web/src/lib/regions.ts``: decompose,
drop combining marks, lowercase, and collapse every run of non-alphanumerics
into a single hyphen.
"""

from __future__ import annotations

import logging
import unicodedata
from dataclasses import dataclass

log = logging.getLogger(__name__)

# Natural Earth's ``NAME_EN`` is the formal English name, which is what we want
# almost everywhere ("Marshall Islands", not NE's abbreviated "Marshall Is.").
# For these two the formal name is not what anyone types, links, or searches
# for, and the slug is part of the public URL, so they are overridden by hand.
NAME_OVERRIDES: dict[str, str] = {
    "CN": "China",  # NAME_EN: "People's Republic of China"
    "US": "United States",  # NAME_EN: "United States of America"
}

# Tokens Natural Earth uses where a polygon has no ISO-3166-1 alpha-2 code.
# Deliberately minimal, for the reason recorded in `pipeline_runner`: "NA" is
# Namibia's real code, and "NAN"/"NONE" only ever come from stringifying a
# null, which `text_cell` handles before it can look like a token.
MISSING_ISO_TOKENS = frozenset({"-99", ""})

# Natural Earth's CONTINENT for eight island groups, none of which is a region
# a reader recognises in a breadcrumb ("Countries · Seven seas (open ocean) ·
# Maldives"). REGION_UN places each of them on a real continent instead.
OPEN_OCEAN = "Seven seas (open ocean)"

# The admin-0 columns every consumer here needs. Passed to geopandas so the
# geometry column is only carried when a caller actually wants areas.
REGISTRY_COLUMNS: tuple[str, ...] = (
    "NAME_EN",
    "NAME",
    "ISO_A2",
    "ISO_A2_EH",
    "ADM0_A3",
    "CONTINENT",
    "REGION_UN",
    "POP_EST",
)


@dataclass(frozen=True)
class CountryEntry:
    """One routable country: what the web registry and the API both key off."""

    slug: str
    name: str
    iso2: str
    region: str
    adm0_a3: str

    def as_dict(self) -> dict[str, str]:
        return {
            "slug": self.slug,
            "name": self.name,
            "iso2": self.iso2,
            "region": self.region,
        }


def slugify(name: str) -> str:
    """URL slug for a place name. Mirrors ``regionSlug`` in the web."""
    decomposed = unicodedata.normalize("NFD", name)
    stripped = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    lowered = stripped.lower()
    out: list[str] = []
    for ch in lowered:
        out.append(ch if ch.isascii() and ch.isalnum() else "-")
    slug = "".join(out)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")


def text_cell(value: object) -> str:
    """Stringify a cell, mapping nulls to ``''`` *before* they become "nan"."""
    if value is None:
        return ""
    if isinstance(value, float) and value != value:  # NaN
        return ""
    return str(value).strip()


def iso_a2(row: dict[str, object]) -> str:
    """ISO-2 for one row, ``''`` when Natural Earth has none.

    ``ISO_A2_EH`` first because it resolves several disputed territories that
    ``ISO_A2`` leaves at the ``-99`` sentinel — the same preference order the
    pipeline applies when it stamps ``iso_a2`` onto country features.
    """
    for column in ("ISO_A2_EH", "ISO_A2"):
        value = text_cell(row.get(column)).upper()
        if value not in MISSING_ISO_TOKENS:
            return value
    return ""


def region_of(row: dict[str, object]) -> str:
    continent = text_cell(row.get("CONTINENT"))
    if continent == OPEN_OCEAN:
        return text_cell(row.get("REGION_UN")) or continent
    return continent


def _population(row: dict[str, object]) -> float:
    try:
        return float(row.get("POP_EST") or 0.0)
    except (TypeError, ValueError):
        return 0.0


def prefer(candidate: dict[str, object], incumbent: dict[str, object]) -> bool:
    """Which of two rows sharing an ISO-2 code owns it.

    Natural Earth files small dependencies under their parent's code via
    ``ISO_A2_EH`` — ``AU`` covers Australia, the Australian Indian Ocean
    Territories and Ashmore and Cartier Islands. The row whose *own* ``ISO_A2``
    is set is the country the code actually belongs to; population breaks any
    remaining tie so the result does not depend on file order.
    """

    def own_code(row: dict[str, object]) -> bool:
        return text_cell(row.get("ISO_A2")).upper() not in MISSING_ISO_TOKENS

    if own_code(candidate) != own_code(incumbent):
        return own_code(candidate)
    return _population(candidate) > _population(incumbent)


def owning_rows(rows: list[dict[str, object]]) -> dict[str, dict[str, object]]:
    """ISO-2 → the single admin-0 row that code belongs to.

    Rows with no ISO-2 (Somaliland, Northern Cyprus, the Siachen Glacier) are
    dropped: they are painted but carry no code in the tiles either, so there
    is nothing to key an entry on — non-routable by construction.
    """
    by_iso: dict[str, dict[str, object]] = {}
    skipped: list[str] = []
    for row in rows:
        code = iso_a2(row)
        if not code:
            skipped.append(text_cell(row.get("NAME_EN")) or "<unnamed>")
            continue
        incumbent = by_iso.get(code)
        if incumbent is None or prefer(row, incumbent):
            by_iso[code] = row
    if skipped:
        log.info(
            "%d admin-0 polygon(s) have no ISO-3166-1 alpha-2 code and are "
            "painted but not routable: %s",
            len(skipped),
            ", ".join(sorted(skipped)),
        )
    return by_iso


def build_registry(rows: list[dict[str, object]]) -> list[CountryEntry]:
    """Admin-0 rows → one entry per ISO-2 code, sorted by name.

    Raises on a slug collision rather than letting two countries fight over
    one URL — the registry and the published API bundle are both keyed by
    slug, so a collision is a page silently serving the wrong country.
    """
    entries: list[CountryEntry] = []
    for code, row in owning_rows(rows).items():
        name = NAME_OVERRIDES.get(
            code, text_cell(row.get("NAME_EN")) or text_cell(row.get("NAME"))
        )
        entries.append(
            CountryEntry(
                slug=slugify(name),
                name=name,
                iso2=code,
                region=region_of(row),
                adm0_a3=text_cell(row.get("ADM0_A3")).upper(),
            )
        )

    entries.sort(key=lambda e: e.name)

    slugs = [e.slug for e in entries]
    duplicates = sorted({s for s in slugs if slugs.count(s) > 1})
    if duplicates:
        raise ValueError(f"slug collision(s): {duplicates}")
    return entries


def registry_rows_from_gdf(gdf: object) -> list[dict[str, object]]:
    """Pull the registry columns out of a GeoDataFrame as plain dicts."""
    columns = [c for c in REGISTRY_COLUMNS if c in getattr(gdf, "columns", [])]
    return gdf[columns].to_dict("records")  # type: ignore[index]
