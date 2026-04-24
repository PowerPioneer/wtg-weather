#!/usr/bin/env bash
# Weekly alert runner — recomputes match status for every active alert and
# emails on transition. See api/src/wtg_api/jobs/alerts_weekly.py for the
# actual logic. Idempotent: safe to retry if cron fires twice.
set -euo pipefail

COMPOSE="${COMPOSE:-docker compose}"

cd "$(dirname "$0")/../.."

$COMPOSE exec -T api python -m wtg_api.jobs.alerts_weekly
