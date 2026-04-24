#!/usr/bin/env bash
# Nightly: pg_dump → age-encrypt → upload to Backblaze B2.
#
# Idempotent: each run produces a uniquely-named artifact
# (wtg-YYYYmmddTHHMMSSZ.sql.zst.age); re-running the script twice in a row
# creates two distinct artifacts and neither clobbers the other. Retention is
# enforced by the B2 bucket lifecycle rule, not by this script.
#
# Loggable: every significant action is prefixed with an RFC3339 timestamp so
# the output slots directly into /var/log/wtg-backup.log via cron.
#
# Required env (loaded from the repo-root .env by cron wrapper):
#   POSTGRES_USER               — superuser in the postgres container
#   POSTGRES_PASSWORD           — pg password (piped to pg_dump via PGPASSWORD)
#   BACKUP_AGE_RECIPIENT        — age X25519 public key ("age1...") used to
#                                 encrypt the dump. Private key lives off-box.
#   B2_ACCOUNT_ID               — Backblaze B2 key id
#   B2_ACCOUNT_KEY              — Backblaze B2 application key
#   B2_BUCKET                   — defaults to "wtg-backups"
# Optional:
#   COMPOSE                     — docker compose invocation (default "docker compose")
#   BACKUP_WORKDIR              — scratch dir (default /tmp/wtg-backup)
#   DATABASES                   — space-separated list (default "wtg glitchtip plausible")
set -euo pipefail

log() { printf '%s %s\n' "$(date --utc +%FT%TZ)" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

COMPOSE="${COMPOSE:-docker compose}"
B2_BUCKET="${B2_BUCKET:-wtg-backups}"
BACKUP_WORKDIR="${BACKUP_WORKDIR:-/tmp/wtg-backup}"
DATABASES="${DATABASES:-wtg glitchtip plausible}"

: "${POSTGRES_USER:?missing POSTGRES_USER}"
: "${POSTGRES_PASSWORD:?missing POSTGRES_PASSWORD}"
: "${BACKUP_AGE_RECIPIENT:?missing BACKUP_AGE_RECIPIENT (age public key)}"
: "${B2_ACCOUNT_ID:?missing B2_ACCOUNT_ID}"
: "${B2_ACCOUNT_KEY:?missing B2_ACCOUNT_KEY}"

command -v age >/dev/null 2>&1 || fail "age not installed on host"
command -v zstd >/dev/null 2>&1 || fail "zstd not installed on host"
command -v b2 >/dev/null 2>&1 || fail "b2 CLI not installed on host"

cd "$(dirname "$0")/../.."
mkdir -p "$BACKUP_WORKDIR"

stamp="$(date --utc +%Y%m%dT%H%M%SZ)"

# b2 authorize-account is safe to call repeatedly; it caches creds in ~/.b2_account_info.
log "b2 authorize-account"
b2 authorize-account "$B2_ACCOUNT_ID" "$B2_ACCOUNT_KEY" >/dev/null

exit_code=0
for db in $DATABASES; do
    out="$BACKUP_WORKDIR/${db}-${stamp}.sql.zst.age"
    log "dump db=${db} -> ${out}"
    # pg_dump | zstd | age -r <recipient>. Pipefail catches any failure.
    if ! $COMPOSE exec -T \
            -e "PGPASSWORD=${POSTGRES_PASSWORD}" \
            postgres \
            pg_dump -U "$POSTGRES_USER" --no-owner --no-privileges -Fc "$db" \
        | zstd -T0 -q \
        | age -r "$BACKUP_AGE_RECIPIENT" -o "$out"; then
        log "ERROR: dump failed for db=${db}"
        exit_code=1
        rm -f "$out"
        continue
    fi

    size_bytes=$(stat -c '%s' "$out")
    log "upload db=${db} size=${size_bytes}B"
    if ! b2 upload-file --quiet "$B2_BUCKET" "$out" "wtg/${db}/${stamp}.sql.zst.age"; then
        log "ERROR: upload failed for db=${db} — artifact kept at ${out}"
        exit_code=1
        continue
    fi

    rm -f "$out"
    log "done db=${db}"
done

if [[ $exit_code -eq 0 ]]; then
    log "backup OK for: ${DATABASES}"
else
    log "backup FINISHED WITH ERRORS — see lines above"
fi
exit $exit_code
