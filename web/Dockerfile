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
ENV INTERNAL_API_URL=${INTERNAL_API_URL} \
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
