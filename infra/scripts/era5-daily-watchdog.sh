#!/usr/bin/env bash
# Restart the ERA5 daily download if it has died, and stop asking once it is
# done. Intended for cron every 15 minutes while a rebuild is in flight.
#
# ## Why this exists
#
# On 2026-09-03 the download stopped at 01:24 with `400 The job has failed` on
# `t2m_min 2024` — a transient CDS error on a request shape that had worked for
# five consecutive years. Eight years were already in hand. Nothing alerts on a
# dead run, and it sat there for **three days** before anyone looked.
#
# `era5_daily.py` now retries a failed chunk four times with a long back-off,
# which handles the CDS-side flakiness that caused *that* outage. This script
# covers everything that retry cannot: the process being OOM-killed, the box
# rebooting, a `uv` or network fault that takes the interpreter down, or any
# failure that exhausts the retries. Those all look identical from outside —
# no process, an incomplete set of files, and silence.
#
# ## What it deliberately does not do
#
# It does not re-download anything. `wtg download era5-daily` skips every chunk
# already on disk (`have_complete_year` counts twelve monthly files as
# equivalent to one year file), so a restart resumes rather than repeats.
#
# It does not run while the download is running. The check is a process match,
# not a lock on the download itself, because the download is started detached
# and outlives whatever launched it.
#
# ## Crash-loop guard
#
# If the download dies immediately every time, restarting it every 15 minutes
# would hammer CDS and bury the real error. The state file counts consecutive
# restarts that did not survive `MIN_HEALTHY_SECONDS`; after MAX_RESTARTS the
# script stops trying and says so, loudly, on every subsequent run. Clear the
# state file to re-arm it once the cause is fixed.
#
# Exit codes: 0 = nothing to do, restarted, or already complete.
#             1 = giving up (crash loop, or the repo/toolchain is missing).

set -euo pipefail

REPO="${REPO:-/opt/wtg-weather}"
UV="${UV:-/root/.local/bin/uv}"
YEARS="${YEARS:-2016-2025}"
# The three series the free-tier product needs. Wind bands and premium
# humidity (si10_mean, t2m_mean, d2m_mean) are a deliberate second pass — see
# infra/CLAUDE.md § "The daily-climatology rebuild".
# Overridable as a space-separated string, e.g. SERIES="tp_sum ssrd_sum".
if [ -n "${SERIES:-}" ]; then
  read -r -a SERIES <<< "$SERIES"
else
  SERIES=(t2m_min tp_sum ssrd_sum)
fi
DOWNLOAD_LOG="${DOWNLOAD_LOG:-/var/log/wtg-era5-daily.log}"
STATE_DIR="${STATE_DIR:-/var/lib/wtg}"
STATE="${STATE:-$STATE_DIR/era5-watchdog.state}"
LOCK="${LOCK:-/var/lock/wtg-era5-watchdog.lock}"

# The process pattern, overridable so the crash-loop guard below can actually
# be exercised. Without this the running-download check short-circuits every
# test of the guard, which is the one piece of logic here that protects a
# third party (CDS) from us.
MATCH="${MATCH:-[b]in/wtg download era5-daily}"

MAX_RESTARTS="${MAX_RESTARTS:-5}"
# A run that survives this long counts as healthy, so the consecutive-failure
# counter resets. Generous: one year-sized CDS request has measured 2-4 hours,
# and a restart that gets through even one chunk is plainly not a crash loop.
MIN_HEALTHY_SECONDS="${MIN_HEALTHY_SECONDS:-1800}"

log() { printf '%sZ %s\n' "$(date -u +%FT%T)" "$*"; }

# Only one watchdog at a time. `-n` rather than a wait: if the previous fire is
# somehow still going, this one has nothing to add.
exec 9>"$LOCK"
if ! flock -n 9; then
  log "another watchdog holds $LOCK; nothing to do"
  exit 0
fi

[ -d "$REPO" ] || { log "FATAL: no repo at $REPO"; exit 1; }
[ -x "$UV" ]   || { log "FATAL: uv not executable at $UV"; exit 1; }

# The bracket keeps the pattern from matching this script's own command line —
# `pkill -f era5-daily` over SSH kills its own session for exactly this reason
# (infra/CLAUDE.md § "The daily-climatology rebuild").
if pgrep -f "$MATCH" >/dev/null 2>&1; then
  exit 0
fi

# Ask the pipeline itself whether the set is complete, rather than counting
# files here. `have_complete_year` is the same predicate the downloader uses to
# decide what to skip, so the two can never disagree about what "done" means.
if "$UV" run --directory "$REPO/pipeline" python - "$YEARS" "${SERIES[@]}" <<'PY' >/dev/null 2>&1
import sys
from wtg_pipeline.sources import era5_daily

years = era5_daily.parse_year_range(sys.argv[1])
stems = sys.argv[2:]
missing = [
    (stem, year)
    for stem in stems
    for year in years
    if not era5_daily.have_complete_year(stem, year)
]
sys.exit(0 if not missing else 1)
PY
then
  log "download complete for ${SERIES[*]} $YEARS — nothing to restart"
  rm -f "$STATE"
  exit 0
fi

# ── Crash-loop guard ─────────────────────────────────────────────────
mkdir -p "$STATE_DIR"
restarts=0
last_start=0
if [ -f "$STATE" ]; then
  # shellcheck disable=SC1090
  . "$STATE" 2>/dev/null || true
  restarts="${restarts:-0}"
  last_start="${last_start:-0}"
fi

now="$(date -u +%s)"
if [ "$last_start" -gt 0 ]; then
  alive=$(( now - last_start ))
  if [ "$alive" -ge "$MIN_HEALTHY_SECONDS" ]; then
    # The last restart ran long enough to count as healthy; this is a fresh
    # failure, not a loop.
    restarts=0
  fi
fi

if [ "$restarts" -ge "$MAX_RESTARTS" ]; then
  log "GIVING UP: $restarts consecutive restarts died inside ${MIN_HEALTHY_SECONDS}s."
  log "  The download is not making progress. Read $DOWNLOAD_LOG, fix the cause,"
  log "  then: rm $STATE"
  exit 1
fi

restarts=$(( restarts + 1 ))
printf 'restarts=%d\nlast_start=%d\n' "$restarts" "$now" > "$STATE"

series_args=()
for s in "${SERIES[@]}"; do series_args+=(--series "$s"); done

log "download is not running and not complete — restarting (attempt $restarts/$MAX_RESTARTS)"
cd "$REPO"
# `setsid` so it outlives this script and the cron session that spawned it.
# Appending rather than truncating: the previous run's failure is the evidence
# for why this restart happened.
setsid nohup "$UV" run --directory "$REPO/pipeline" \
  wtg download era5-daily --years "$YEARS" "${series_args[@]}" \
  >> "$DOWNLOAD_LOG" 2>&1 < /dev/null &

sleep 10
if pgrep -f "$MATCH" >/dev/null 2>&1; then
  log "restarted; see $DOWNLOAD_LOG"
else
  log "WARNING: restart did not stay up for 10s — check $DOWNLOAD_LOG"
fi
