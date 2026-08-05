"""Regenerate the ``MAINLAND_WHITELIST`` table in ``processing/country_rules.py``.

The whitelist is an opt-in set of admin-1 codes allowed to contribute to a
country-level climate aggregate (see ``REBUILD_PLAN.md`` § Phase 3a). Hand-
curating it is what broke it the first time: the original table was written
against 2016-era region codes (``FR-ARA``, ``GB-ENG``) that do not appear in
the Natural Earth 1:10m admin-1 layer at all, so every whitelisted country
silently fell back to a naive aggregate that still included its overseas
territory.

This script derives the set from Natural Earth's own structural attributes —
``type_en`` marks overseas departments, special municipalities and
territories; ``region`` marks island groups — and prints the Python literal to
paste into ``country_rules.py``. The result is checked in so the pipeline has
no runtime dependency on this script, and so the table stays diffable.

Usage::

    uv run --directory pipeline python scripts/generate_mainland_whitelist.py \
        [path/to/ne_10m_admin_1_states_provinces.zip]

Re-run it whenever the Natural Earth admin-1 vintage changes, and eyeball the
diff before committing.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Per-country exclusion rules, expressed against Natural Earth attributes.
# `types` / `regions` list the values that must be EXCLUDED from the country
# mean; `codes` excludes specific iso_3166_2 values that no attribute isolates.
EXCLUSIONS: dict[str, dict[str, set[str]]] = {
    # Metropolitan France only. NE labels the five overseas departments
    # (Guyane, Martinique, Guadeloupe, Réunion, Mayotte) distinctly.
    "FR": {"types": {"Overseas department"}},
    # Iberian peninsula + Balearics. Drops the Canaries (an Atlantic island
    # group ~1,800km south) and the North African enclaves Ceuta / Melilla,
    # which NE types as "Autonomous City".
    "ES": {"types": {"Autonomous City"}, "regions": {"Canary Is."}},
    # European provinces only. Bonaire / Saba / Sint Eustatius are Caribbean
    # "Special Municipality" units.
    "NL": {"types": {"Special Municipality"}},
    # Mainland Portugal. Azores and Madeira are typed "Autonomous region".
    "PT": {"types": {"Autonomous region"}},
    # Mainland Norway. Svalbard is typed "Territory"; Bouvet Island (a
    # sub-Antarctic dependency) carries no type at all, so it is named.
    "NO": {"types": {"Territory"}, "codes": {"NO-X01~"}},
    # Continental Ecuador. Galápagos is a plain "Province" ~1,000km offshore,
    # so no attribute isolates it — exclude by code.
    "EC": {"codes": {"EC-W"}},
    # Denmark's five regions are all mainland/Baltic; Greenland and the Faroes
    # are separate ISO countries in Natural Earth and never appear under DK.
    # Listed anyway so the entry is opt-in rather than implicit.
    "DK": {},
}

# Countries deliberately NOT whitelisted, with the reason. Kept here so the
# decision is recorded next to the rules rather than lost in a commit message.
NO_WHITELIST_NEEDED = {
    "GB": (
        "All 232 UK admin-1 units in the 10m layer are domestic. Gibraltar, "
        "the Falklands and the other overseas territories are separate admin-0 "
        "entries with their own ISO codes (GI, FK, ...), so they never reach "
        "the GB aggregate."
    ),
}

DEFAULT_ZIP = (
    Path(__file__).resolve().parents[1]
    / "data/raw/geoboundaries/natural_earth/ne_10m_admin_1_states_provinces.zip"
)


def main() -> int:
    zip_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_ZIP
    if not zip_path.exists():
        print(f"boundary file not found: {zip_path}", file=sys.stderr)
        print("run `wtg download boundaries --source naturalearth` first", file=sys.stderr)
        return 1

    import geopandas as gpd

    gdf = gpd.read_file(f"zip://{zip_path}")
    gdf["iso_a2"] = gdf["iso_a2"].astype(str).str.strip().str.upper()

    lines: list[str] = []
    for iso in sorted(EXCLUSIONS):
        rule = EXCLUSIONS[iso]
        sub = gdf[gdf["iso_a2"] == iso]
        if sub.empty:
            print(f"WARNING: no admin-1 polygons for {iso}", file=sys.stderr)
            continue

        drop = sub["iso_3166_2"].isin(rule.get("codes", set()))
        if rule.get("types"):
            drop |= sub["type_en"].astype(str).isin(rule["types"])
        if rule.get("regions"):
            drop |= sub["region"].astype(str).isin(rule["regions"])

        kept = sorted(sub.loc[~drop, "iso_3166_2"].astype(str).unique())
        dropped = sorted(sub.loc[drop, "iso_3166_2"].astype(str).unique())
        dropped_names = sorted(sub.loc[drop, "name_en"].astype(str).unique())

        lines.append(f'    "{iso}": frozenset(')
        lines.append("        {")
        for code in kept:
            lines.append(f'            "{code}",')
        lines.append("        }")
        lines.append("    ),")

        print(
            f"{iso}: keep {len(kept)}, drop {len(dropped)} "
            f"({', '.join(dropped_names) if dropped_names else 'none'})",
            file=sys.stderr,
        )

    print("MAINLAND_WHITELIST: dict[str, frozenset[str]] = {")
    print("\n".join(lines))
    print("}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
