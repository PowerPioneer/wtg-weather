#!/usr/bin/env bash
# Weekly alert runner: recompute the match status of every active alert against
# the published country bundle, and email the users whose alerts transitioned.
# The logic is `api/src/wtg_api/jobs/alerts_weekly.py`; this script exists only
# to get that module a database and an environment.
#
# ## Why this one runs in a container
#
# `weekly-advisories.sh` and `rebuild-tiles.sh` run `uv` on the host, because
# the pipeline runs on the host and works on files there. This job is the
# opposite: it needs Postgres, and Postgres is on the internal-only Docker
# network that `infra/CLAUDE.md` forbids exposing to the host. So it runs
# inside the `api` service, which is a real service in `docker-compose.yml` —
# checked below rather than assumed, because the `pipeline` service that
# `yearly-era5.sh` still shells into has never existed.
#
# `run --rm`, not `exec`, for the reason `infra/CLAUDE.md` gives for migrations:
# `exec` needs the serving container to already be up, so a cron fire during a
# deploy window would skip the week — and a skipped week is a missed
# transition, not a delayed one, because the next run finds the new state
# already recorded. `run` starts a throwaway container from the same image on
# the same network with the same env, and leaves the serving one alone.
#
# Idempotent: `run_weekly` emails on transitions only and records state in the
# same transaction, so a retry within the week sends nothing. The lock below is
# belt and braces against two runs overlapping rather than a correctness
# requirement.
#
# Optional env:
#   COMPOSE   — default "docker compose"
#   DRY_RUN   — set to 1 to score and report without sending or writing
set -euo pipefail

log() { printf '%s %s\n' "$(date --utc +%FT%TZ)" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

COMPOSE="${COMPOSE:-docker compose}"
SERVICE="api"
LOCK="/tmp/wtg-weekly-alerts.lock"

cd "$(dirname "$0")/../.."
[[ -f docker-compose.yml ]] || fail "no docker-compose.yml in $(pwd)"

exec 9>"$LOCK"
if ! flock -n 9; then
    fail "another weekly-alerts run is in progress (lock: $LOCK)"
fi

# The defect class this check exists for: a script that names a compose service
# which is not defined fails with a message about a missing container, weeks
# after anyone would connect it to the name. Assert the service exists first,
# and say so plainly.
if ! $COMPOSE config --services 2>/dev/null | grep -qx "$SERVICE"; then
    fail "docker-compose.yml defines no '$SERVICE' service — nothing to run the job in"
fi

ARGS=()
if [[ "${DRY_RUN:-0}" == "1" ]]; then
    ARGS+=(--dry-run)
    log "stage=run mode=dry-run"
else
    log "stage=run mode=live"
fi

# -T because cron has no TTY. The job prints a one-line JSON report to stdout,
# which lands in /var/log/wtg-alerts.log via the crontab entry; its own logging
# goes to stderr and lands in the same file.
$COMPOSE run --rm -T "$SERVICE" python -m wtg_api.jobs.alerts_weekly "${ARGS[@]}"

log "weekly-alerts OK"
