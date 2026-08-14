"""Content checks against the built PMTiles archives.

Every other test in this suite checks the code that *produces* tiles. This one
checks what actually landed in them, which is the gap that let two defects ship
unnoticed:

* the admin-1 layer covered 9 countries instead of ~240, because the pipeline
  downloaded Natural Earth at 1:50m (which only subdivides large countries)
  rather than 1:10m. Countries on the suppression list that were missing an
  admin-1 mosaic — Argentina, Chile, Kazakhstan — rendered as permanent holes;
  every other country vanished in the mid-zoom band.
* the premium archive had no admin-2 layer at all, so the tier's headline
  feature was silently absent.

Skipped when the archives have not been built. Run the pipeline first::

    uv run --directory pipeline wtg pipeline full
"""

from __future__ import annotations

import gzip
from collections import defaultdict
from pathlib import Path

import pytest

from wtg_pipeline.processing.country_rules import SUPPRESSED_COUNTRIES

pmtiles_reader = pytest.importorskip("pmtiles.reader")
mapbox_vector_tile = pytest.importorskip("mapbox_vector_tile")

TILE_DIR = Path(__file__).resolve().parents[2] / "tiles"

# Natural Earth 1:10m carries ~240 countries at admin-1. Anything far below
# that means the wrong source scale, so the threshold sits well under the
# real number but far above the 9 the 50m layer yields.
MIN_ADMIN1_COUNTRIES = 150
MIN_COUNTRY_COUNTRIES = 180

# Sentinel Natural Earth writes where a polygon has no ISO-3166-1 alpha-2
# code. It must never reach the tiles — the web keys country routing off
# `iso_a2` and would treat it as a country.
MISSING_ISO_SENTINEL = "-99"


def _read_layers(path: Path, max_zoom: int) -> dict[str, set[str]]:
    """Map layer name → set of distinct `iso_a2` values, scanning low zooms."""
    from pmtiles.reader import MmapSource, Reader, all_tiles

    per_layer: dict[str, set[str]] = defaultdict(set)
    with path.open("rb") as handle:
        reader = Reader(MmapSource(handle))
        for (zoom, _x, _y), data in all_tiles(reader.get_bytes):
            if zoom > max_zoom:
                continue
            try:
                raw = gzip.decompress(data)
            except OSError:
                raw = data
            for layer_name, layer in mapbox_vector_tile.decode(raw).items():
                for feature in layer["features"]:
                    iso = str(feature.get("properties", {}).get("iso_a2", ""))
                    per_layer[layer_name].add(iso.upper())
    return per_layer


def _layer_names(path: Path) -> set[str]:
    from pmtiles.reader import MmapSource, Reader

    with path.open("rb") as handle:
        metadata = Reader(MmapSource(handle)).metadata()
    return {layer["id"] for layer in metadata.get("vector_layers", [])}


@pytest.fixture(scope="module")
def free_tiles() -> Path:
    path = TILE_DIR / "free.pmtiles"
    if not path.exists():
        pytest.skip(f"{path} not built")
    return path


@pytest.fixture(scope="module")
def premium_tiles() -> Path:
    path = TILE_DIR / "premium.pmtiles"
    if not path.exists():
        pytest.skip(f"{path} not built")
    return path


@pytest.fixture(scope="module")
def free_layers(free_tiles: Path) -> dict[str, set[str]]:
    return _read_layers(free_tiles, max_zoom=3)


def test_free_tiles_have_country_and_admin1_layers(free_tiles: Path) -> None:
    assert {"country", "admin1"} <= _layer_names(free_tiles)


def test_premium_tiles_have_admin2_layer(premium_tiles: Path) -> None:
    # The premium tier exists to sell district-level detail. Without this
    # layer the archive is the free one at a higher max zoom.
    assert "admin2" in _layer_names(premium_tiles)


def test_premium_tiles_carry_the_base_levels_too(premium_tiles: Path) -> None:
    # An entitled session reads country and admin-1 from the premium archive,
    # not the free one, because the premium-only variables exist nowhere else
    # (see web/src/lib/map-style.ts). If the archive ships without them, a
    # paying user gets a blank map at every zoom below admin-2.
    assert {"country", "admin1"} <= _layer_names(premium_tiles)


def test_admin1_covers_most_countries(free_layers: dict[str, set[str]]) -> None:
    countries = {iso for iso in free_layers.get("admin1", set()) if iso}
    assert len(countries) >= MIN_ADMIN1_COUNTRIES, (
        f"admin-1 covers only {len(countries)} countries "
        f"({sorted(countries)}) — this is what a 1:50m Natural Earth download "
        f"looks like; the pipeline needs the 1:10m admin-1 layer"
    )


