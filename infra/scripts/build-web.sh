#!/usr/bin/env bash
# Build the web image with the country pages actually pre-rendered.
#
# Why this is not just `docker compose build web`
# -----------------------------------------------
#
# `next build` runs generateStaticParams, which fetches `/v1/countries` to
# learn which country pages to emit as HTML. A plain `docker compose build web`
# runs on the default bridge network where the API is unreachable, so the build
# finds nothing and all ~2,800 country pages fall back to rendering on first
# request. The site is correct either way — this is about who pays for the
# first render, not about whether the page works.
#
# Getting a build onto the compose network takes two things:
#
#   1. A builder that lives on it. BuildKit's default `docker` driver refuses
#      outright: `network mode "wtg-weather_internal" not supported by
#      buildkit`. So this creates a `docker-container` builder with the
#      `network` driver-opt. That network is `internal: true`, so the builder
#      is also attached to the default bridge or it could not pull base images
#      or reach the npm registry.
#
#   2. The API's **IP address**, not its name. Build steps run in a nested
#      network namespace that NATs out through the builder container, so the
#      route to the compose subnet works — but the sandbox has its own
#      resolver, and `api` does not resolve in it. Passing the hostname fails
#      with ENOTFOUND while the identical request to the IP succeeds.
#
# The alternative to (2) is `RUN --network=host` in the Dockerfile plus a
# `network.host` insecure entitlement on the builder. That works too, and it is
# rejected on purpose: `RUN --network=host` is a hard build failure on any
# default builder, so it would turn a laptop's `docker compose build web` into
# an error to save the production build a lookup. Passing an IP keeps the
# Dockerfile portable.
#
# Idempotent, and it verifies the result rather than assuming it: the build log
# is checked for the fallback warning, so a builder whose networking has
# drifted fails here instead of silently shipping an unrendered image.
#
# Usage:
#     ./infra/scripts/build-web.sh          # then: docker compose up -d web
#
# When you need NO_CACHE=1
# ------------------------
#
# The pre-render bakes the API's *responses* into the image, but Docker's cache
# key is the *source tree*. So a content-only change — `wtg publish api-data`
# after an advisory run, a prose regeneration, a corrected region name — leaves
# every input Docker looks at identical, the build step never re-runs, and the
# image ships the previous pre-render. Nothing downstream notices: the pages
# all serve, they just serve the old text.
#
# Rule of thumb: if the last thing you did was republish the country bundle
# rather than edit `web/`, you want NO_CACHE=1.
#
# Optional env:
#   BUILDER_NAME           — default "wtg-internal"
#   COMPOSE_PROJECT_NAME   — defaults to the repo directory name, as compose does
#   NO_CACHE               — set to 1 to rebuild without the layer cache, for a
#                            content-only republish (see above)
#   ALLOW_UNRENDERED=1     — build anyway if the API cannot be reached
set -euo pipefail

