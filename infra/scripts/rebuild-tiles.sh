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
# Optional env:
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

command -v "$UV" >/dev/null 2>&1 || fail "uv not on PATH; install with: curl -LsSf https://astral.sh/uv/install.sh | sh"

for tier in $TIERS; do
    # GeoJSON build is a prerequisite for pmtiles, and the CLI's `--tier`
    # flag selects WHICH set of geojson layers gets emitted into
    # `pipeline/data/final/<level>_<tier>.geojson`. Build once per tier so
    # the premium pmtiles step can find `country_premium.geojson` etc.
    log "stage=build-geojson tier=${tier}"
    "$UV" run --directory pipeline wtg build geojson --tier "$tier"

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