def test_country_layer_covers_most_countries(free_layers: dict[str, set[str]]) -> None:
    countries = {iso for iso in free_layers.get("country", set()) if iso}
    assert len(countries) >= MIN_COUNTRY_COUNTRIES


def test_suppressed_countries_have_an_admin1_mosaic(
    free_layers: dict[str, set[str]],
) -> None:
    # Suppressed countries emit no country-level row by design, so the web
    # paints their admin-1 polygons at country zoom instead. If those are
    # missing too, the country is a hole at every zoom level.
    admin1 = free_layers.get("admin1", set())
    missing = sorted(iso for iso in SUPPRESSED_COUNTRIES if iso not in admin1)
    assert not missing, (
        f"{missing} are suppressed at country level but have no admin-1 "
        f"polygons to render as a mosaic — they would be invisible on the map"
    )


def test_suppressed_countries_absent_from_country_layer(
    free_layers: dict[str, set[str]],
) -> None:
    present = sorted(
        iso for iso in SUPPRESSED_COUNTRIES if iso in free_layers.get("country", set())
    )
    assert not present, f"{present} should have no country-level row"


@pytest.mark.parametrize("layer", ["country", "admin1"])
def test_no_missing_iso_sentinel(free_layers: dict[str, set[str]], layer: str) -> None:
    assert MISSING_ISO_SENTINEL not in free_layers.get(layer, set())


def test_free_tiles_reach_the_documented_max_zoom(free_tiles: Path) -> None:
    # pipeline/CLAUDE.md pins tippecanoe to `-Z0 -z5` for the free tier, and
    # web/src/lib/map-style.ts hands over from country to admin-1 at zoom 3.5.
    from pmtiles.reader import MmapSource, Reader

    with free_tiles.open("rb") as handle:
        header = Reader(MmapSource(handle)).header()
    assert header["min_zoom"] == 0
    assert header["max_zoom"] >= 5


def _admin1_ids_by_zoom(path: Path) -> dict[int, set[str]]:
    """Distinct admin-1 polygon ids present at each zoom level."""
    from pmtiles.reader import MmapSource, Reader, all_tiles

    per_zoom: dict[int, set[str]] = defaultdict(set)
    with path.open("rb") as handle:
        reader = Reader(MmapSource(handle))
        for (zoom, _x, _y), data in all_tiles(reader.get_bytes):
            try:
                raw = gzip.decompress(data)
            except OSError:
                raw = data
            decoded = mapbox_vector_tile.decode(raw)
            if "admin1" not in decoded:
                continue
            for feature in decoded["admin1"]["features"]:
                per_zoom[zoom].add(str(feature.get("properties", {}).get("id", "")))
    return per_zoom


def _admin1_total(path: Path) -> int:
    from pmtiles.reader import MmapSource, Reader

    with path.open("rb") as handle:
        metadata = Reader(MmapSource(handle)).metadata()
    for layer in metadata.get("tilestats", {}).get("layers", []):
        if layer.get("layer") == "admin1":
            return int(layer["count"])
    raise AssertionError("no admin1 entry in tilestats")


@pytest.fixture(scope="module")
def free_admin1_by_zoom(free_tiles: Path) -> dict[int, set[str]]:
    return _admin1_ids_by_zoom(free_tiles)


def test_admin1_is_complete_above_the_country_handover(
    free_tiles: Path, free_admin1_by_zoom: dict[int, set[str]]
) -> None:
    """The regression that shipped holes into production.

    Counting features across the whole archive is not enough — coverage is
    per zoom, and tippecanoe was pruning polygons to fit the tile byte budget.
    Above zoom 3.5 the country layer has handed over and nothing paints
    underneath admin-1, so every pruned polygon there is a hole on the map.
    Measured before the fix: 42% of source at z4, 61% at z5.
    """
    total = _admin1_total(free_tiles)
    for zoom, ids in sorted(free_admin1_by_zoom.items()):
        if zoom < 4:
            continue
        coverage = len(ids) / total
        assert coverage >= 0.98, (
            f"z{zoom} carries only {len(ids)}/{total} admin-1 polygons "
            f"({coverage:.0%}) — every missing one is a hole on the map"
        )


def test_admin1_mostly_present_at_the_handover_zoom(
    free_tiles: Path, free_admin1_by_zoom: dict[int, set[str]]
) -> None:
    # z3 tiles serve display zooms 3.0-3.99, and the country layer only covers
    # the first half of that band, so coverage here still has to be high.
    total = _admin1_total(free_tiles)
    ids = free_admin1_by_zoom.get(3, set())
    assert len(ids) / total >= 0.65


