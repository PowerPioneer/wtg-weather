#!/usr/bin/env bash
# Yearly ERA5 refresh: pull the latest calendar year from CDS, re-run the
# full pipeline (aggregate → percentiles → sunshine → scoring → PMTiles),
# and purge the CDN. Scheduled mid-January so the prior year's data is
# available from Copernicus (~2–4 week lag).
#
# Idempotent: every stage caches by input hash. Running twice without new
# data is a no-op.
#
# Loggable: every stage prefixes output with an RFC3339 timestamp.
set -euo pipefail

log() { printf '%s %s\n' "$(date --utc +%FT%TZ)" "$*"; }

COMPOSE="${COMPOSE:-docker compose}"
LOCK="/tmp/wtg-yearly-era5.lock"

exec 9>"$LOCK"
if ! flock -n 9; then
    log "ERROR: another yearly-era5 run is in progress (lock: $LOCK)" >&2
    exit 1
fi

cd "$(dirname "$0")/../.."

# Window ends at the previous calendar year; ten-year climatology.
end_year=$(( $(date --utc +%Y) - 1 ))
start_year=$(( end_year - 9 ))
years="${start_year}-${end_year}"

log "stage=download source=era5 years=${years}"
$COMPOSE exec -T pipeline uv run wtg download era5 --years "$years"

log "stage=pipeline-full"
$COMPOSE exec -T pipeline uv run wtg pipeline full

log "stage=rebuild-tiles"
./infra/scripts/rebuild-tiles.sh

log "yearly-era5 OK years=${years}"
