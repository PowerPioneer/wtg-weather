#!/usr/bin/env bash
# Regenerate free + premium PMTiles from the latest processed data and purge
# the bunny.net pull zone so the map clients pick them up.
#
# The pipeline runs on the host (per `pipeline/CLAUDE.md`), not in a
# container — `uv` is the entrypoint, and the CLI writes directly into the
# repo's `tiles/` directory which Caddy mounts read-only at `/var/tiles`.
#
# Idempotent: each tier's existing `.pmtiles` is backed up to `.bak` before
# the rebuild and restored if the build fails. Running twice with identical
# inputs produces bit-identical PMTiles.
#
# Loggable: every stage prefixes output with an RFC3339 timestamp.
#
# Optional env (each falls back to the repo-root `.env`):
#   UV                  — default "uv"
#   BUNNY_API_KEY       — bunny.net API key (if set, purges the pull zone)
#   BUNNY_PULL_ZONE_ID  — bunny.net pull-zone numeric id
#   TIERS               — space-separated list (default "free premium")
set -euo pipefail

log() { printf '%s %s\n' "$(date --utc +%FT%TZ)" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

UV="${UV:-uv}"
TIERS="${TIERS:-free premium}"
LOCK="/tmp/wtg-rebuild-tiles.lock"

exec 9>"$LOCK"
if ! flock -n 9; then
    fail "another rebuild-tiles run is in progress (lock: $LOCK)"
fi

cd "$(dirname "$0")/../.."

# The bunny.net credentials live in the repo-root `.env` that compose loads.
# A plain shell — cron, or a human running this by hand — does not load it,
# so the purge silently no-op'd and rebuilt tiles never reached anyone: the
# pull zone caches for a year and ignores the signed query string.
#
# Deliberately parsed, not sourced. `. ./.env` would execute whatever else
# is in the file, and this script runs as root on the production host.
# Values are never logged.
env_value() {
    local key="$1" line value
    [[ -f .env ]] || return 0
    line=$(grep -aE "^[[:space:]]*(export[[:space:]]+)?${key}=" .env | tail -1) || true
    [[ -n "${line:-}" ]] || return 0
    value="${line#*=}"
    value="${value%$'\r'}"          # tolerate CRLF checkouts
    if [[ "$value" == \"*\" || "$value" == \'*\' ]]; then
        value="${value:1:${#value}-2}"
    fi
    printf '%s' "$value"
}

BUNNY_API_KEY="${BUNNY_API_KEY:-$(env_value BUNNY_API_KEY)}"
BUNNY_PULL_ZONE_ID="${BUNNY_PULL_ZONE_ID:-$(env_value BUNNY_PULL_ZONE_ID)}"

command -v "$UV" >/dev/null 2>&1 || fail "uv not on PATH; install with: curl -LsSf https://astral.sh/uv/install.sh | sh"

for tier in $TIERS; do
    # GeoJSON build is a prerequisite for pmtiles, and the CLI's `--tier`
    # flag selects WHICH set of geojson layers gets emitted into
    # `pipeline/data/final/<level>_<tier>.geojson`. Build once per tier so
    # the premium pmtiles step can find `country_premium.geojson` etc.
    #
    # `--force` is required, not optional: `wtg build geojson` treats an
    # existing non-empty output as a cache hit and skips it. Without the
    # flag this whole script silently degrades into republishing the last
    # build's bytes, which is the opposite of what it exists to do — a
    # pipeline code change would never reach the map.
    log "stage=build-geojson tier=${tier}"
    "$UV" run --directory pipeline wtg build geojson --tier "$tier" --force

    log "stage=build-pmtiles tier=${tier}"
    final="./tiles/${tier}.pmtiles"
    backup="./tiles/${tier}.pmtiles.bak"

    # Preserve the previous file in case the build fails partway through.
    if [[ -f "$final" ]]; then
        cp -f "$final" "$backup"
    fi

    if ! "$UV" run --directory pipeline wtg build pmtiles --tier "$tier"; then
        log "ERROR: pmtiles build failed for tier=${tier} — restoring previous file"
        if [[ -f "$backup" ]]; then mv -f "$backup" "$final"; fi
        exit 1
    fi

    [[ -s "$final" ]] || { log "ERROR: pmtiles output empty for tier=${tier}"; \
        if [[ -f "$backup" ]]; then mv -f "$backup" "$final"; fi; exit 1; }
    rm -f "$backup"
    size_bytes=$(stat -c '%s' "$final")
    log "tier=${tier} published size=${size_bytes}B"
done

# Caddy mounts ./tiles read-only; no container restart is needed. The new
# files are served immediately on the next signed URL hit.
if [[ -n "${BUNNY_API_KEY:-}" && -n "${BUNNY_PULL_ZONE_ID:-}" ]]; then
    log "stage=purge target=bunny.net zone=${BUNNY_PULL_ZONE_ID}"
    # Purge the whole pull zone — PMTiles are immutable per version but the
    # filename is stable, so we must invalidate to pick up new bytes.
    if curl --fail --silent --show-error \
            -X POST "https://api.bunny.net/pullzone/${BUNNY_PULL_ZONE_ID}/purgeCache" \
            -H "AccessKey: ${BUNNY_API_KEY}" \
            -o /dev/null; then
        log "stage=purge OK"
    else
        log "WARN: bunny.net purge FAILED — the new tiles are on disk but the"
        log "WARN: CDN will keep serving the old ones. Purge the pull zone at"
        log "WARN: https://dash.bunny.net before assuming this rebuild shipped."
    fi
else
    log "WARN: purge skipped — no BUNNY_API_KEY / BUNNY_PULL_ZONE_ID in the"
    log "WARN: environment or in ./.env. The rebuilt tiles will NOT reach"
    log "WARN: users until the bunny.net pull zone is purged."
fi

log "rebuild-tiles OK (tiers: ${TIERS})"