def test_suppressed_country_mosaics_survive_the_minzoom_hint(
    free_admin1_by_zoom: dict[int, set[str]],
) -> None:
    """admin-1 is hinted to minzoom 3 — except for suppressed countries.

    Those emit no country-level row, so the web paints their admin-1 polygons
    as a mosaic below zoom 3. If the hint were applied to them the mosaic
    would be empty and they would be holes at world zoom.
    """
    low_zoom = free_admin1_by_zoom.get(0, set()) | free_admin1_by_zoom.get(1, set())
    assert low_zoom, "no admin-1 features at world zoom — the mosaic is empty"
    # Non-suppressed admin-1 should be largely hinted away down here, so the
    # low-zoom set stays small; the mosaic countries alone account for it.
    assert len(low_zoom) < 1000


# Short per-month aliases the web's preference scoring reads. `scoring.ts`
# scores these three directly when a user has set their own preferences, and
# falls back to the baked `pref_<mm>` when they are default — so a level
# missing either is a level the map's hero display mode paints grey.
SCORING_ALIASES = ("t", "r", "s")
MONTH_SUFFIXES = tuple(f"{month:02d}" for month in range(1, 13))


def _sample_scoring_props(
    path: Path, max_zoom: int, per_zoom_budget: int = 40
) -> dict[str, dict[str, object]]:
    """Per layer: how many sampled features carry a full year of each alias.

    Sampled rather than exhaustive because the premium archive is ~1.5GB and
    this is a shape check, not a coverage check — the coverage tests above
    already scan the free archive in full.
    """
    from pmtiles.reader import MmapSource, Reader, all_tiles

    stats: dict[str, dict[str, object]] = defaultdict(
        lambda: {"features": 0, "missing": [], "pref_values": set()}
    )
    budget: dict[int, int] = defaultdict(int)

    with path.open("rb") as handle:
        reader = Reader(MmapSource(handle))
        for (zoom, _x, _y), data in all_tiles(reader.get_bytes):
            if zoom > max_zoom or budget[zoom] >= per_zoom_budget:
                continue
            budget[zoom] += 1
            try:
                raw = gzip.decompress(data)
            except OSError:
                raw = data
            for layer_name, layer in mapbox_vector_tile.decode(raw).items():
                entry = stats[layer_name]
                for feature in layer["features"]:
                    props = feature.get("properties", {})
                    entry["features"] = int(entry["features"]) + 1
                    absent = [
                        f"{alias}_{mm}"
                        for alias in (*SCORING_ALIASES, "pref")
                        for mm in MONTH_SUFFIXES
                        if f"{alias}_{mm}" not in props
                    ]
                    if absent:
                        missing = entry["missing"]
                        assert isinstance(missing, list)
                        if len(missing) < 5:
                            missing.append(
                                (str(props.get("id", "?")), absent[:4], len(absent))
                            )
                    pref = props.get("pref_01")
                    if pref is not None:
                        values = entry["pref_values"]
                        assert isinstance(values, set)
                        values.add(pref)
    return stats


@pytest.fixture(scope="module")
def free_scoring_props(free_tiles: Path) -> dict[str, dict[str, object]]:
    return _sample_scoring_props(free_tiles, max_zoom=3)


@pytest.fixture(scope="module")
def premium_scoring_props(premium_tiles: Path) -> dict[str, dict[str, object]]:
    # Reaches zoom 6 so the admin-2 layer — hinted to minzoom 6 — is sampled
    # at all. It is the level that never existed before the premium rebuild,
    # and the one nothing had ever checked the scoring inputs on.
    return _sample_scoring_props(premium_tiles, max_zoom=6)


@pytest.mark.parametrize("layer", ["country", "admin1"])
def test_free_levels_carry_the_preference_scoring_inputs(
    free_scoring_props: dict[str, dict[str, object]], layer: str
) -> None:
    _assert_scoring_inputs(free_scoring_props, layer)


@pytest.mark.parametrize("layer", ["country", "admin1", "admin2"])
def test_premium_levels_carry_the_preference_scoring_inputs(
    premium_scoring_props: dict[str, dict[str, object]], layer: str
) -> None:
    """The gap the premium rebuild finally made checkable.

    Nothing verified that a feature carries what the map scores from. A level
    missing `t_/r_/s_` cannot be scored against a user's own preferences, and
    one missing `pref_<mm>` paints grey on the default map — silently, in the
    one display mode the site leads with.
    """
    _assert_scoring_inputs(premium_scoring_props, layer)


def _assert_scoring_inputs(stats: dict[str, dict[str, object]], layer: str) -> None:
    entry = stats.get(layer)
    assert entry and entry["features"], f"no {layer} features sampled"
    missing = entry["missing"]
    assert not missing, (
        f"{layer}: features missing preference-scoring properties "
        f"(id, first absent keys, total absent): {missing}"
    )


