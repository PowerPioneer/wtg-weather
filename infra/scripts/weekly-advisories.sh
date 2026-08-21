#!/usr/bin/env bash
# Weekly advisory refresh: scrape all six governments, consolidate, republish
# the country-page bundle, and — only if some government actually moved a
# country's level — rebuild the PMTiles so the map's Safety mode reflects it,
# purging the bunny.net cache on the way.
#
# Two outputs, two cadences, and they are not the same question. The country
# pages republish every week a scrape succeeds, because they print each
# government's `checked` date. The tiles rebuild only when a level moves,
# because that is the only thing baked into them.
#
# Why a tile rebuild rather than a JSON overlay: the advisory level is baked
# into the tiles as a month-less `safety` feature property (see
# `pipeline/src/wtg_pipeline/tiles/build_geojson.py`). Serving it separately
# would mean the browser fetching climate-adjacent data at runtime, which
# `web/CLAUDE.md` forbids ("never fetch climate data from the browser; it's
# baked into PMTiles"). Keeping one source of truth costs a rebuild on the
# weeks something changes and nothing on the weeks it doesn't.
#
# The pipeline runs on the host, not in a container — `uv` is the entrypoint,
# same as `rebuild-tiles.sh`. (There is no `pipeline` service in
# docker-compose.yml; an earlier version of this script assumed one and could
# never have run.)
#
# Idempotent: `wtg process advisories` leaves both of its outputs untouched
# when their content is unchanged, so re-running within the week is a no-op
# and the rebuild is skipped. Lock file under /tmp prevents two cron fires
# from colliding.
#
# Loggable: every stage prefixes its output with an RFC3339 timestamp.
#
# Optional env:
#   UV                   — default "uv"
#   FORCE_REBUILD        — set to 1 to rebuild tiles even if no level moved
#   BUNNY_API_KEY        — passed through to rebuild-tiles.sh
#   BUNNY_PULL_ZONE_ID   — passed through to rebuild-tiles.sh
set -euo pipefail

