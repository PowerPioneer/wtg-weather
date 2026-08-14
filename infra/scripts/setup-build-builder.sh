#!/usr/bin/env bash
# Create (or repair) the buildx builder that can reach the API during a build.
#
# Why this exists
# ---------------
#
# `next build` runs `generateStaticParams`, which fetches `/v1/countries` to
# learn which country pages to pre-render. A normal `docker compose build web`
# runs on the default bridge network, where `api` does not resolve, so the
# build legitimately finds nothing and every one of the ~2,800 country pages
# falls back to rendering on demand. The site is correct either way; the
# difference is whether the first visitor to each page pays for the render.
#
# BuildKit's default `docker` driver refuses to attach a build to a named
# network at all:
#
#     network mode "wtg-weather_internal" not supported by buildkit - you can
#     define a custom network for your builder using the network driver-opt
#
# So this creates a `docker-container` builder that lives *on* the compose
# network. One wrinkle the error message does not mention: `internal: true` on
# that network means no egress, and the build also needs Docker Hub and the npm
# registry. The builder is therefore dual-homed — the compose network for
# `api`, the default bridge for the outside world.
#
# Idempotent. Safe to run before every deploy; it repairs a builder whose
# network attachments have drifted (which happens after `docker compose down`,
# because the network is recreated with a new id).
#
# Usage:
#     ./infra/scripts/setup-build-builder.sh
#     BUILDX_BUILDER=wtg-internal docker compose build web
#
# Optional env:
#   BUILDER_NAME           — default "wtg-internal"
#   COMPOSE_PROJECT_NAME   — defaults to the repo directory name, as compose does
set -euo pipefail

log() { printf '%s %s\n' "$(date --utc +%FT%TZ)" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

cd "$(dirname "$0")/../.."

BUILDER_NAME="${BUILDER_NAME:-wtg-internal}"
PROJECT="${COMPOSE_PROJECT_NAME:-$(basename "$(pwd)")}"
NETWORK="${PROJECT}_internal"
# Egress. The compose network is `internal: true`, so on its own it cannot
# reach the registry the base images come from.
EGRESS_NETWORK="bridge"

command -v docker >/dev/null 2>&1 || fail "docker not on PATH"

if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
    fail "network '$NETWORK' does not exist — start the stack first (docker compose up -d), \
or set COMPOSE_PROJECT_NAME if this checkout uses a different project name."
fi

if docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
    log "builder '$BUILDER_NAME' exists"
else
    log "creating builder '$BUILDER_NAME' on network '$NETWORK'"
    docker buildx create \
        --name "$BUILDER_NAME" \
        --driver docker-container \
        --driver-opt "network=${NETWORK}" \
        --bootstrap >/dev/null
fi

# `--bootstrap` above starts the container; an existing builder may be stopped.
docker buildx inspect --bootstrap "$BUILDER_NAME" >/dev/null

# The buildkit container is named after the builder with a node suffix. Ask
# buildx rather than guessing, so this keeps working if that naming changes.
CONTAINER="buildx_buildkit_${BUILDER_NAME}0"
docker inspect "$CONTAINER" >/dev/null 2>&1 \
    || fail "cannot find the buildkit container '$CONTAINER' for builder '$BUILDER_NAME'"

attached() {
    docker inspect -f '{{range $net, $_ := .NetworkSettings.Networks}}{{$net}} {{end}}' \
        "$CONTAINER" | tr ' ' '\n' | grep -qx "$1"
}

for net in "$NETWORK" "$EGRESS_NETWORK"; do
    if attached "$net"; then
        log "builder already on '$net'"
    else
        log "connecting builder to '$net'"
        docker network connect "$net" "$CONTAINER"
    fi
done

# Prove both halves rather than trusting the attachments: a stale network id
# survives `docker network connect` and only shows up as a DNS failure
# thirty seconds into a build.
log "verifying the builder can resolve the api service"
if docker exec "$CONTAINER" nslookup api >/dev/null 2>&1 \
    || docker exec "$CONTAINER" getent hosts api >/dev/null 2>&1; then
    log "api resolves from the builder"
else
    fail "builder cannot resolve 'api' — is the api service running? \
Try: docker buildx rm $BUILDER_NAME && $0"
fi

log "OK — build with: BUILDX_BUILDER=$BUILDER_NAME docker compose build web"
