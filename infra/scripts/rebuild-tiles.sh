#!/usr/bin/env bash
# Regenerate free + premium PMTiles from the latest processed data and purge
# the bunny.net pull zone so the map clients pick them up.
#
# Idempotent: tippecanoe writes to a tmp path and only swaps the final file
# in place on success. A failed run leaves the previous tiles untouched.
# Running twice with identical inputs produces bit-identical PMTiles.
#
# Loggable: every stage prefixes output with an RFC3339 timestamp.
#
# Optional env:
#   COMPOSE             — default "docker compose"
#   BUNNY_API_KEY       — bunny.net API key (if set, purges the pull zone)
#   BUNNY_PULL_ZONE_ID  — bunny.net pull-zone numeric id
#   TIERS               — space-separated list (default "free premium")
set -euo pipefail

log() { printf '%s %s\n' "$(date --utc +%FT%TZ)" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

COMPOSE="${COMPOSE:-docker compose}"
TIERS="${TIERS:-free premium}"
LOCK="/tmp/wtg-rebuild-tiles.lock"

exec 9>"$LOCK"
if ! flock -n 9; then
    fail "another rebuild-tiles run is in progress (lock: $LOCK)"
fi

cd "$(dirname "$0")/../.."

# GeoJSON build is a prerequisite for pmtiles. Cached — idempotent no-op if
# inputs haven't changed since the last run.
log "stage=build-geojson"
$COMPOSE exec -T pipeline uv run wtg build geojson

for tier in $TIERS; do
    log "stage=build-pmtiles tier=${tier}"
    tmp="./tiles/${tier}.pmtiles.tmp"
    final="./tiles/${tier}.pmtiles"
    rm -f "$tmp"

    if ! $COMPOSE exec -T pipeline uv run wtg build pmtiles --tier "$tier" --out "/tiles/${tier}.pmtiles.tmp"; then
        log "ERROR: pmtiles build failed for tier=${tier} — previous file preserved"
        rm -f "$tmp"
        exit 1
    fi

    [[ -s "$tmp" ]] || fail "pmtiles tmp output empty for tier=${tier}"
    mv -f "$tmp" "$final"
    size_bytes=$(stat -c '%s' "$final")
    log "tier=${tier} published size=${size_bytes}B"
done

# Caddy mounts ./tiles read-only; no container restart is needed. The new
# files are served immediately on the next signed URL hit.
if [[ -n "${BUNNY_API_KEY:-}" && -n "${BUNNY_PULL_ZONE_ID:-}" ]]; then
    log "stage=purge target=bunny.net zone=${BUNNY_PULL_ZONE_ID}"
    # Purge the whole pull zone — PMTiles are immutable per version but the
    # filename is stable, so we must invalidate to pick up new bytes.
    if ! curl --fail --silent --show-error \
            -X POST "https://api.bunny.net/pullzone/${BUNNY_PULL_ZONE_ID}/purgeCache" \
            -H "AccessKey: ${BUNNY_API_KEY}" \
            -o /dev/null; then
        log "WARN: bunny.net purge failed — run manually or wait for TTL"
    fi
else
    log "stage=purge skipped (no BUNNY_API_KEY / BUNNY_PULL_ZONE_ID)"
fi

log "rebuild-tiles OK (tiers: ${TIERS})"
