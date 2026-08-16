#!/usr/bin/env bash
# Yearly ERA5 refresh: pull the newest calendar year from Copernicus, re-run
# the climatology over the ten-year window that now ends on it, rebuild both
# tile tiers, republish the country bundle, and recreate `web` so the SSR
# pages actually show the new numbers. Scheduled mid-January, because ERA5
# monthly means lag the calendar by two to four weeks.
#
# ## Why this runs `uv` on the host
#
# The previous version of this script called `docker compose exec pipeline`.
# There is no `pipeline` service in `docker-compose.yml` and there never has
# been, so this script could not have run once in its life — the same defect
# `weekly-advisories.sh` had before WS-4 rewrote it (FEATURE_GAP_PLAN.md
# § "WS-4 progress"). The pipeline runs on the host, works on files in this
# repo, and is driven by `uv`, exactly like `rebuild-tiles.sh`.
#
# The one containerised step is the last one: recreating `web`. That service
# *is* defined, and the script asserts so before using it rather than
# discovering it at 04:00 in January.
#
# ## Why not `wtg pipeline full`
#
# `pipeline full` builds GeoJSON and PMTiles itself, and would therefore skip
# `rebuild-tiles.sh` — which is where the archive backup, the truncated-output
# check (`verify-pmtiles.py`) and the bunny.net purge live. A yearly rebuild
# that produces perfect tiles nobody's CDN ever serves is the failure this
# ordering exists to avoid. Advisories are the weekly job's business, so this
# script does not scrape or consolidate them; `build geojson` reads whatever
# `safety_index.json` the last weekly run left, which is what the map should
# show.
#
# ## Aggregation caching, and the one flag that must not appear
#
# `wtg process aggregate` caches on the *combined* Parquet existing, and
# resumes from per-(variable, year) parts when it does not. `--force` deletes
# those parts. At admin-2 scale — 49,267 polygons × 90 variable-years — a
# clean pass is three to six days, so a `--force` here would mean any crash
# on day five restarts from zero.
#
# Instead the combined Parquet is moved aside per level. The cache is then
# cold (so the new year is genuinely aggregated) while every part from the
# nine unchanged years survives (so only the new year's parts are computed),
# and a crashed run resumes by simply being re-run. Percentiles have no parts
# and are derived, so those are rebuilt with `--force`.
#
# ## Idempotent, lockable, loggable
#
# flock guards against a second fire while the first is still running — which,
# for a multi-day job, is a real possibility rather than a formality. Every
# stage prints an RFC3339 timestamp. Re-running after success re-does the
# work (the parquets were moved aside); re-running after a crash resumes.
#
# Optional env:
#   DRY_RUN=1        — print the exact command sequence, execute nothing
#   UV               — default "uv"
#   COMPOSE          — default "docker compose"
#   YEARS            — override the window, e.g. "2017-2026"
#   TIERS            — override the tier list passed to rebuild-tiles.sh
#   ALLOW_FREE_ONLY  — 1 to continue when the geoBoundaries ADM2 sources are
#                      missing, rebuilding the free tier alone
#   BUNNY_API_KEY / BUNNY_PULL_ZONE_ID — passed through to rebuild-tiles.sh
set -euo pipefail

log() { printf '%s %s\n' "$(date --utc +%FT%TZ)" "$*" || true; }
fail() { log "ERROR: $*" >&2; exit 1; }

DRY_RUN="${DRY_RUN:-0}"

# Every side-effecting command goes through here. In DRY_RUN it prints the
# command, shell-quoted, and returns — nothing is downloaded, no container is
# touched, no file is moved. That is the whole contract of the dry run: it is
# the plan, not a rehearsal.
run() {
    log "+ $(printf '%q ' "$@")"
    if [[ "$DRY_RUN" == "1" ]]; then
        return 0
    fi
    "$@"
}

UV="${UV:-uv}"
COMPOSE="${COMPOSE:-docker compose}"
WEB_SERVICE="web"
LOCK="/tmp/wtg-yearly-era5.lock"

# GDAL caps per-feature GeoJSON size at 200MB by default; large countries'
# admin-2 layers (Canada, Russia) exceed that. 0 = unlimited.
export OGR_GEOJSON_MAX_OBJ_SIZE=0

# The lock guards side effects, and a dry run has none. Taking it anyway would
# mean the one moment you most want to print the plan — while the multi-day
# run is in flight — is the one moment you cannot.
if [[ "$DRY_RUN" != "1" ]]; then
    command -v flock >/dev/null 2>&1 || fail "flock not found (util-linux); refusing to run unlocked"
    exec 9>"$LOCK"
    if ! flock -n 9; then
        fail "another yearly-era5 run is in progress (lock: $LOCK)"
    fi
fi

cd "$(dirname "$0")/../.."
[[ -f docker-compose.yml ]] || fail "no docker-compose.yml in $(pwd)"

command -v "$UV" >/dev/null 2>&1 || fail \
    "uv not on PATH; install with: curl -LsSf https://astral.sh/uv/install.sh | sh"

# The defect class the `pipeline` service was: a script naming a compose
# service that does not exist fails hours later with a message about a missing
# container. Assert it up front, and say so plainly. Skipped in DRY_RUN so the
# plan can be printed on a machine with no Docker at all.
if [[ "$DRY_RUN" != "1" ]]; then
    if ! $COMPOSE config --services 2>/dev/null | grep -qx "$WEB_SERVICE"; then
        fail "docker-compose.yml defines no '$WEB_SERVICE' service — the ISR cache cannot be cleared"
    fi
fi

# Window ends at the previous calendar year; ten-year climatology.
if [[ -n "${YEARS:-}" ]]; then
    years="$YEARS"
