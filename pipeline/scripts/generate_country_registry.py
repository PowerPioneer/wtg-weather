"""Regenerate ``web/src/lib/countries.generated.ts`` from Natural Earth.

The web's country registry maps the ``iso_a2`` a tile feature carries onto a
name and a URL slug. It used to be nine hand-typed entries, so the map's click
handler resolved nine countries and silently did nothing everywhere else.

Deriving it here rather than hand-typing it keeps three things true:

* the codes are exactly the ones the tiles carry — this reads the same
  ``ne_50m_admin_0_countries.zip`` the pipeline's country layer is built from,
  and applies the same ``-99`` sentinel blanking (see
  ``pipeline_runner._normalise_country_iso_a2``), so a polygon that is painted
  is a polygon the registry can name;
* dependencies that Natural Earth files under a parent's ISO-2 (Ashmore and
  Cartier Islands under ``AU``) resolve to the parent rather than to nothing;
* the table is diffable — regenerate, eyeball the diff, commit.

Usage::

    uv run --directory pipeline python scripts/generate_country_registry.py \\
        [path/to/ne_50m_admin_0_countries.zip]

Writes the TypeScript file in place and prints a summary to stderr. Re-run it
whenever the Natural Earth admin-0 vintage changes.
"""

from __future__ import annotations

import json
import sys
import unicodedata
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PIPELINE_ROOT.parent

DEFAULT_ZIP = PIPELINE_ROOT / "data/raw/geoboundaries/natural_earth/ne_50m_admin_0_countries.zip"
OUTPUT = REPO_ROOT / "web/src/lib/countries.generated.ts"

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
# null, which `_text` handles before it can look like a token.
MISSING_ISO_TOKENS = frozenset({"-99", ""})


def slugify(name: str) -> str:
    """URL slug for a country name. Mirrors ``web/src/lib/regions.ts``."""
    decomposed = unicodedata.normalize("NFD", name)
    stripped = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    lowered = stripped.lower()
    out: list[str] = []
    for ch in lowered:
        out.append(ch if ch.isascii() and (ch.isalnum()) else "-")
    slug = "".join(out)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")


def _text(value: object) -> str:
    """Stringify a cell, mapping nulls to ``''`` *before* they become "nan"."""
    if value is None:
        return ""
    if isinstance(value, float) and value != value:  # NaN
        return ""
    return str(value).strip()


def _iso_a2(row: dict[str, object]) -> str:
    """ISO-2 for one row, ``''`` when Natural Earth has none.

    ``ISO_A2_EH`` first because it resolves several disputed territories that
    ``ISO_A2`` leaves at the ``-99`` sentinel — the same preference order the
    pipeline applies when it stamps ``iso_a2`` onto country features.
    """
    for column in ("ISO_A2_EH", "ISO_A2"):
        value = _text(row.get(column)).upper()
        if value not in MISSING_ISO_TOKENS:
            return value
    return ""


# Natural Earth's CONTINENT for eight island groups, none of which is a region
# a reader recognises in a breadcrumb ("Countries · Seven seas (open ocean) ·
# Maldives"). REGION_UN places each of them on a real continent instead.
OPEN_OCEAN = "Seven seas (open ocean)"


def _region(row: dict[str, object]) -> str:
    continent = _text(row.get("CONTINENT"))
    if continent == OPEN_OCEAN:
        return _text(row.get("REGION_UN")) or continent
    return continent


def _population(row: dict[str, object]) -> float:
    try:
        return float(row.get("POP_EST") or 0.0)
    except (TypeError, ValueError):
        return 0.0


def _prefer(candidate: dict[str, object], incumbent: dict[str, object]) -> bool:
    """Which of two rows sharing an ISO-2 code owns it.

    Natural Earth files small dependencies under their parent's code via
    ``ISO_A2_EH`` — ``AU`` covers Australia, the Australian Indian Ocean
    Territories and Ashmore and Cartier Islands. The row whose *own* ``ISO_A2``
    is set is the country the code actually belongs to; population breaks any
    remaining tie so the result does not depend on file order.
    """

    def own_code(row: dict[str, object]) -> bool:
        return _text(row.get("ISO_A2")).upper() not in MISSING_ISO_TOKENS

    if own_code(candidate) != own_code(incumbent):
        return own_code(candidate)
    return _population(candidate) > _population(incumbent)