log() { printf '%s %s\n' "$(date --utc +%FT%TZ)" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

cd "$(dirname "$0")/../.."

BUILDER_NAME="${BUILDER_NAME:-wtg-internal}"
PROJECT="${COMPOSE_PROJECT_NAME:-$(basename "$(pwd)")}"
NETWORK="${PROJECT}_internal"
EGRESS_NETWORK="bridge"
LOG_FILE="$(mktemp)"
trap 'rm -f "$LOG_FILE"' EXIT

command -v docker >/dev/null 2>&1 || fail "docker not on PATH"
docker network inspect "$NETWORK" >/dev/null 2>&1 \
    || fail "network '$NETWORK' does not exist — start the stack first (docker compose up -d), \
or set COMPOSE_PROJECT_NAME if this checkout uses a different project name."

# ── the API's address on that network ────────────────────────────────────
API_CID="$(docker compose ps -q api || true)"
[[ -n "$API_CID" ]] || fail "the api service is not running — start it first: docker compose up -d api"

API_IP="$(docker inspect -f "{{index .NetworkSettings.Networks \"${NETWORK}\" \"IPAddress\"}}" "$API_CID")"
[[ -n "$API_IP" ]] || fail "could not resolve the api container's address on '$NETWORK'"
API_URL="http://${API_IP}:8000"
log "api reachable at ${API_URL} (resolved fresh: this address changes whenever the container is recreated)"

# ── the builder ──────────────────────────────────────────────────────────
if docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
    log "builder '$BUILDER_NAME' exists"
else
    log "creating builder '$BUILDER_NAME' on network '$NETWORK'"
    docker buildx create --name "$BUILDER_NAME" --driver docker-container \
        --driver-opt "network=${NETWORK}" --bootstrap >/dev/null
fi
docker buildx inspect --bootstrap "$BUILDER_NAME" >/dev/null

CONTAINER="buildx_buildkit_${BUILDER_NAME}0"
docker inspect "$CONTAINER" >/dev/null 2>&1 \
    || fail "cannot find the buildkit container '$CONTAINER' for builder '$BUILDER_NAME'"

for net in "$NETWORK" "$EGRESS_NETWORK"; do
    if docker inspect -f '{{range $n, $_ := .NetworkSettings.Networks}}{{$n}} {{end}}' "$CONTAINER" \
        | tr ' ' '\n' | grep -qx "$net"; then
        log "builder already on '$net'"
    else
        log "connecting builder to '$net'"
        docker network connect "$net" "$CONTAINER"
    fi
done

# ── build ────────────────────────────────────────────────────────────────
log "stage=build-web builder=${BUILDER_NAME}"
set +e
cache_args=()
if [[ "${NO_CACHE:-0}" == "1" ]]; then
    log "NO_CACHE=1 - rebuilding without the layer cache so the pre-render re-runs"
    cache_args+=(--no-cache)
fi
BUILDX_BUILDER="$BUILDER_NAME" docker compose build "${cache_args[@]}" \
    --build-arg "INTERNAL_API_URL=${API_URL}" web 2>&1 | tee "$LOG_FILE"
status=${PIPESTATUS[0]}
set -e
[[ $status -eq 0 ]] || fail "docker compose build web failed (exit $status)"

# ── verify the pre-render actually happened ──────────────────────────────
# Checked rather than assumed. An unrendered image is indistinguishable from a
# rendered one at runtime — every page still serves, just more slowly the first
# time — so nothing downstream would ever catch this.
if grep -q "country-routes] the API is not reachable" "$LOG_FILE"; then
    if [[ "${ALLOW_UNRENDERED:-0}" == "1" ]]; then
        log "WARN: pages were NOT pre-rendered; continuing because ALLOW_UNRENDERED=1"
    else
        fail "the build could not reach the API, so no country page was pre-rendered. \
The image is usable — re-run with ALLOW_UNRENDERED=1 to accept it — but something \
about the builder's networking has drifted. Try: docker buildx rm ${BUILDER_NAME} && $0"
    fi
else
    # Two things this line has to survive, both of which killed the script
    # silently before — `set -e` plus `pipefail` means a `grep` that matches
    # nothing takes the whole run down, and it did so *after* a successful
    # build and one line before the OK below. The documented deploy is
    # `build-web.sh && docker compose up -d web`, so the effect was an image
    # that built fine and was never deployed, with nothing printed to say so.
    #
    #   1. Next now prints "Generating static pages using 3 workers (777/3111)"
    #      — the worker count sits between "pages" and the counter, so the old
    #      anchored pattern stopped matching on a perfectly good build.
    #   2. A fully cached build re-runs no build step at all, so the line is
    #      absent however it is spelled.
    #
    # Hence `|| true`: the count is a nicety. The claim that matters is the
    # API-reachability check above, which is a real gate and still fails hard.
    # A cached build reuses the very layer whose pre-render was verified when
    # it was built, so "unknown" is honest for a source-only change. It is a
    # warning sign after a *content* republish, though - see NO_CACHE at the
    # top - because then the reused layer is exactly the stale thing.
    rendered=$(grep -oE "Generating static pages [^(]*\(([0-9]+)/[0-9]+\)" "$LOG_FILE" \
        | tail -1 | grep -oE "/[0-9]+" | tr -d '/' || true)
    if [[ -n "$rendered" ]]; then
        log "pre-rendered ${rendered} pages"
    else
        log "pre-rendered ? pages (no build step ran — cached layer reused)"
    fi
fi

log "build-web OK — deploy with: docker compose up -d web"
