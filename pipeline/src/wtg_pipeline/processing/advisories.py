"""Consolidate scraped government advisories into one publishable state.

The five (six, counting the Netherlands) scrapers under
``sources/advisories/`` each write a dated JSON array of normalised
:class:`~wtg_pipeline.sources.advisories.base.Advisory` records. Nothing
consumed them: the map's Safety display mode reads a ``safety`` feature
property that no build step ever emitted, so every polygon painted
missing-grey. This module is the join.

Two artifacts come out of a consolidation run, deliberately separate:

``data/final/advisories.json``
    The full picture — per country, the consensus level plus every
    government's own level, summary, source URL and the date that
    government's position last *changed*. This is what the API serves to the
    SSR country pages (``AdvisorySummary`` in ``web/src/lib/types.ts``).

``data/intermediate/advisories/safety_index.json``
    Just the levels: ``{"countries": {...}, "regions": {...}}``. This is what
    :mod:`wtg_pipeline.tiles.build_geojson` bakes into the tiles, and it is
    byte-stable by construction (sorted keys, no timestamps). The weekly cron
    hashes it to decide whether a tile rebuild — and therefore a full CDN
    purge — is warranted. A government rewording its prose must not cost
    every user a re-download of the archive; a government changing a *level*
    must.

Consensus rule
--------------

``level`` is the **maximum** across governments, matching the web legend's
"Highest of 5 sources". Five governments disagreeing about Colombia is not a
signal we can adjudicate, and under-reporting risk is the worse error.

Regional carve-outs
-------------------

``region_code`` currently arrives in one of two shapes:

``"regional-L3"``
    The sentinel the scrapers emit for "somewhere inside this country is a
    level 3, but we could not resolve *where*". It is **not** attributable to
    a polygon, so it never reaches the tiles — it would paint the whole
    country at the carve-out level, which is precisely the claim the
    carve-out contradicts. It is carried in ``advisories.json`` as
    ``regional_max`` so the country page can say "parts of this country carry
    a higher advisory".

``"CO-ANT"``
    A real ISO-3166-2 code. No scraper resolves one yet (the detail-page
    geocoding pass is unbuilt), but the schema allows it and the join is
    already wired: such a row paints its admin-1 polygon directly.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Mapping

from wtg_pipeline.config import advisories_raw_dir, ensure_dir, final_dir, intermediate_dir

log = logging.getLogger(__name__)

# The shared ladder documented in `sources/advisories/base.py`. The web's
# legend bins (display-modes.ts § safety) render these four in order.
LEVEL_LABELS: dict[int, str] = {
    1: "Exercise normal precautions",
    2: "Exercise increased caution",
    3: "Reconsider travel",
    4: "Do not travel",
}

# A real ISO-3166-2 subdivision code: "CO-ANT", "MX-GRO", "US-CA". The
# scrapers' "regional-L4" sentinel does not match, which is the point.
REGION_CODE_RE = re.compile(r"^[A-Z]{2}-[A-Z0-9]{1,3}$")

# The sentinel shape, matched only so it can be recognised and excluded
# rather than silently falling through to "unparseable region code".
REGIONAL_SENTINEL_RE = re.compile(r"^regional-L([1-4])$")


def advisories_json_path(base_dir: Path | None = None) -> Path:
    root = base_dir if base_dir is not None else final_dir()
    return ensure_dir(root) / "advisories.json"


def safety_index_path(base_dir: Path | None = None) -> Path:
    root = base_dir if base_dir is not None else intermediate_dir()
    return ensure_dir(root / "advisories") / "safety_index.json"


@dataclass(frozen=True)
class SourceAdvisory:
    """One government's current position on one country."""

    source_id: str
    level: int
    summary: str
    source_url: str
    last_changed: datetime

    @property
    def label(self) -> str:
        return LEVEL_LABELS[self.level]


@dataclass(frozen=True)
class CountryAdvisory:
    """Every government's position on one country, plus the consensus.

    ``level`` is ``None`` when no government has published a country-wide
    position — which, given only a resolved carve-out, is the honest answer.
    Such a country carries no ``safety`` property and paints grey rather than
    being asserted "normal" on nobody's authority.
    """

    iso2: str
    level: int | None
    sources: tuple[SourceAdvisory, ...]
    regions: Mapping[str, int]
    regional_max: int | None