def build_registry(rows: list[dict[str, object]]) -> list[dict[str, str]]:
    """Rows → one entry per ISO-2 code, sorted by name."""
    by_iso: dict[str, dict[str, object]] = {}
    skipped: list[str] = []

    for row in rows:
        iso2 = _iso_a2(row)
        name = _text(row.get("NAME_EN")) or _text(row.get("NAME"))
        if not iso2:
            # Somaliland, Northern Cyprus, the Siachen Glacier. Still painted,
            # but they carry no ISO-2 in the tiles either, so there is nothing
            # to key a registry entry on — non-routable by construction.
            skipped.append(name or "<unnamed>")
            continue
        incumbent = by_iso.get(iso2)
        if incumbent is None or _prefer(row, incumbent):
            by_iso[iso2] = row

    entries: list[dict[str, str]] = []
    for iso2, row in by_iso.items():
        name = NAME_OVERRIDES.get(iso2, _text(row.get("NAME_EN")) or _text(row.get("NAME")))
        entries.append(
            {
                "slug": slugify(name),
                "name": name,
                "iso2": iso2,
                "region": _region(row),
            }
        )

    entries.sort(key=lambda e: e["name"])

    slugs = [e["slug"] for e in entries]
    duplicates = {s for s in slugs if slugs.count(s) > 1}
    if duplicates:
        raise SystemExit(f"slug collision(s): {sorted(duplicates)}")

    if skipped:
        print(
            f"skipped {len(skipped)} polygon(s) with no ISO-3166-1 alpha-2 code "
            f"(painted but non-routable): {', '.join(sorted(skipped))}",
            file=sys.stderr,
        )
    return entries


def render(entries: list[dict[str, str]], *, source: str) -> str:
    lines = [
        "/**",
        " * GENERATED FILE — do not edit by hand.",
        " *",
        " * Regenerate with:",
        " *   uv run --directory pipeline python scripts/generate_country_registry.py",
        " *",
        f" * Source: Natural Earth {source} — the same admin-0 layer the pipeline",
        " * builds the tiles' `country` level from, with the same `-99` sentinel",
        " * blanking. Every ISO-2 code a painted polygon can carry appears here, so",
        " * the map's click handler resolves a name and a slug for all of them.",
        " *",
        " * Territories Natural Earth files under a parent's code (Ashmore and",
        " * Cartier Islands under `AU`) collapse onto the parent, which is what the",
        " * map should navigate to. Polygons with no ISO-2 at all (Somaliland,",
        " * Northern Cyprus, the Siachen Glacier) are absent: they are painted but",
        " * non-routable, exactly as the pipeline leaves them.",
        " */",
        "",
        'import type { CountryRef } from "./countries";',
        "",
        "export const GENERATED_COUNTRIES: readonly CountryRef[] = [",
    ]
    for entry in entries:
        fields = ", ".join(
            f"{key}: {json.dumps(entry[key], ensure_ascii=False)}"
            for key in ("slug", "name", "iso2", "region")
        )
        lines.append(f"  {{ {fields} }},")
    lines.append("];")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    zip_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_ZIP
    if not zip_path.exists():
        print(f"boundary file not found: {zip_path}", file=sys.stderr)
        print("run `wtg download boundaries --source naturalearth` first", file=sys.stderr)
        return 1

    import geopandas as gpd

    gdf = gpd.read_file(f"zip://{zip_path}")
    columns = [
        c
        for c in (
            "NAME_EN",
            "NAME",
            "ISO_A2",
            "ISO_A2_EH",
            "CONTINENT",
            "REGION_UN",
            "POP_EST",
        )
        if c in gdf.columns
    ]
    rows = gdf[columns].to_dict("records")

    entries = build_registry(rows)
    OUTPUT.write_text(render(entries, source=zip_path.stem), encoding="utf-8")

    by_region: dict[str, int] = {}
    for entry in entries:
        by_region[entry["region"]] = by_region.get(entry["region"], 0) + 1
    print(f"wrote {OUTPUT.relative_to(REPO_ROOT)} — {len(entries)} countries", file=sys.stderr)
    for region, count in sorted(by_region.items()):
        print(f"  {region or '<no continent>'}: {count}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
