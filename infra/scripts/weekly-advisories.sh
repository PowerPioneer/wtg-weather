#!/usr/bin/env bash
# Weekly advisory refresh: scrape all five governments, consolidate, and — only
# if some government actually moved a country's level — rebuild the PMTiles so
# the map's Safety mode reflects it, purging the bunny.net cache on the way.
#
# Why a tile rebuild rather than a JSON overlay: the advisory level is baked
# into the tiles as a month-less `safety` feature property (see
# `pipeline/src/wtg_pipeline/tiles/build_geojson.py`). Serving it separately
# would mean the browser fetching climate-adjacent data at runtime, which
# `web/CLAUDE.md` forbids ("never fetch climate data from the browser; it's
# baked into PMTiles"). Keeping one source of truth costs a rebuild on the
# weeks something changes and nothing on the weeks it doesn't.
#
# The pipeline runs on the host, not in a container — `uv` is the entrypoint,
# same as `rebuild-tiles.sh`. (There is no `pipeline` service in
# docker-compose.yml; an earlier version of this script assumed one and could
# never have run.)
#
# Idempotent: `wtg process advisories` leaves both of its outputs untouched
# when their content is unchanged, so re-running within the week is a no-op
# and the rebuild is skipped. Lock file under /tmp prevents two cron fires
# from colliding.
#
# Loggable: every stage prefixes its output with an RFC3339 timestamp.
#
# Optional env:
#   UV                   — default "uv"
#   FORCE_REBUILD        — set to 1 to rebuild tiles even if no level moved
#   BUNNY_API_KEY        — passed through to rebuild-tiles.sh
#   BUNNY_PULL_ZONE_ID   — passed through to rebuild-tiles.sh
set -euo pipefail

log() { printf '%s %s\n' "$(date --utc +%FT%TZ)" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

UV="${UV:-uv}"
LOCK="/tmp/wtg-weekly-advisories.lock"

# flock guards against overlap if cron misfires or a previous run hasn't
# finished. `-n` returns immediately if already held; `9` is the fd.
exec 9>"$LOCK"
if ! flock -n 9; then
    fail "another weekly-advisories run is in progress (lock: $LOCK)"
fi

cd "$(dirname "$0")/../.."

command -v "$UV" >/dev/null 2>&1 || fail "uv not on PATH; install with: curl -LsSf https://astral.sh/uv/install.sh | sh"

INDEX="pipeline/data/intermediate/advisories/safety_index.json"

# Hash before and after. The index is byte-stable by construction (sorted
# keys, no timestamps), so a changed hash means a government changed a level
# — not that we scraped again. Rewording alone changes advisories.json, which
# the API serves fresh without a tile rebuild.
index_hash() { [[ -f "$INDEX" ]] && sha256sum "$INDEX" | cut -d' ' -f1 || printf 'absent'; }
before="$(index_hash)"

log "stage=download source=all"
"$UV" run --directory pipeline wtg download advisories --source all

log "stage=consolidate"
"$UV" run --directory pipeline wtg process advisories

after="$(index_hash)"
[[ "$after" != "absent" ]] || fail "consolidation produced no safety index at $INDEX"

if [[ "$before" == "$after" && "${FORCE_REBUILD:-0}" != "1" ]]; then
    log "stage=rebuild skipped — no advisory level changed this week"
    log "weekly-advisories OK (no-op)"
    exit 0
fi

# `rebuild-tiles.sh` re-runs `wtg build geojson --force` for both tiers, which
# is what picks the new levels up, then rebuilds the archives and purges the
# pull zone. It reads BUNNY_* from the repo-root .env if not in the
# environment, and holds its own lock.
log "stage=rebuild reason=$( [[ "${FORCE_REBUILD:-0}" == "1" ]] && echo forced || echo levels-changed )"
./infra/scripts/rebuild-tiles.sh

log "weekly-advisories OK (tiles rebuilt)"
