"""Generate the subdivision gazetteer used to resolve advisory carve-outs.

Governments name the area a carve-out applies to in prose — "Jammu and
Kashmir", "the southeast of Fukushima", "Cabo Delgado" — and the advisory
schema wants an ISO-3166-2 code so the level can be attached to a polygon.
This script builds the lookup that turns one into the other.

Source: **the same** ``ne_10m_admin_1_states_provinces`` layer the tiles'
admin-1 level is built from. That is deliberate, and the same rule
``generate_country_registry.py`` follows: a gazetteer from a different vintage
would resolve names to codes that no polygon carries, and the advisory would
attach to nothing while looking like it worked.

Output: ``src/wtg_pipeline/processing/subdivisions.json``, shaped
``{"<ISO-2>": {"<folded name>": "<ISO-3166-2>"}}``.

Rules, all of them about not being wrong:

* Only subdivisions whose ``iso_3166_2`` is populated, prefixed with their
  country's ISO-2 code, and shaped like a real ISO-3166-2 code. The 10m layer
  has blanks, a few mismatches, and ~200 Natural Earth placeholders of the
  form ``AQ-X01~`` for units ISO has not assigned a code to. A placeholder
  resolves to no polygon the web can key off and is rejected downstream by
  ``processing.advisories.REGION_CODE_RE`` anyway; keeping it out here means
  the gazetteer cannot suggest one in the first place.
* Both ``name_en`` and the local ``name`` are indexed — governments use either.
* A name shorter than four characters is dropped. Two- and three-letter names
  ("Ica", "Uri") match inside unrelated words and prose far too easily.
* If two subdivisions of the same country fold to the same name, **both** are
  dropped. An ambiguous name resolved to whichever row came first is how a
  province gets someone else's travel advisory.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wtg_pipeline.config import boundaries_raw_dir  # noqa: E402
from wtg_pipeline.processing.advisories import REGION_CODE_RE  # noqa: E402
from wtg_pipeline.sources import geoboundaries  # noqa: E402

OUT_PATH = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "wtg_pipeline"
    / "processing"
    / "subdivisions.json"
)

MIN_NAME_LENGTH = 4


def fold(text: str) -> str:
    """Lowercase, drop diacritics, punctuation to spaces, collapse runs.

    Word boundaries are preserved — unlike the country-name folds elsewhere —
    because these names are matched *inside* prose, and "Kashmir" must not be
    found inside "Kashmirish" or across a word break.
    """
    decomposed = unicodedata.normalize("NFKD", text or "")
    ascii_only = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^a-z0-9]+", " ", ascii_only.casefold()).split())


def main() -> int:
    import geopandas as gpd

    zip_path = (
        boundaries_raw_dir() / "natural_earth" / geoboundaries.NATURAL_EARTH_ADMIN1_FILENAME
    )
    if not zip_path.exists():
        print(f"missing {zip_path}; run `wtg download boundaries --source naturalearth`")
        return 1

    gdf = gpd.read_file(f"zip://{zip_path}")
    candidates: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))

    for row in gdf.itertuples(index=False):
        code = str(getattr(row, "iso_3166_2", "") or "").strip().upper()
        country = str(getattr(row, "iso_a2", "") or "").strip().upper()
        if not code or not country or country == "-99":
            continue
        if not REGION_CODE_RE.match(code):
            # Natural Earth placeholder (`AQ-X01~`) or otherwise not a code.
            continue
        if not code.startswith(f"{country}-"):
            # The 10m layer carries a few subdivisions whose code does not
            # match the country column. Trusting either one over the other
            # would be a guess.
            continue
        for attribute in ("name_en", "name"):
            name = fold(str(getattr(row, attribute, "") or ""))
            if len(name) >= MIN_NAME_LENGTH:
                candidates[country][name].add(code)

    gazetteer: dict[str, dict[str, str]] = {}
    ambiguous = 0
    for country, names in sorted(candidates.items()):
        resolved = {}
        for name, codes in sorted(names.items()):
            if len(codes) == 1:
                resolved[name] = next(iter(codes))
            else:
                ambiguous += 1
        if resolved:
            gazetteer[country] = resolved

    OUT_PATH.write_text(
        json.dumps(gazetteer, indent=0, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    total = sum(len(v) for v in gazetteer.values())
    print(f"wrote {OUT_PATH}")
    print(f"  {len(gazetteer)} countries, {total} names, {ambiguous} dropped as ambiguous")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
