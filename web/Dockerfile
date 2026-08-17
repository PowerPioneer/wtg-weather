FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `next build` calls generateStaticParams, which fetches the API's published
# country index to decide which pages to pre-render. Whether that fetch can
# connect decides whether ~2,800 country pages ship as HTML in the image or
# render on demand — the site is correct either way, so the build does not
# fail without it (see lib/country-routes.ts).
#
# Use ./infra/scripts/build-web.sh to build with it reachable. That passes the
# API's IP, because a build step's network namespace can route to the compose
# subnet but cannot resolve `api` in it. The default below is the runtime
# value: honest about what this talks to, and it simply falls back when the
# name does not resolve.
ARG INTERNAL_API_URL=http://api:8000

# Next inlines every NEXT_PUBLIC_* reference into the client bundle at BUILD
# time, so passing these to the container at runtime does nothing for code that
# runs in the browser — it only reaches server components. They were runtime-only
# in compose until 2026-08-17, which meant the browser bundle carried empty
# strings and client-side GlitchTip, PostHog and Plausible were all silently
# inert in production. Anything a browser must know has to arrive here.
#
# Each defaults to empty: an unset integration disables itself (see lib/env.ts),
# which is the correct behaviour for a build with no .env, not a build failure.
ARG NEXT_PUBLIC_SITE_URL=
ARG NEXT_PUBLIC_APP_ENV=
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_CDN_URL=
ARG NEXT_PUBLIC_PLAUSIBLE_DOMAIN=
ARG NEXT_PUBLIC_PLAUSIBLE_SRC=
ARG NEXT_PUBLIC_POSTHOG_KEY=
ARG NEXT_PUBLIC_POSTHOG_HOST=
ARG NEXT_PUBLIC_GLITCHTIP_DSN_WEB=
ARG NEXT_PUBLIC_GLITCHTIP_RELEASE=

ENV INTERNAL_API_URL=${INTERNAL_API_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV} \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_CDN_URL=${NEXT_PUBLIC_CDN_URL} \
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN=${NEXT_PUBLIC_PLAUSIBLE_DOMAIN} \
    NEXT_PUBLIC_PLAUSIBLE_SRC=${NEXT_PUBLIC_PLAUSIBLE_SRC} \
    NEXT_PUBLIC_POSTHOG_KEY=${NEXT_PUBLIC_POSTHOG_KEY} \
    NEXT_PUBLIC_POSTHOG_HOST=${NEXT_PUBLIC_POSTHOG_HOST} \
    NEXT_PUBLIC_GLITCHTIP_DSN_WEB=${NEXT_PUBLIC_GLITCHTIP_DSN_WEB} \
    NEXT_PUBLIC_GLITCHTIP_RELEASE=${NEXT_PUBLIC_GLITCHTIP_RELEASE} \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apk add --no-cache wget \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=10 --start-period=20s \
    CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
