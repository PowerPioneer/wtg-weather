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

The rule itself lives in :mod:`wtg_pipeline.processing.country_registry`,
shared with ``wtg publish api-data``: the API names its per-country files by
the same slug the registry hands to ``generateStaticParams``, and a slug the
API cannot answer for is a build-time 404.

Usage::

    uv run --directory pipeline python scripts/generate_country_registry.py \\
        [path/to/ne_50m_admin_0_countries.zip]

Writes the TypeScript file in place and prints a summary to stderr. Re-run it
whenever the Natural Earth admin-0 vintage changes.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from wtg_pipeline.processing.country_registry import (
    CountryEntry,
    build_registry,
    registry_rows_from_gdf,
)

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PIPELINE_ROOT.parent

DEFAULT_ZIP = PIPELINE_ROOT / "data/raw/geoboundaries/natural_earth/ne_50m_admin_0_countries.zip"
OUTPUT = REPO_ROOT / "web/src/lib/countries.generated.ts"


def render(entries: list[CountryEntry], *, source: str) -> str:
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
        " *",
        " * The slugs here are the same ones `wtg publish api-data` names its",
        " * per-country files with — both come from",
        " * `wtg_pipeline.processing.country_registry`.",
        " */",
        "",
        'import type { CountryRef } from "./countries";',
        "",
        "export const GENERATED_COUNTRIES: readonly CountryRef[] = [",
    ]
    for entry in entries:
        record = entry.as_dict()
        fields = ", ".join(
            f"{key}: {json.dumps(record[key], ensure_ascii=False)}"
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
    entries = build_registry(registry_rows_from_gdf(gdf))
    OUTPUT.write_text(render(entries, source=zip_path.stem), encoding="utf-8")

    by_region: dict[str, int] = {}
    for entry in entries:
        by_region[entry.region] = by_region.get(entry.region, 0) + 1
    print(f"wrote {OUTPUT.relative_to(REPO_ROOT)} — {len(entries)} countries", file=sys.stderr)
    for region, count in sorted(by_region.items()):
        print(f"  {region or '<no continent>'}: {count}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