def test_baked_preference_scores_are_on_the_documented_ladder(
    free_scoring_props: dict[str, dict[str, object]],
    premium_scoring_props: dict[str, dict[str, object]],
) -> None:
    """`pref_<mm>` must be exactly the four values the web bins on.

    `web/src/lib/scoring.ts` mirrors this table as `BUCKET_SCORES`, and its
    paint expression reads the baked property verbatim whenever preferences
    are default. A fifth value here, or a shifted one, lands in a bin nobody
    intended and the mirror test on the web side would not see it.
    """
    from wtg_pipeline.tiles.build_geojson import SCORE_TO_PREF

    allowed = set(SCORE_TO_PREF.values())
    for tier, stats in (("free", free_scoring_props), ("premium", premium_scoring_props)):
        for layer, entry in sorted(stats.items()):
            values = entry["pref_values"]
            assert isinstance(values, set)
            assert values, f"{tier}/{layer}: no feature carries pref_01"
            assert values <= allowed, (
                f"{tier}/{layer}: pref_01 carries {sorted(values - allowed)}, "
                f"outside the documented ladder {sorted(allowed)}"
            )


def _safety_by_iso(path: Path, layer_name: str, max_zoom: int) -> dict[str, set[object]]:
    """Map `iso_a2` → the set of `safety` values its features carry.

    A set rather than a value so that a country whose polygons disagree —
    which would mean the join keyed off the wrong column — shows up as a
    disagreement rather than as whichever tile was read last.
    """
    from pmtiles.reader import MmapSource, Reader, all_tiles

    per_iso: dict[str, set[object]] = defaultdict(set)
    with path.open("rb") as handle:
        reader = Reader(MmapSource(handle))
        for (zoom, _x, _y), data in all_tiles(reader.get_bytes):
            if zoom > max_zoom:
                continue
            try:
                raw = gzip.decompress(data)
            except OSError:
                raw = data
            decoded = mapbox_vector_tile.decode(raw)
            if layer_name not in decoded:
                continue
            for feature in decoded[layer_name]["features"]:
                props = feature.get("properties", {})
                iso = str(props.get("iso_a2", "")).upper()
                if iso:
                    per_iso[iso].add(props.get("safety"))
    return per_iso


@pytest.fixture(scope="module")
def advisory_index():
    """The index the tiles were supposed to be built from."""
    from wtg_pipeline.processing.advisories import load_safety_index

    index = load_safety_index()
    if index is None or not index.by_country:
        pytest.skip(
            "no advisory index built — run `wtg download advisories --source all` "
            "then `wtg process advisories`"
        )
    return index


def test_country_layer_carries_the_advisory_levels(free_tiles: Path, advisory_index) -> None:
    """RC-5: the Safety display mode had no data at all.

    `web/src/lib/display-modes.ts` reads a month-less `safety` property that
    nothing emitted, so every polygon painted missing-grey. A tile archive
    built after an advisory scrape must agree with the index it was built
    from, or the mode is silently back to grey.
    """
    in_tiles = _safety_by_iso(free_tiles, "country", max_zoom=2)
    expected = advisory_index.by_country

    shared = sorted(set(in_tiles) & set(expected))
    assert len(shared) >= 100, (
        f"only {len(shared)} countries are both in the tiles and in the advisory "
        f"index — the join ran against the wrong vintage or not at all"
    )
    disagreements = {
        iso: (sorted(in_tiles[iso], key=str), expected[iso])
        for iso in shared
        if in_tiles[iso] != {expected[iso]}
    }
    assert not disagreements, f"tile `safety` disagrees with the index: {disagreements}"


def test_safety_levels_are_on_the_documented_ladder(free_tiles: Path, advisory_index) -> None:
    # The web's four legend bins step at 2/3/4. Anything else paints as the
    # top bin and misreports risk.
    levels = {
        value
        for values in _safety_by_iso(free_tiles, "country", max_zoom=2).values()
        for value in values
        if value is not None
    }
    assert levels, "no country feature carries a `safety` property"
    assert levels <= {1, 2, 3, 4}, f"off-ladder advisory levels in the tiles: {levels}"


def test_admin1_inherits_advisory_levels(free_tiles: Path, advisory_index) -> None:
    # The country layer stops at zoom 3.5. Without this the Safety map goes
    # grey the moment a user zooms in.
    in_tiles = _safety_by_iso(free_tiles, "admin1", max_zoom=4)
    with_safety = [iso for iso, values in in_tiles.items() if values - {None}]
    assert len(with_safety) >= 100, (
        f"only {len(with_safety)} countries' admin-1 polygons carry an advisory "
        f"level — Safety mode goes grey past the country handover zoom"
    )