@dataclass(frozen=True)
class SafetyIndex:
    """Advisory levels keyed by the identifiers a tile feature carries.

    ``by_region`` is keyed by ISO-3166-2 code, which is exactly what the
    admin-1 boundary frame exposes as ``admin1_code``.
    """

    by_country: Mapping[str, int]
    by_region: Mapping[str, int]

    def level_for(self, iso_a2: str, admin1_code: str = "") -> int | None:
        """Advisory level for one polygon, or ``None`` if nothing is known.

        A region-specific level and a country-wide one are combined with
        ``max``: a carve-out exists to flag somewhere *worse* than the
        baseline, and no government publishes a subdivision as safer than
        the country it is in. Taking the max means a future scraper that
        emits a stale or mis-parsed low region level cannot mask a
        country-wide "do not travel".
        """
        country = self.by_country.get(_clean_iso2(iso_a2))
        code = (admin1_code or "").strip().upper()
        region = self.by_region.get(code) if code else None
        if country is None:
            return region
        if region is None:
            return country
        return max(country, region)

    def __len__(self) -> int:
        return len(self.by_country)


def _clean_iso2(value: str | None) -> str:
    return (value or "").strip().upper()


def _normalise_summary(text: str) -> str:
    """Collapse whitespace so re-flowed prose isn't read as a new advisory."""
    return " ".join((text or "").split())


def latest_source_files(base_dir: Path | None = None) -> dict[str, Path]:
    """Newest dump per source directory under ``data/raw/advisories/``.

    ``write_advisories`` names files by UTC timestamp, so lexical order is
    chronological order and the last one wins.
    """
    root = base_dir if base_dir is not None else advisories_raw_dir()
    if not root.exists():
        return {}
    latest: dict[str, Path] = {}
    for source_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        dumps = sorted(source_dir.glob("*.json"))
        if not dumps:
            log.warning("no advisory dumps under %s", source_dir)
            continue
        latest[source_dir.name] = dumps[-1]
    return latest


# A source whose newest dump lags the freshest by more than this is reported.
# Every source is scraped in the same weekly run, so a lag of weeks means that
# source has been failing — silently, because `latest_source_files` happily
# keeps serving the last dump that worked. The US State scraper sat four
# months behind the other five this way, feeding a "six-government consensus"
# from an April snapshot.
STALE_AFTER_DAYS = 30

# `write_advisories` names dumps with this UTC format.
_DUMP_STAMP = "%Y-%m-%dT%H%M%SZ"


def dump_timestamp(path: Path) -> datetime | None:
    """The scrape time encoded in a dump's filename, or ``None``."""
    try:
        return datetime.strptime(path.stem, _DUMP_STAMP).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def stale_sources(
    files: Mapping[str, Path], *, max_lag_days: int = STALE_AFTER_DAYS
) -> dict[str, int]:
    """``{source_id: days behind the freshest source}`` for lagging sources.

    Measured against the newest dump across all sources rather than the wall
    clock, so this stays true when the whole pipeline has not run for a while
    — the question is whether one source is falling behind the others, not
    whether the data is old in absolute terms.
    """
    stamps = {
        source_id: stamp
        for source_id, path in files.items()
        if (stamp := dump_timestamp(path)) is not None
    }
    if len(stamps) < 2:
        return {}
    freshest = max(stamps.values())
    lags = {
        source_id: (freshest - stamp).days
        for source_id, stamp in stamps.items()
    }
    return {
        source_id: lag for source_id, lag in sorted(lags.items()) if lag > max_lag_days
    }


def load_advisories(base_dir: Path | None = None) -> dict[str, list["object"]]:
    """Parse the newest dump per source into validated ``Advisory`` records.

    Validation runs through the pydantic model rather than reading the JSON
    loosely: the normalised schema is the contract every scraper signs, and a
    dump that no longer satisfies it should fail here rather than quietly
    become a country with no advisory.
    """
    # Deferred: pulls pydantic/httpx and, via the package __init__, bs4. The
    # tile build imports this module for `SafetyIndex` alone.
    from wtg_pipeline.sources.advisories.base import Advisory

    out: dict[str, list[object]] = {}
    for source_id, path in latest_source_files(base_dir).items():
        raw = json.loads(path.read_text(encoding="utf-8"))
        records = [Advisory.model_validate(item) for item in raw]
        log.info("advisories: %s → %d record(s) from %s", source_id, len(records), path.name)
        out[source_id] = records
    return out