else
    end_year=$(( $(date --utc +%Y) - 1 ))
    start_year=$(( end_year - 9 ))
    years="${start_year}-${end_year}"
fi

log "yearly-era5 start years=${years} dry_run=${DRY_RUN}"

# ── 1. download ──────────────────────────────────────────────────────────
# Cached by input hash: the nine years already on disk are not re-fetched.
log "stage=download source=era5 years=${years}"
run "$UV" run --directory pipeline wtg download era5 --years "$years"

# ── 2. invalidate the aggregate cache without losing the parts ───────────
# Paths come from the pipeline's own config rather than being spelled out —
# `intermediate/aggregated/<level>.parquet`, with parts in the matching
# `.parts` directory. Hardcoding a plausible path here would silently skip
# the invalidation and republish last year's climatology as this year's.
log "stage=invalidate-aggregates"
if [[ "$DRY_RUN" == "1" ]]; then
    log "+ mv -f <intermediate>/aggregated/{country,admin1,admin2}.parquet {,.previous}"
    log "  (parts directories are left alone: --force would delete them, and"
    log "   they are what makes a multi-day admin-2 run resumable)"
else
    for level in country admin1 admin2; do
        parquet="$("$UV" run --directory pipeline python -c \
            "from wtg_pipeline.processing.aggregate import aggregated_path
print(aggregated_path('${level}'))")"
        if [[ -f "$parquet" ]]; then
            mv -f "$parquet" "${parquet}.previous"
            log "moved aside ${parquet} (cache now cold, parts intact)"
        else
            log "no combined parquet for ${level}; nothing to invalidate"
        fi
    done
fi

# ── 3. aggregate + percentiles ───────────────────────────────────────────
# NEVER add --force to the aggregate step. See the header.
log "stage=aggregate level=all"
run "$UV" run --directory pipeline wtg process aggregate --level all --years "$years"

log "stage=percentiles level=all"
run "$UV" run --directory pipeline wtg process percentiles --level all --force

# Validation, not a build step: it compares derived sunshine against the five
# reference cities and exits non-zero if the derivation has drifted. Fatal on
# purpose — publishing a sunshine series nobody checked is worse than a failed
# cron, and `wtg pipeline full` treats it the same way.
log "stage=validate-sunshine"
run "$UV" run --directory pipeline wtg process sunshine

# ── 4. tiers ─────────────────────────────────────────────────────────────
# `rebuild-tiles.sh` builds free first and purges the CDN only after every
# tier succeeds. An unconditional both-tier run with the ADM2 sources missing
# therefore rebuilds free, fails on premium, and exits before the purge —
# leaving new tiles on disk and old ones being served. So decide the tier list
# here, from the pipeline's own path (the `geoboundaries` segment repeats, and
# the shorter path exists and is empty — it has been mis-read before).
if [[ -n "${TIERS:-}" ]]; then
    log "stage=tiers tiers=${TIERS} source=env"
elif [[ "$DRY_RUN" == "1" ]]; then
    TIERS="free premium"
    log "stage=tiers tiers=${TIERS} source=assumed-in-dry-run"
else
    ADM2_DIR="$("$UV" run --directory pipeline python -c \
        "from wtg_pipeline.config import boundaries_raw_dir
print(boundaries_raw_dir() / 'geoboundaries' / 'adm2')")"
    adm2_count=$(find "$ADM2_DIR" -maxdepth 1 -name '*_ADM2.geojson' 2>/dev/null | wc -l)
    if [[ "$adm2_count" -gt 0 ]]; then
        TIERS="free premium"
        log "stage=tiers tiers=${TIERS} adm2_files=${adm2_count}"
    elif [[ "${ALLOW_FREE_ONLY:-0}" == "1" ]]; then
        TIERS="free"
        log "WARN: no *_ADM2.geojson under ${ADM2_DIR} — free tier only, by request."
        log "WARN: premium keeps last year's climate until it is rebuilt."
    else
        # Unlike the weekly advisory run, this one is the whole point of the
        # year. Degrading silently to free would leave every paying user on
        # last year's data with nothing in the log that looks like a failure.
        fail "no *_ADM2.geojson under ${ADM2_DIR} — run \`wtg download boundaries --source geoboundaries\` first, or set ALLOW_FREE_ONLY=1"
    fi
fi

# ── 5. tiles + CDN purge ─────────────────────────────────────────────────
# rebuild-tiles.sh re-runs `wtg build geojson --tier <t> --force` per tier
# (that is the geojson build for this pipeline run), then tippecanoe, then
# verify, then the bunny.net purge. It holds its own lock and reads BUNNY_*
# from the repo-root .env when they are not in the environment.
log "stage=rebuild-tiles tiers=${TIERS}"
run env TIERS="$TIERS" ./infra/scripts/rebuild-tiles.sh

# ── 6. the SSR bundle ────────────────────────────────────────────────────
# Same numbers as the tiles, different consumer: the country and region pages.
# Last, because a failure here costs the pages and not the map.
log "stage=publish-api-data"
run "$UV" run --directory pipeline wtg publish api-data

# ── 7. make the pages show it ────────────────────────────────────────────
# The API picks the new bundle up on file mtime with no restart. The *pages*
# do not: `/[country]` is ISR with `revalidate = 30 days`, so without this the
# yearly rebuild is invisible on the site for a month while being live in the
# API — verified on v2, 2026-08-06 (infra/CLAUDE.md § Deploying).
log "stage=recreate-web"
run $COMPOSE up -d --force-recreate "$WEB_SERVICE"

log "yearly-era5 OK years=${years} tiers=${TIERS}"
