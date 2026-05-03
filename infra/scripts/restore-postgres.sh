#!/usr/bin/env bash
# Restore a pg_dump artifact from Backblaze B2 into the running postgres
# container. Destructive — drops and recreates the target database.
#
# Usage:
#   infra/scripts/restore-postgres.sh <db> <stamp>
#     db    — wtg | glitchtip | plausible
#     stamp — backup timestamp, e.g. 20260315T020000Z  (or "latest")
#
# Required env:
#   POSTGRES_USER, POSTGRES_PASSWORD
#   BACKUP_AGE_IDENTITY  — path to age private key file ("AGE-SECRET-KEY-...")
#   B2_ACCOUNT_ID, B2_ACCOUNT_KEY
# Optional:
#   B2_BUCKET (default wtg-backups), COMPOSE (default "docker compose")
#
# Safety: refuses to run against databases containing rows unless
# WTG_RESTORE_CONFIRM=yes-overwrite is set.
set -euo pipefail

log() { printf '%s %s\n' "$(date --utc +%FT%TZ)" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

[[ $# -eq 2 ]] || fail "usage: $0 <db> <stamp|latest>"
db="$1"
stamp="$2"

COMPOSE="${COMPOSE:-docker compose}"
B2_BUCKET="${B2_BUCKET:-wtg-backups}"

: "${POSTGRES_USER:?missing POSTGRES_USER}"
: "${POSTGRES_PASSWORD:?missing POSTGRES_PASSWORD}"
: "${BACKUP_AGE_IDENTITY:?missing BACKUP_AGE_IDENTITY (path to age key)}"
: "${B2_ACCOUNT_ID:?missing B2_ACCOUNT_ID}"
: "${B2_ACCOUNT_KEY:?missing B2_ACCOUNT_KEY}"

[[ -r "$BACKUP_AGE_IDENTITY" ]] || fail "cannot read $BACKUP_AGE_IDENTITY"

command -v age >/dev/null 2>&1 || fail "age not installed on host"
command -v zstd >/dev/null 2>&1 || fail "zstd not installed on host"
command -v b2 >/dev/null 2>&1 || fail "b2 CLI not installed on host"

cd "$(dirname "$0")/../.."

log "b2 authorize-account"
b2 authorize-account "$B2_ACCOUNT_ID" "$B2_ACCOUNT_KEY" >/dev/null

if [[ "$stamp" == "latest" ]]; then
    log "resolve latest stamp for db=${db}"
    # b2 ls prints "wtg/<db>/<stamp>.sql.zst.age"; pick lexicographically-last.
    stamp="$(b2 ls "$B2_BUCKET" "wtg/${db}/" \
        | awk -F/ '{print $3}' \
        | sed 's/\.sql\.zst\.age$//' \
        | sort \
        | tail -n1)"
    [[ -n "$stamp" ]] || fail "no backups found for db=${db}"
    log "resolved stamp=${stamp}"
fi

remote="wtg/${db}/${stamp}.sql.zst.age"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
local_enc="${work}/${db}.sql.zst.age"

log "download ${remote}"
b2 download-file-by-name --quiet "$B2_BUCKET" "$remote" "$local_enc"

log "decrypt + decompress"
age -d -i "$BACKUP_AGE_IDENTITY" "$local_enc" | zstd -d -q > "${work}/${db}.sql"

# Safety: verify target is empty unless caller overrides.
row_count="$($COMPOSE exec -T -e "PGPASSWORD=${POSTGRES_PASSWORD}" postgres \
    psql -U "$POSTGRES_USER" -d "$db" -At -c \
    "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname='public';" 2>/dev/null || echo 0)"
if [[ "${row_count//[^0-9]/}" -gt 0 && "${WTG_RESTORE_CONFIRM:-}" != "yes-overwrite" ]]; then
    fail "db=${db} is non-empty (${row_count} tables). Set WTG_RESTORE_CONFIRM=yes-overwrite to proceed."
fi

log "drop+recreate db=${db}"
$COMPOSE exec -T -e "PGPASSWORD=${POSTGRES_PASSWORD}" postgres \
    psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 <<SQL
DROP DATABASE IF EXISTS "${db}";
CREATE DATABASE "${db}" OWNER "${POSTGRES_USER}";
SQL

log "pg_restore into db=${db}"
$COMPOSE exec -T -e "PGPASSWORD=${POSTGRES_PASSWORD}" postgres \
    pg_restore -U "$POSTGRES_USER" -d "$db" --no-owner --no-privileges < "${work}/${db}.sql"

log "restore OK db=${db} from stamp=${stamp}"