def _previous_positions(
    payload: Mapping[str, object] | None,
) -> dict[tuple[str, str], tuple[int, str, str]]:
    """``(iso2, source) → (level, summary, last_changed)`` from a prior payload."""
    if not payload:
        return {}
    positions: dict[tuple[str, str], tuple[int, str, str]] = {}
    countries = payload.get("countries")
    if not isinstance(countries, list):
        return {}
    for country in countries:
        if not isinstance(country, dict):
            continue
        iso2 = _clean_iso2(str(country.get("iso2", "")))
        sources = country.get("sources")
        if not iso2 or not isinstance(sources, list):
            continue
        for source in sources:
            if not isinstance(source, dict):
                continue
            source_id = str(source.get("source", ""))
            level = source.get("level")
            last_changed = source.get("last_changed")
            if not source_id or not isinstance(level, int) or not isinstance(last_changed, str):
                continue
            positions[(iso2, source_id)] = (
                level,
                _normalise_summary(str(source.get("summary", ""))),
                last_changed,
            )
    return positions


def consolidate(
    by_source: Mapping[str, Iterable["object"]],
    *,
    previous: Mapping[str, object] | None = None,
) -> dict[str, CountryAdvisory]:
    """Fold every source's records into one state per country.

    ``previous`` is the last written payload, used only to carry ``last_changed``
    forward: a government that says the same thing this week as last week has
    not changed its advisory, and dating it "today" would be a lie the country
    page then prints.
    """
    prior = _previous_positions(previous)
    country_rows: dict[str, dict[str, SourceAdvisory]] = {}
    region_rows: dict[str, dict[str, int]] = {}
    sentinel_rows: dict[str, int] = {}
    unresolved_regions = 0

    for source_id, records in sorted(by_source.items()):
        for record in records:
            iso2 = _clean_iso2(getattr(record, "country_iso2", ""))
            if not iso2:
                continue
            level = int(getattr(record, "level"))
            region_code = getattr(record, "region_code", None)
            fetched_at: datetime = getattr(record, "fetched_at")

            if region_code:
                code = str(region_code).strip()
                sentinel = REGIONAL_SENTINEL_RE.match(code)
                if sentinel is not None:
                    current = sentinel_rows.get(iso2)
                    sentinel_rows[iso2] = max(current or 0, level)
                    continue
                upper = code.upper()
                if REGION_CODE_RE.match(upper) and upper.startswith(f"{iso2}-"):
                    per_country = region_rows.setdefault(iso2, {})
                    per_country[upper] = max(per_country.get(upper, 0), level)
                else:
                    unresolved_regions += 1
                    log.debug(
                        "advisories: %s emitted an unrecognised region_code %r for %s",
                        source_id,
                        code,
                        iso2,
                    )
                continue

            summary = _normalise_summary(str(getattr(record, "summary", "")))
            previous_position = prior.get((iso2, source_id))
            if previous_position is not None and previous_position[:2] == (level, summary):
                last_changed = _parse_iso(previous_position[2], fallback=fetched_at)
            else:
                last_changed = fetched_at
            per_source = country_rows.setdefault(iso2, {})
            # One government, one position per country. A source that lists a
            # country twice (the UK FCDO splits some entries) keeps the worse.
            existing = per_source.get(source_id)
            if existing is not None and existing.level >= level:
                continue
            per_source[source_id] = SourceAdvisory(
                source_id=source_id,
                level=level,
                summary=summary,
                source_url=str(getattr(record, "source_url", "")),
                last_changed=last_changed,
            )

    if unresolved_regions:
        log.info(
            "advisories: %d regional row(s) had a region_code that is neither the "
            "regional-L<n> sentinel nor an ISO-3166-2 code; ignored",
            unresolved_regions,
        )

    consolidated: dict[str, CountryAdvisory] = {}
    for iso2 in sorted(set(country_rows) | set(region_rows) | set(sentinel_rows)):
        sources = tuple(sorted(country_rows.get(iso2, {}).values(), key=lambda s: s.source_id))
        regions = dict(sorted(region_rows.get(iso2, {}).items()))
        # The country-wide level is the consensus of country-wide rows only.
        # A carve-out deliberately describes a *part* of the country; letting
        # it raise the national level would paint the whole of Mexico at the
        # level of its worst state.
        level = max((s.level for s in sources), default=None)
        carve_out_levels = [*regions.values()]
        if iso2 in sentinel_rows:
            carve_out_levels.append(sentinel_rows[iso2])
        highest_carve_out = max(carve_out_levels, default=None)
        consolidated[iso2] = CountryAdvisory(
            iso2=iso2,
            level=level,
            sources=sources,
            regions=regions,
            # Only worth reporting when it says something the national level
            # does not.
            regional_max=(
                highest_carve_out
                if highest_carve_out is not None
                and (level is None or highest_carve_out > level)
                else None
            ),
        )
    return consolidated


