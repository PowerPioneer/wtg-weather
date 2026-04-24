#!/usr/bin/env bash
# Weekly advisory refresh: scrape all five governments, re-aggregate, republish
# the advisories layer, and purge the bunny.net cache so the map picks up the
# new state within the CDN TTL window.
#
# Idempotent: each stage checks its own inputs-by-hash; re-running within the
# week is a no-op for sources that haven't changed, and a small update for any
# that have. Lock file under /tmp prevents two cron fires from colliding.
#
# Loggable: every stage prefixes its output with an RFC3339 timestamp.
#
# Optional env:
#   COMPOSE              — default "docker compose"
#   BUNNY_API_KEY        — if set, purges the advisories path on bunny.net
#   BUNNY_PULL_ZONE_ID   — bunny.net pull-zone numeric id for purge
set -euo pipefail

log() { printf '%s %s\n' "$(date --utc +%FT%TZ)" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

COMPOSE="${COMPOSE:-docker compose}"
LOCK="/tmp/wtg-weekly-advisories.lock"

# flock guards against overlap if cron misfires or a previous run hasn't
# finished. `-n` returns immediately if already held; `9` is the fd.
exec 9>"$LOCK"
if ! flock -n 9; then
    fail "another weekly-advisories run is in progress (lock: $LOCK)"
fi

cd "$(dirname "$0")/../.."

log "stage=download source=all"
$COMPOSE exec -T pipeline uv run wtg download advisories --source all

log "stage=aggregate"
$COMPOSE exec -T pipeline uv run wtg process aggregate --only advisories

log "stage=publish"
# The pipeline writes advisories.json into data/final/. Copy into the tiles
# volume that Caddy mounts read-only so the API can serve the fresh file.
$COMPOSE exec -T pipeline cp /app/data/final/advisories.json /tiles/advisories.json

if [[ -n "${BUNNY_API_KEY:-}" && -n "${BUNNY_PULL_ZONE_ID:-}" ]]; then
    log "stage=purge target=bunny.net path=/advisories.json"
    # bunny.net pull-zone purge-url endpoint. Single URL, immediate.
    purge_url="https://v2.wheretogoforgreatweather.com/advisories.json"
    if ! curl --fail --silent --show-error \
            -X POST "https://api.bunny.net/pullzone/${BUNNY_PULL_ZONE_ID}/purgeCache?url=${purge_url}" \
            -H "AccessKey: ${BUNNY_API_KEY}" \
            -o /dev/null; then
        log "WARN: bunny.net purge failed — CDN will self-expire within TTL"
    fi
else
    log "stage=purge skipped (no BUNNY_API_KEY / BUNNY_PULL_ZONE_ID)"
fi

log "weekly-advisories OK"