log() { printf '%s %s\n' "$(date --utc +%FT%TZ)" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

UV="${UV:-uv}"
LOCK="/tmp/wtg-weekly-advisories.lock"

# flock guards against overlap if cron misfires or a previous run hasn't
# finished. `-n` returns immediately if already held; `9` is the fd.
exec 9>"$LOCK"
if ! flock -n 9; then
    fail "another weekly-advisories run is in progress (lock: $LOCK)"
fi

cd "$(dirname "$0")/../.."

command -v "$UV" >/dev/null 2>&1 || fail "uv not on PATH; install with: curl -LsSf https://astral.sh/uv/install.sh | sh"

INDEX="pipeline/data/intermediate/advisories/safety_index.json"

# Hash before and after. The index is byte-stable by construction (sorted
# keys, no timestamps), so a changed hash means a government changed a level
# — not that we scraped again. Rewording alone changes advisories.json, which
# the API serves fresh without a tile rebuild.
index_hash() { [[ -f "$INDEX" ]] && sha256sum "$INDEX" | cut -d' ' -f1 || printf 'absent'; }
before="$(index_hash)"

log "stage=download source=all"
"$UV" run --directory pipeline wtg download advisories --source all

log "stage=consolidate"
"$UV" run --directory pipeline wtg process advisories

after="$(index_hash)"
[[ "$after" != "absent" ]] || fail "consolidation produced no safety index at $INDEX"

# ── country pages ────────────────────────────────────────────────────────
# Republish on EVERY successful consolidation, not only when a level moved.
#
# The rebuild branch below watches the safety *index* — levels only, byte-stable
# by construction. The country pages read `advisories.json`, which also carries
# each government's `checked` date, and that moves every week a scrape succeeds.
# Those dates are exactly what the stale badge reads
# (`web/src/lib/advisory-freshness.ts`: neutral once every source's `checked` is
# more than 14 days old). Publish only when a level changes and a site scraping
# perfectly every Sunday still tells visitors its advisories may be out of date,
# a fortnight after the last time some government moved one.
#
# Cheap by construction: `publish api-data` is byte-stable and pruning, so it
# rewrites only the payloads that actually differ.
log "stage=publish"
publish_out="$("$UV" run --directory pipeline wtg publish api-data)"
printf '%s\n' "$publish_out"
changed_payloads="$(printf '%s' "$publish_out" \
    | grep -oE 'changed=[0-9]+' | head -1 | cut -d= -f2 || echo 0)"

# The API serves this bundle off a read-only mount keyed on file mtime, so it
# picks the new payloads up with no restart. Already-rendered pages do not:
# `/[country]` is ISR with a 30-day window, so the running container keeps
# serving last month's HTML until its render cache is dropped. Recreating is
# the documented way (infra/CLAUDE.md) and costs a few seconds of 502s through
# Caddy — worth it when something changed, wasteful every week when nothing did.
if [[ "${changed_payloads:-0}" -gt 0 ]]; then
    if command -v docker >/dev/null 2>&1; then
        log "stage=recreate-web payloads_changed=${changed_payloads}"
        # Deliberately non-fatal: the bundle is already published and the API is
        # already serving it. A failure here must not abort the tile rebuild
        # below, which is the half that keeps the *map* honest.
        docker compose up -d --force-recreate web \
            || log "WARN: web recreate failed — country pages keep serving cached renders until this is retried"
    else
        log "WARN: docker not on PATH — country pages keep serving cached renders"
    fi
else
    log "stage=recreate-web skipped — no country payload changed"
fi

if [[ "$before" == "$after" && "${FORCE_REBUILD:-0}" != "1" ]]; then
    log "stage=rebuild skipped — no advisory level changed this week"
    log "weekly-advisories OK (pages published, tiles unchanged)"
    exit 0
fi

# The premium tier is built from ~3.5 GB of geoBoundaries ADM2 sources. If
# they are ever absent, `wtg build geojson --tier premium` fails loudly rather
# than shipping an empty admin-2 layer — but `rebuild-tiles.sh` purges the CDN
# only after *every* tier succeeds, and builds free first. An unconditional
# both-tier run would therefore rebuild free, fail on premium, and exit before
# the purge, leaving the new free tiles on disk and the old ones still served.
# So pick the tiers we can actually build.
#
# The directory is resolved from the pipeline's own config rather than spelled
# out here: the layout is `<boundaries_raw_dir>/geoboundaries/adm2`, i.e. the
# segment repeats, and hardcoding a plausible-looking path silently degrades
# every run to free-only.
ADM2_DIR="$("$UV" run --directory pipeline python -c \
    "from wtg_pipeline.config import boundaries_raw_dir
print(boundaries_raw_dir() / 'geoboundaries' / 'adm2')")"
adm2_count=$(find "$ADM2_DIR" -maxdepth 1 -name '*_ADM2.geojson' 2>/dev/null | wc -l)
if [[ "$adm2_count" -gt 0 ]]; then
    TIERS="free premium"
    log "adm2 sources: ${adm2_count} file(s) under ${ADM2_DIR}"
else
    TIERS="free"
    log "WARN: no *_ADM2.geojson under ${ADM2_DIR} — rebuilding the FREE tier only."
    log "WARN: premium keeps its current advisory levels until someone runs"
    log "WARN: \`wtg download boundaries --source geoboundaries\` and rebuilds it."
fi

# `rebuild-tiles.sh` re-runs `wtg build geojson --force` per tier, which is
# what picks the new levels up, then rebuilds the archives and purges the pull
# zone. It reads BUNNY_* from the repo-root .env if not in the environment,
# and holds its own lock.
log "stage=rebuild tiers=${TIERS} reason=$( [[ "${FORCE_REBUILD:-0}" == "1" ]] && echo forced || echo levels-changed )"
TIERS="$TIERS" ./infra/scripts/rebuild-tiles.sh

log "weekly-advisories OK (tiles rebuilt: ${TIERS})"