def _parse_iso(value: str, *, fallback: datetime) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return fallback
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=timezone.utc)


def safety_index(consolidated: Mapping[str, CountryAdvisory]) -> SafetyIndex:
    """The levels the tiles bake in — countries and resolved subdivisions."""
    by_country = {
        iso2: entry.level
        for iso2, entry in sorted(consolidated.items())
        if entry.level is not None
    }
    by_region: dict[str, int] = {}
    for entry in consolidated.values():
        by_region.update(entry.regions)
    return SafetyIndex(by_country=by_country, by_region=dict(sorted(by_region.items())))


def to_payload(consolidated: Mapping[str, CountryAdvisory]) -> dict[str, object]:
    """JSON-serialisable full state, stable under re-running with same inputs."""
    countries: list[dict[str, object]] = []
    newest: datetime | None = None
    for iso2, entry in sorted(consolidated.items()):
        sources: list[dict[str, object]] = []
        for source in entry.sources:
            if newest is None or source.last_changed > newest:
                newest = source.last_changed
            sources.append(
                {
                    "source": source.source_id,
                    "level": source.level,
                    "label": source.label,
                    "summary": source.summary,
                    "url": source.source_url,
                    "last_changed": _iso_z(source.last_changed),
                }
            )
        country: dict[str, object] = {
            "iso2": iso2,
            "level": entry.level,
            "label": LEVEL_LABELS[entry.level] if entry.level is not None else None,
            "sources": sources,
        }
        if entry.regional_max is not None:
            country["regional_max"] = entry.regional_max
        if entry.regions:
            country["regions"] = [
                {"code": code, "level": level} for code, level in entry.regions.items()
            ]
        countries.append(country)

    return {
        # Derived from the data, not from the clock: a run that changes
        # nothing must produce byte-identical output (pipeline/CLAUDE.md).
        "generated_at": _iso_z(newest) if newest is not None else None,
        "consensus": "max",
        "levels": {str(k): v for k, v in sorted(LEVEL_LABELS.items())},
        "countries": countries,
    }


def _iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def index_payload(index: SafetyIndex) -> dict[str, object]:
    return {
        "countries": dict(sorted(index.by_country.items())),
        "regions": dict(sorted(index.by_region.items())),
    }


def read_json(path: Path) -> dict[str, object] | None:
    if not path.exists():
        return None
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        log.warning("%s is not valid JSON; treating as absent", path)
        return None
    return loaded if isinstance(loaded, dict) else None


def write_json_if_changed(payload: Mapping[str, object], path: Path) -> bool:
    """Write ``payload`` to ``path``; return whether the bytes changed.

    Leaving an unchanged file untouched keeps its mtime and hash stable,
    which is what lets the weekly cron tell "a government moved" from "we
    scraped again" without a bespoke change-detection protocol.
    """
    text = json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=False) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return True


def load_safety_index(path: Path | None = None) -> SafetyIndex | None:
    """Read the baked index back, or ``None`` if no consolidation has run."""
    target = path if path is not None else safety_index_path()
    payload = read_json(target)
    if payload is None:
        return None
    countries = payload.get("countries")
    regions = payload.get("regions")
    if not isinstance(countries, dict):
        log.warning("%s has no `countries` map; ignoring", target)
        return None
    return SafetyIndex(
        by_country={
            _clean_iso2(k): int(v) for k, v in countries.items() if isinstance(v, int)
        },
        by_region=(
            {str(k).upper(): int(v) for k, v in regions.items() if isinstance(v, int)}
            if isinstance(regions, dict)
            else {}
        ),
    )
