# Where to Go for Great Weather — v2 Rebuild Plan

Single reference document for rebuilding `wheretogoforgreatweather.com` in Claude Code. Drop this at the root of the new repo and feed it to Claude Code at the start of each phase.

---

## 1. Locked Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + shadcn/ui |
| Map | MapLibre GL JS via `react-map-gl/maplibre` + PMTiles protocol |
| Backend | FastAPI + Python 3.12 + SQLAlchemy 2.x + Alembic |
| Database | Postgres 16 (shared instance; separate DBs per service) |
| Queue / cache | Redis 7 (GlitchTip + API rate limits) |
| Pipeline | Python 3.12 as an installable package (`wtg-pipeline`) |
| Climate sources | ERA5 monthly means (temp, precip, SSRD → sunshine, wind, snow depth, SST, humidity) |
| Boundaries | Natural Earth (country, admin-1) + geoBoundaries CC-BY-4.0 (admin-2) |
| Advisories | US State Dept + UK FCDO + Canada + Australia Smartraveller + Germany Auswärtiges Amt |
| Tiles | Two PMTiles files: `free.pmtiles`, `premium.pmtiles`. Signed URLs from FastAPI. |
| Payments | Paddle (Merchant of Record — handles EU/UK/US VAT) |
| Auth | Magic link + Google OAuth, HttpOnly SameSite=Lax session cookies |
| CDN | bunny.net in front of Caddy |
| Reverse proxy | Caddy (auto-SSL) |
| Containers | Docker Compose on 16GB Ubuntu server |
| Observability | GlitchTip (self-hosted) |
| Analytics | Plausible self-hosted (pre-login) + PostHog Cloud free tier (post-login only, identified) |
| Email | SendGrid free tier → Postmark once paying users exist |
| Backups | Nightly `pg_dump` → age-encrypted → Backblaze B2 |
| Scheduler | Host cron |
| Package managers | `pnpm` (JS) + `uv` (Python) |
| Migration | Parallel deploy on `v2.wheretogoforgreatweather.com`, DNS cutover when stable |

### Pricing (for Paddle setup)

| Tier | Price | Contents |
|---|---|---|
| Free | €0 | Country + admin-1, temp/rain/sun + wind, ads |
| Consumer Premium | €2.99/mo or €24/yr | Admin-2, all variables, percentiles, saved trips, favourites, alerts, no ads |
| Agency Starter | €39/mo | 3 seats, everything premium + client management |
| Agency Pro | €99/mo | 10 seats |
| Agency Enterprise | Custom | Unlimited seats + API access |

White-label and home-country-aware advisory weighting are parked for v2.

### Server memory budget (rough)

Postgres 1GB · Redis 100MB · ClickHouse-for-Plausible 2GB · Plausible 500MB · Next.js 500MB · FastAPI 500MB · Caddy 100MB · GlitchTip (web+worker) 500MB ≈ **5.5GB at idle**. Pipeline runs can spike 2–4GB of additional RAM for xarray. Fits comfortably in 16GB.

---

## 2. Monorepo Layout

```
wtg-weather/
├── CLAUDE.md                    ← always loaded
├── README.md
├── .gitignore
├── .env.example                 ← committed template
├── .env                         ← gitignored, real values
├── docker-compose.yml
├── docker-compose.dev.yml
├── Caddyfile
├── .claude/
│   ├── settings.json            ← permissions (allow builds, deny .env reads)
│   ├── commands/
│   │   ├── pipeline-run.md      ← /project:pipeline-run
│   │   ├── deploy.md
│   │   └── db-migrate.md
│   └── rules/
│       ├── security.md
│       ├── testing.md
│       └── commit-style.md
│
├── pipeline/                    ← Python data pipeline
│   ├── CLAUDE.md                ← loaded lazily
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── README.md
│   ├── src/wtg_pipeline/
│   │   ├── __init__.py
│   │   ├── cli.py               ← typer entry: `wtg <cmd>`
│   │   ├── config.py
│   │   ├── sources/
│   │   │   ├── era5.py
│   │   │   ├── geoboundaries.py
│   │   │   └── advisories/
│   │   │       ├── __init__.py
│   │   │       ├── base.py
│   │   │       ├── us_state.py
│   │   │       ├── uk_fcdo.py
│   │   │       ├── canada.py
│   │   │       ├── australia.py
│   │   │       └── germany.py
│   │   ├── processing/
│   │   │   ├── aggregate.py     ← polygon aggregation
│   │   │   ├── percentiles.py   ← 10/50/90 across 10-year window
│   │   │   ├── sunshine.py      ← SSRD → hours
│   │   │   └── scoring.py       ← match quality rules
│   │   └── tiles/
│   │       ├── build_geojson.py
│   │       ├── tippecanoe.py    ← shell out to tippecanoe
│   │       └── pmtiles.py       ← mbtiles → pmtiles
│   ├── tests/
│   └── data/                    ← gitignored; see data layout below
│
├── api/                         ← FastAPI backend
│   ├── CLAUDE.md
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── src/wtg_api/
│   │   ├── __init__.py
│   │   ├── main.py              ← app factory
│   │   ├── config.py
│   │   ├── db.py                ← async SQLAlchemy session
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── organization.py
│   │   │   ├── membership.py
│   │   │   ├── client.py        ← agency's customers
│   │   │   ├── trip.py
│   │   │   ├── favourite.py
│   │   │   └── alert.py
│   │   ├── routers/
│   │   │   ├── auth.py          ← magic link + Google OAuth
│   │   │   ├── users.py
│   │   │   ├── orgs.py
│   │   │   ├── trips.py
│   │   │   ├── tiles.py         ← signed URL issuer
│   │   │   ├── paddle.py        ← webhook receiver
│   │   │   └── public.py        ← country/region climate data for SSR
│   │   ├── services/
│   │   │   ├── entitlements.py
│   │   │   ├── email.py         ← SendGrid/Postmark adapter
│   │   │   └── signing.py       ← tile URL HMAC
│   │   ├── middleware/
│   │   │   ├── session.py
│   │   │   └── cors.py
│   │   └── schemas/             ← Pydantic models
│   ├── migrations/              ← Alembic
│   └── tests/
│
├── web/                         ← Next.js 15 App Router
│   ├── CLAUDE.md
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── Dockerfile
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                        ← map (/)
│   │   │   ├── [country]/page.tsx              ← /peru
│   │   │   ├── [country]/[month]/page.tsx      ← /peru/april
│   │   │   ├── [country]/[region]/page.tsx
│   │   │   ├── [country]/[region]/[month]/page.tsx
│   │   │   ├── trips/[id]/page.tsx
│   │   │   ├── pricing/page.tsx
│   │   │   ├── agencies/page.tsx
│   │   │   ├── (auth)/login/page.tsx
│   │   │   ├── (dashboard)/account/
│   │   │   └── api/                            ← edge-only endpoints (if any)
│   │   ├── components/
│   │   │   ├── map/
│   │   │   │   ├── MapCanvas.tsx               ← MapLibre container
│   │   │   │   ├── PreferencesPanel.tsx
│   │   │   │   ├── MonthSelector.tsx
│   │   │   │   └── ClimatePanel.tsx            ← Recharts for the charts
│   │   │   └── ui/                             ← shadcn/ui primitives
│   │   ├── lib/
│   │   │   ├── api-client.ts                   ← typed fetch wrapper
│   │   │   ├── pmtiles.ts                      ← MapLibre PMTiles protocol
│   │   │   ├── scoring.ts                      ← client-side match calc
│   │   │   └── session.ts                      ← cookie session helpers
│   │   └── styles/
│   └── public/
│
├── tiles/                       ← PMTiles build artifacts
│   ├── free.pmtiles
│   └── premium.pmtiles
│
└── infra/
    ├── CLAUDE.md
    ├── caddy/
    │   └── Caddyfile
    ├── scripts/
    │   ├── backup-postgres.sh
    │   ├── restore-postgres.sh
    │   ├── rebuild-tiles.sh
    │   └── weekly-advisories.sh
    └── cron/
        └── crontab                             ← installed on host
```

### Pipeline data layout (gitignored)

```
pipeline/data/
├── raw/
│   ├── era5/                   ← NetCDF from CDS API
│   ├── geoboundaries/          ← downloaded shapefiles
│   └── advisories/             ← raw scraper output per source, dated
├── intermediate/
│   ├── era5-geotiff/           ← converted NetCDF
│   └── aggregated/             ← per-polygon stats
└── final/
    ├── country.geojson
    ├── admin1.geojson
    ├── admin2.geojson          ← premium only
    └── advisories.json
```

---

## 3. CLAUDE.md Files

Copy these verbatim into the repo. Subdirectory files load only when Claude reads files in that directory — this keeps context lean.

### 3.1 Root `CLAUDE.md`

```markdown
# Where to Go for Great Weather

Travel-climate map: shows how well each country/region matches a user's
weather preferences for a given month, based on 10 years of ERA5 data,
overlaid with travel advisories from five governments.

## Monorepo

- `pipeline/` — Python data pipeline (ERA5 → GeoJSON → PMTiles)
- `api/` — FastAPI backend (auth, payments, entitlements, tile signing)
- `web/` — Next.js App Router frontend with MapLibre
- `infra/` — Docker Compose, Caddy, cron, backup scripts
- `tiles/` — generated `free.pmtiles` and `premium.pmtiles` (gitignored after phase 3)

Full architecture in `REBUILD_PLAN.md`. Do not modify that file without asking.

## Common commands

- `docker compose up -d` — start full stack
- `docker compose logs -f <service>` — tail one service
- `pnpm -C web dev` — Next.js dev server
- `uv run --directory api uvicorn wtg_api.main:app --reload` — API dev
- `uv run --directory pipeline wtg --help` — pipeline CLI

## Hard rules

- NEVER commit `.env`, `keys/`, `pipeline/data/`, `*.pmtiles`, or `tiles/`.
- NEVER read `.env` files; use `.env.example` for reference.
- NEVER call live Paddle or Stripe from tests; use sandbox / mocks.
- NEVER include PII in logs; redact email and IP at log-line construction.
- Format before commit: `pnpm -C web lint && uv run --directory api ruff check`.
- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`.
- Any change touching auth, payments, or tile signing requires an explicit
  note in the commit body explaining the security implication.

## Conventions

- TypeScript: `strict: true`, no `any`, prefer `unknown` + type guard.
- Python: type hints on every function, `from __future__ import annotations`.
- Tests live next to source: `foo.py` → `test_foo.py`; `Foo.tsx` → `Foo.test.tsx`.
- Database migrations are forward-only; never edit a merged migration.

@./web/CLAUDE.md
@./api/CLAUDE.md
@./pipeline/CLAUDE.md
@./infra/CLAUDE.md
```

### 3.2 `pipeline/CLAUDE.md`

```markdown
# Pipeline — `wtg_pipeline`

Python 3.12 package. Installed in editable mode with `uv`. CLI entrypoint is
`wtg` via `typer`.

## Setup

```bash
cd pipeline
uv sync
uv run wtg --help
```

## Key commands

- `wtg download era5 --years 2016-2025` — fetch monthly means from CDS
- `wtg download advisories --source all` — scrape all five governments
- `wtg download boundaries` — geoBoundaries admin-2 + Natural Earth
- `wtg process aggregate` — polygon aggregation
- `wtg process percentiles` — 10/50/90 across 10-year window
- `wtg build geojson` — produce `data/final/*.geojson`
- `wtg build pmtiles --tier free` — produce `tiles/free.pmtiles`
- `wtg build pmtiles --tier premium` — produce `tiles/premium.pmtiles`
- `wtg pipeline full` — end-to-end

## Rules

- All sources in `src/wtg_pipeline/sources/`. One file per source. Each file
  exports a `fetch()` function that returns raw bytes or a local path.
- Advisories: each government scraper inherits from `advisories/base.py`
  and returns the normalised schema: `{country_iso2, region_code|null,
  level: 1-4, summary, source_url, fetched_at}`.
- Aggregation uses `exactextract` or `rasterstats` — NEVER write a manual
  point-in-polygon loop; it will be too slow.
- Tippecanoe flags for PMTiles:
  - free: `-Z0 -z5 --coalesce-smallest-as-needed`
  - premium: `-Z0 -z9 --coalesce-smallest-as-needed --drop-densest-as-needed`
- All intermediate files are cached. Re-running a step with the same inputs
  should be a no-op unless `--force` is passed.
- Long-running steps must log progress every 30 seconds minimum.

## Testing

- Unit tests use sample fixtures in `tests/fixtures/` (a 10°×10° ERA5 slice,
  5 countries' geoBoundaries, 3 advisory snapshots).
- Never hit the CDS API in tests. Mock `cdsapi.Client`.
- Never hit government websites in tests. Use recorded HTML fixtures.
```

### 3.3 `api/CLAUDE.md`

```markdown
# API — `wtg_api`

FastAPI + async SQLAlchemy + Alembic. Runs on port 8000 inside container.

## Setup

```bash
cd api
uv sync
uv run alembic upgrade head
uv run uvicorn wtg_api.main:app --reload
```

## Architecture

- **Auth**: magic link email (primary) + Google OAuth. Session cookies are
  HttpOnly, Secure, SameSite=Lax, 30-day sliding expiry. Signed with
  `itsdangerous.URLSafeTimedSerializer` using `SESSION_SECRET`.
- **Tile signing**: `/api/tiles/url?tier=premium` returns a URL like
  `https://cdn.../premium.pmtiles?exp=<unix>&sig=<hmac>`. Caddy verifies
  HMAC via a small plugin/handler before serving. Signature lifetime: 15 min.
- **Paddle**: `/api/webhooks/paddle` verifies signature via HMAC, updates
  `organizations.plan` and `.seat_cap`. Idempotent by event ID.
- **Entitlements**: all protected routes pass through `services.entitlements`
  which resolves `(user, plan)` and caches for 60 seconds in Redis.

## Rules

- All DB access is async. Never use sync SQLAlchemy.
- All external HTTP uses `httpx.AsyncClient`; never `requests`.
- Endpoints return Pydantic schemas, never raw model instances.
- Any endpoint touching money, auth, or tile signing must have a test
  that exercises the failure path (forged signature, expired session,
  missing entitlement, double-spend).
- Rate limits: 100 req/min anonymous, 600 req/min authenticated,
  implemented with `slowapi` + Redis.
- CORS: only `https://wheretogoforgreatweather.com` and
  `https://v2.wheretogoforgreatweather.com` in prod; `localhost:3000` in dev.

## Migrations

- `uv run alembic revision --autogenerate -m "description"` — generate
- Always hand-review the generated migration; autogenerate misses enums
  and indexes.
- Never edit a migration after it's been merged to main.
```

### 3.4 `web/CLAUDE.md`

```markdown
# Web — Next.js 15 App Router

TypeScript strict. Tailwind v4. shadcn/ui (copy-paste, living in `components/ui`).

## Setup

```bash
cd web
pnpm install
pnpm dev
```

## Architecture

- **Server Components by default.** Only mark `"use client"` when you need
  state, effects, or browser APIs. The map container is a Client Component;
  the SSR country/region pages are Server Components that fetch from the API.
- **Data fetching**: SSR pages use `fetch(...)` to the internal API via
  `INTERNAL_API_URL` (docker network hostname). Client components use the
  typed `api-client.ts` wrapper.
- **Map stack**: `react-map-gl/maplibre` + `pmtiles` package registers the
  `pmtiles://` protocol on MapLibre. Style is a single JSON object in
  `lib/map-style.ts`. Paint expressions read `feature.properties.score`
  (0-3) and map to colours. Recomputing score on preference change
  happens client-side by updating style paint expressions — no re-fetch.
- **Scoring** lives in `lib/scoring.ts`. Pure functions, unit-tested,
  shared between the map paint expressions and the SSR pages.
- **Auth state**: server-side via `cookies()` in RSC, client-side via
  a `useSession()` hook that reads a lightweight `/api/me` endpoint.

## Rules

- Never fetch climate data from the browser; it's baked into PMTiles.
  Browser only fetches: signed tile URL, user's own trips/favourites,
  `/api/me`, and Paddle checkout URLs.
- SSR pages must be renderable with ZERO client JS for SEO — progressive
  enhancement only. Test with JS disabled.
- Use `next/image` for everything non-map. Never `<img>` in RSC.
- No `localStorage` for preferences — use an HttpOnly cookie set via API,
  or URL search params for shareable states.
- Lighthouse budget: LCP < 2.0s, CLS < 0.05, TBT < 100ms. Regressions
  block merge.

## Routes and SEO

- `/[country]` — `generateStaticParams` over all ~195 countries, static
  at build time, `revalidate: 60*60*24*30` (monthly).
- `/[country]/[month]` — same, 195 × 12 = 2,340 pages.
- `/[country]/[region]` and `/[country]/[region]/[month]` — admin-1 SSR.
- Every SSR page: canonical URL, OpenGraph image (generated at build),
  structured data (`TouristDestination` schema), internal links to
  related months and neighbouring countries.
```

### 3.5 `infra/CLAUDE.md`

```markdown
# Infra

Docker Compose on a 16GB Ubuntu server, Caddy front, bunny.net CDN in front.

## Daily commands

- `docker compose up -d` — boot
- `docker compose logs -f api web` — tail
- `docker compose exec postgres psql -U wtg wtg` — DB shell
- `./infra/scripts/backup-postgres.sh` — manual backup (also runs nightly)
- `./infra/scripts/rebuild-tiles.sh` — regenerate PMTiles and purge bunny.net cache

## Cron (on host, not in container)

- Weekly Sun 03:00 UTC: `weekly-advisories.sh` — scrape + publish new advisories
- Yearly Jan 15 04:00 UTC: `yearly-era5.sh` — full pipeline rebuild, old year swap
- Nightly 02:00 UTC: `backup-postgres.sh` — dump, encrypt, upload to B2

## Caddy

Caddyfile provisions SSL via Let's Encrypt for the apex stack and for the
two ops subdomains. Site blocks:

- `v2.wheretogoforgreatweather.com` (and post-cutover the apex) — public:
  - `/_tiles/*` — HMAC-verified static tile serving from `/var/tiles`
  - `/api/*` — reverse proxy to `api:8000`
  - `/*` — reverse proxy to `web:3000`
- `glitchtip.v2.wheretogoforgreatweather.com` — basic-auth, reverse proxy
  to `glitchtip-web:8000`. Subdomain (not subpath) because GlitchTip
  emits absolute URLs for its static assets and breaks under path stripping.
- `plausible.v2.wheretogoforgreatweather.com` — basic-auth, reverse proxy
  to `plausible:8000`. Same reason as GlitchTip.

## Rules

- Never expose Postgres, Redis, GlitchTip, or Plausible ports on the
  host network. Internal docker network only.
- Secrets live in `.env` at repo root, loaded by compose. Production
  server has its own `.env` — NEVER copied from dev.
- B2 bucket name: `wtg-backups`. Retention: 30 daily, 8 weekly, 12 monthly,
  enforced by lifecycle rule on the bucket side.
- Before any destructive op (`docker compose down -v`, `rm -rf data/`),
  Claude must explicitly confirm with the user.
```

---

## 4. Docker Compose + Caddyfile

### `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: wtg
    volumes:
      - pg-data:/var/lib/postgresql/data
      - ./infra/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks: [internal]

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    networks: [internal]

  clickhouse:
    image: clickhouse/clickhouse-server:24-alpine
    restart: unless-stopped
    volumes:
      - ch-data:/var/lib/clickhouse
    ulimits:
      nofile: {soft: 262144, hard: 262144}
    networks: [internal]

  api:
    build: ./api
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres/wtg
      REDIS_URL: redis://redis:6379/0
      SESSION_SECRET: ${SESSION_SECRET}
      TILE_SIGNING_SECRET: ${TILE_SIGNING_SECRET}
      PADDLE_WEBHOOK_SECRET: ${PADDLE_WEBHOOK_SECRET}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      EMAIL_PROVIDER: ${EMAIL_PROVIDER}
      SENDGRID_API_KEY: ${SENDGRID_API_KEY}
      POSTMARK_TOKEN: ${POSTMARK_TOKEN}
      GLITCHTIP_DSN: ${GLITCHTIP_DSN_API}
    depends_on: [postgres, redis]
    networks: [internal]

  web:
    build: ./web
    restart: unless-stopped
    environment:
      INTERNAL_API_URL: http://api:8000
      NEXT_PUBLIC_API_URL: https://v2.wheretogoforgreatweather.com/api
      NEXT_PUBLIC_CDN_URL: https://wtg.b-cdn.net
      NEXT_PUBLIC_PLAUSIBLE_DOMAIN: v2.wheretogoforgreatweather.com
      NEXT_PUBLIC_POSTHOG_KEY: ${POSTHOG_KEY}
      GLITCHTIP_DSN: ${GLITCHTIP_DSN_WEB}
    depends_on: [api]
    networks: [internal]

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
      - ./tiles:/var/tiles:ro
    depends_on: [api, web]
    networks: [internal, public]

  glitchtip-web:
    image: glitchtip/glitchtip:latest
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres/glitchtip
      SECRET_KEY: ${GLITCHTIP_SECRET_KEY}
      REDIS_URL: redis://redis:6379/1
      EMAIL_URL: ${GLITCHTIP_EMAIL_URL}
    depends_on: [postgres, redis]
    networks: [internal]

  glitchtip-worker:
    image: glitchtip/glitchtip:latest
    restart: unless-stopped
    command: ./bin/run-celery-with-beat.sh
    environment:
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres/glitchtip
      SECRET_KEY: ${GLITCHTIP_SECRET_KEY}
      REDIS_URL: redis://redis:6379/1
    depends_on: [postgres, redis]
    networks: [internal]

  plausible:
    image: ghcr.io/plausible/community-edition:latest
    restart: unless-stopped
    environment:
      BASE_URL: https://plausible.v2.wheretogoforgreatweather.com
      SECRET_KEY_BASE: ${PLAUSIBLE_SECRET_KEY_BASE}
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres/plausible
      CLICKHOUSE_DATABASE_URL: http://clickhouse:8123/plausible
      DISABLE_REGISTRATION: invite_only
    depends_on: [postgres, clickhouse]
    networks: [internal]

volumes:
  pg-data:
  ch-data:
  caddy-data:
  caddy-config:

networks:
  internal:
    internal: true
  public:
```

### `Caddyfile`

```caddy
{
    email you@domain.tld
}

v2.wheretogoforgreatweather.com {
    encode zstd gzip

    # Signed tile serving
    @valid_tile {
        path /_tiles/*
        # HMAC verification is done via a small caddy handler below
    }

    route /_tiles/* {
        # Custom module verifies ?exp=<unix>&sig=<hmac> against TILE_SIGNING_SECRET
        # before serving. If invalid: 403.
        # Alternative: reverse proxy to api:8000 /tiles/verify first.
        reverse_proxy /_tiles/verify api:8000
        root * /var/tiles
        file_server {
            precompressed br
        }
        header Cache-Control "public, max-age=31536000, immutable"
        header Access-Control-Allow-Origin "https://v2.wheretogoforgreatweather.com"
    }

    route /api/* {
        reverse_proxy api:8000
    }

    route /* {
        reverse_proxy web:3000
    }
}

glitchtip.v2.wheretogoforgreatweather.com {
    encode zstd gzip
    basic_auth {
        admin $2a$14$<bcrypt-hash>
    }
    reverse_proxy glitchtip-web:8000
}

plausible.v2.wheretogoforgreatweather.com {
    encode zstd gzip
    basic_auth {
        admin $2a$14$<bcrypt-hash>
    }
    reverse_proxy plausible:8000
}
```

bunny.net pull zone origin → `https://v2.wheretogoforgreatweather.com/_tiles/`. Cache TTL 1 year, edge rules to pass through `exp` and `sig` query params unchanged. On tile rebuild, the `rebuild-tiles.sh` script hits the bunny.net API to purge.

---

## 5. Phased Rebuild Plan

Each phase is a single focused Claude Code session. Start each phase with: `claude` in the repo root, then paste the session prompt. End each phase with a code review, a commit, and a push to a feature branch.

### Phase 1 — Infrastructure + Monorepo Scaffold  (1–2 days)

**Goal:** empty but runnable monorepo. `docker compose up -d` brings every service online with health checks passing. No business logic yet.

**Deliverables:**
- Full folder tree created
- All CLAUDE.md files from section 3 committed
- `docker-compose.yml` + `Caddyfile` from section 4
- `pipeline/`, `api/`, `web/` bootstrapped as minimal "hello world" services
- Postgres initialised with databases: `wtg`, `glitchtip`, `plausible`
- Alembic configured in `api/` with empty initial migration
- `.env.example` with every variable documented
- GitHub repo created, protected `main` branch, `v2-dev` working branch
- Basic GitHub Actions: lint + test on PR (no deploy yet)

**Session prompt to Claude Code:**
> "Read `REBUILD_PLAN.md` sections 2, 3, and 4. Scaffold the monorepo exactly as specified. Use `uv init` for pipeline and api, `pnpm create next-app` for web. For each service, create a trivial health-check endpoint only. Verify `docker compose up -d` succeeds and every service passes healthcheck. Commit as `chore: initial scaffold` on branch `phase-1-scaffold`."

**Acceptance:** `curl localhost/api/health` returns 200; `curl localhost` returns the default Next.js page; postgres has three databases; no service container crashes in 5 minutes of uptime.

---

### Phase 2 — Pipeline: Data Acquisition  (2–3 days)

**Goal:** every external data source downloadable via `wtg download <source>`. Raw data lands in `pipeline/data/raw/`, cached, idempotent, testable.

**Deliverables:**
- `wtg download era5 --years 2016-2025` — downloads monthly NetCDF
- `wtg download boundaries --source naturalearth|geoboundaries` — boundary shapefiles/GeoJSON
- `wtg download advisories --source {us,uk,ca,au,de,all}` — one scraper per government, normalising to a shared schema
- Sub-national advisory parsing for US, UK, Canada, Australia; country-only for Germany (simplest to start)
- Advisory→polygon mapping tables in `pipeline/src/wtg_pipeline/sources/advisories/mappings/` as JSON, one per government
- Fixture-based unit tests for every scraper using recorded HTML

**Session prompt to Claude Code:**
> "Read `REBUILD_PLAN.md` section 5, phase 2. Implement the download CLI commands. Start with ERA5 (port the existing `download_era5_data.py` but extend to 2016–2025 and add wind speed, surface solar radiation, snow depth, sea surface temp, dewpoint for humidity). Then geoBoundaries. Then the five advisory scrapers — put each in its own file inheriting from `advisories/base.py`, and normalise to `{country_iso2, region_code, level, summary, source_url, fetched_at}`. Write fixture-based tests for each scraper. Do NOT run any scraper against live websites in tests."

**Acceptance:** `wtg download --help` lists all sources; running each command twice in a row: second run is a cache hit no-op; `pytest` green; `data/raw/` populated with expected file tree.

---

### Phase 3 — Pipeline: Processing + Tile Generation  (4–5 days)

**Goal:** `wtg pipeline full` end-to-end produces both PMTiles files. Output data matches or exceeds the current live site's quality — and country-level aggregates reflect what travellers actually experience rather than a naive spatial mean across all sovereign territory.

**Deliverables:**
- `wtg process aggregate` — ERA5 raster → polygon stats via `exactextract`, three levels (country, admin-1, admin-2)
- `wtg process percentiles` — 10/50/90 per variable per month per polygon across the 10-year window
- `wtg process sunshine` — SSRD → hours using the existing astronomical day-length calc, validated against 5 reference cities
- `wtg process scoring` — compute default "match" scores per polygon (free tier preferences)
- `wtg build geojson --tier {free,premium}` — produces trimmed GeoJSON
- `wtg build pmtiles --tier {free,premium}` — runs tippecanoe + converts to PMTiles
- `wtg pipeline full` — orchestrates all of the above idempotently
- Integration test: pipeline produces PMTiles that MapLibre can open locally

#### Phase 3a — Aggregation QA (mandatory sub-step, ~4–6 hours)

Naive country-level averaging breaks for countries with non-contiguous or climatically distinct territory. Before shipping, this has to be fixed structurally, not patched later.

**The problem set:**
- US mainland averaged with Alaska and Hawaii → nothing looks like either
- France averaged with French Guiana, Réunion, Martinique, Mayotte, New Caledonia → Paris looks tropical
- Spain averaged with Canary Islands, Ceuta, Melilla → Madrid looks warmer than reality
- UK averaged with Gibraltar, Falklands, British overseas territories
- Netherlands averaged with Caribbean municipalities (Bonaire, Saba, Sint Eustatius)
- Denmark averaged with Greenland and Faroes
- Portugal averaged with Azores and Madeira
- Norway averaged with Svalbard and Jan Mayen
- Chile averaged with Easter Island and Antarctic claims
- Ecuador averaged with Galápagos
- Russia — not non-contiguous but climatically meaningless at country level (Moscow ≠ Vladivostok ≠ Sochi)
- Canada, Australia, Brazil, China, India, Argentina, Kazakhstan — similar size issue

**Resolution strategy (in order of preference):**

1. **Suppress country-level aggregation entirely for "climatically incoherent" countries.** For countries on the suppression list, the country polygon is rendered as an admin-1 mosaic at country-level zoom — each state/region coloured individually, with a country label drawn on top. This is more informative anyway. The suppression list lives in `pipeline/src/wtg_pipeline/processing/country_rules.py` as a declarative table.

2. **For the remaining countries, filter out disjoint/overseas admin-1 polygons before aggregating.** Maintain a `mainland_only` mapping: `{country_iso2: [admin1_codes_to_include]}` — opt-in whitelist, not blacklist, so a new territory doesn't silently contaminate a country's average. Source the polygon membership from geoBoundaries; the whitelist itself is hand-curated.

3. **Area-weighted averaging** for the polygons that remain, using `exactextract`'s fractional cell coverage — already the default but worth confirming.

**QA process:**
- Pick 20 reference countries covering the edge cases: US, France, Spain, UK, Netherlands, Denmark, Portugal, Norway, Chile, Ecuador, Russia, Canada, Australia, Brazil, China, India, Argentina, Kazakhstan, plus 2 "simple" controls (Belgium, Switzerland).
- For each, compute the "great weather score for April" with the free-tier default preferences.
- Eyeball against known reality (Google "weather in [country] in April" — rough calibration, not precision).
- Any country that visibly misrepresents its climate goes on the suppression list or gets its mainland whitelist refined.
- Commit a QA report as `pipeline/docs/aggregation-qa-2026.md` with the 20 reference scores before and after the rules are applied, plus a short rationale for each suppression/whitelist decision.

**Unit tests:**
- For each whitelist entry, a test that loads the country's admin-1 polygons, applies the whitelist, and asserts the expected polygon count.
- For each suppression-list entry, a test asserting the country has NO country-level row in the output dataset.
- A golden-file test: the full QA reference-country score table is checked into the repo; pipeline regressions that change any of the 20 values require explicit approval.

**Session prompt to Claude Code:**
> "Read `REBUILD_PLAN.md` section 5, phase 3 plus `pipeline/CLAUDE.md`. Implement polygon aggregation, percentiles, sunshine derivation, and tile generation. Validate sunshine output against reference cities: Cusco, London, Phoenix, Singapore, Cairo — compare to WorldClim or published norms, tolerance ±1 hour/day. Tippecanoe flags per `pipeline/CLAUDE.md`.
>
> **Phase 3a is mandatory and must happen before tile generation.** Build the suppression list and mainland whitelist in `country_rules.py`, apply them during `wtg process aggregate`, and produce the 20-country QA report. Present the QA report to the user for review BEFORE proceeding to tile generation — do not build PMTiles with un-reviewed aggregation rules.
>
> After `wtg pipeline full`, both PMTiles files must open in `pmtiles` CLI (`pmtiles show tiles/free.pmtiles`) and render in a MapLibre demo served from `python -m http.server`."

**Acceptance:** both PMTiles files exist, sized reasonably (free <50MB, premium <200MB); sunshine reference-city validation passes; aggregation QA report exists, reviewed, committed; suppression list and mainland whitelist have unit tests; `wtg pipeline full` on clean cache produces identical files bit-for-bit when run twice.

---

### Phase 4 — API: Auth, Entitlements, Tile Signing  (3–4 days)

**Goal:** complete API surface for everything a user can do. No UI yet.

**Deliverables:**
- Alembic migrations for all tables in `api/CLAUDE.md`
- Magic-link auth flow: `POST /api/auth/magic-link`, email with signed token, `GET /api/auth/verify` sets session cookie
- Google OAuth: `GET /api/auth/google`, callback, session cookie
- `GET /api/me` — current session
- `POST /api/trips`, `GET /api/trips/:id`, CRUD for trips/favourites/alerts
- Agency endpoints: create org, invite agent, create client, assign trip
- `GET /api/tiles/url?tier=premium` — entitlement check → signed URL
- Caddy handler or reverse-proxy verification of HMAC for `/_tiles/*`
- `POST /api/webhooks/paddle` — signature verify, mutate `organizations.plan`
- Full test suite including failure cases for forged sig, expired session, insufficient entitlement, double-spent webhook

**Session prompt to Claude Code:**
> "Read `REBUILD_PLAN.md` section 5, phase 4 plus `api/CLAUDE.md`. Generate Alembic migrations for the full schema, then implement all routers. For Paddle webhooks use the sandbox. For email use SendGrid in dev (free tier). For tile signing: a 15-minute HMAC-SHA256 over `path+exp` with the shared `TILE_SIGNING_SECRET`. Caddy verification: reverse-proxy to `api:8000/api/tiles/verify` which returns 204 if signature valid, 403 if not, then Caddy serves the file. Write failure-path tests — every money/auth/sig route must have a negative test."

**Acceptance:** full OpenAPI schema at `/api/docs`; `pytest` green with >85% coverage on routers/services/middleware; Paddle sandbox webhook updates a test organization's plan; forged tile signatures return 403.

---

### Phase 4.5 — Design Pass (Claude Design)  (2–3 sessions, not code work)

**Goal:** before Claude Code writes a single React component, decide what the product should *look* like. This happens in Claude Design (Anthropic's design tool), separately from the rebuild, and produces reference material that Phase 5 implements against.

This phase is deliberately scheduled after Phase 4 (API complete) because the API shape tells you exactly what data each screen will have to display — no point designing UI for data that doesn't exist yet.

**Scope — what to design:**

1. **Map view (the home page).** Desktop + mobile. Preferences drawer, month selector, display-mode switcher, climate info panel, score legend, upgrade prompts for premium-gated interactions. The current site's layout works but looks dated; this is the biggest aesthetic win.
2. **Pricing page.** Free / Consumer Premium / Agency Starter / Agency Pro / Enterprise, with clear feature comparison. Must look trustworthy enough to convert at €2.99 — that's a very low price point and buyers decide on feel in seconds.
3. **Country / region SSR pages.** These are the SEO entry points — the first impression for organic search traffic. Header, climate chart trio, best-months summary, related-country links, CTA to open the map.
4. **Trip detail page** (`/trips/[id]`). Shareable, should look good in a link preview and when printed/PDF'd.
5. **Account dashboard.** Consumer: trips, favourites, alerts, billing. Agency owner: everything above plus org members, clients, seat usage.
6. **Agency client management.** Agent's view of a single client — client profile, assigned trips, notes, activity history.
7. **Auth screens.** Magic-link form, Google button, post-login onboarding for both consumer and agency owner.
8. **Empty states and upgrade prompts.** Every place a free user hits a premium gate — these are conversion points, not afterthoughts.

**Workflow:**

- Open Claude Design with a tight brief for each screen, one at a time. Brief template: purpose, who uses it, the data it must display (reference the API response shape from Phase 4), the single action you want the user to take.
- Iterate 3–5 variations per screen, pick one, refine.
- Export as React + Tailwind components where possible; otherwise as annotated screenshots plus design tokens (colours, spacing, typography).
- Commit outputs to `web/design/` in the new repo:
  ```
  web/design/
  ├── tokens.md              ← colour palette, font stack, spacing scale, radii
  ├── map-view.tsx           ← or map-view.png + map-view.md
  ├── pricing.tsx
  ├── country-page.tsx
  ├── region-page.tsx
  ├── trip-detail.tsx
  ├── dashboard-consumer.tsx
  ├── dashboard-agency.tsx
  ├── client-detail.tsx
  ├── auth.tsx
  └── upgrade-prompts.tsx
  ```
- Update `web/CLAUDE.md` with a new section:
  > "## Design reference
  >
  > The canonical visual design for every screen lives in `web/design/`. Claude Code implementing Phase 5 MUST match the visual language defined there (colours, spacing, typography, component patterns). If a design artifact conflicts with a technical constraint (a11y, performance budget, framework limitation), flag it and propose an alternative rather than silently deviating."

**Constraints to respect during design:**

- Accessibility: WCAG AA contrast minimum, visible focus states, all interactions keyboard-reachable. Colourblind-safe palette for the four-tier score colours (the current green/yellow/orange/red is not great for deuteranopia — consider Okabe-Ito or viridis-adjacent).
- Mobile-first for the map (your current traffic is mobile-heavy based on the screenshots you shared).
- No dependency on icons or illustrations that can't be replicated in code — if Claude Design produces a hero illustration you can't recreate, either commission it for real or pick something simpler.
- Motion: minimal, respect `prefers-reduced-motion`.

**Session pattern (not a Claude Code prompt — this is for Claude Design):**
> "I'm redesigning Where to Go for Great Weather. Today I want to design the [pricing page]. Context: free tier has country-level climate data, consumer premium (€2.99/mo) unlocks admin-2 zoom and extra variables, agency tiers add client management. The buyer is a traveller deciding in 30 seconds whether €2.99 is worth it. Show me 3 variations that lead with different emotional hooks: ① credibility and data depth, ② aspirational travel imagery, ③ clean utilitarian comparison. Each variation should show the full tier grid and be mobile-friendly."

**Deliverables:**
- `web/design/` populated with reference material for all 8–10 screen types
- `web/design/tokens.md` — design tokens extractable into Tailwind config
- Updated `web/CLAUDE.md` § Design reference
- A 1-page summary in `web/design/README.md` explaining the overall design direction (serious/credible? playful? minimal?) so future contributors stay on-brand

**Acceptance:** you (the human) look at the full `web/design/` folder and can answer "what should the app feel like?" without ambiguity. Phase 5 should not start until this is done — otherwise Claude Code invents an aesthetic, and you'll regret it at Phase 7.

---

### Phase 5 — Web: Core Map Experience  (4–5 days)

**Goal:** the map works. User without an account can do everything the current live site does, plus it's faster, prettier, and every country/region page is SSR'd.

**Deliverables:**
- Next.js App Router pages from `web/CLAUDE.md` § Routes
- `generateStaticParams` for all country × month combinations at build
- `MapCanvas` with MapLibre + `react-map-gl/maplibre` + PMTiles protocol
- PreferencesPanel, MonthSelector, ClimatePanel (with Recharts for the three charts)
- Client-side scoring in `lib/scoring.ts` driving MapLibre paint expressions
- Zoom-dependent layer switching: country polygons at zoom 0–3, admin-1 at 3–6, admin-2 at 6+ (but 404 for admin-2 without premium)
- Typed API client (`lib/api-client.ts`) generated from OpenAPI
- `sitemap.xml`, `robots.txt`, per-page OG images, structured data
- Lighthouse CI in GitHub Actions, budget from `web/CLAUDE.md`

**Session prompt to Claude Code:**
> "Read `REBUILD_PLAN.md` section 5, phase 5 plus `web/CLAUDE.md` (including the new § Design reference). **Before writing any component, read everything in `web/design/` — that's the canonical visual design you're implementing against, not reinventing.** Use shadcn/ui for primitives where they match the design tokens; otherwise build custom. The map is the hard part — paint expressions must recompute client-side on every preference change WITHOUT re-fetching tiles. Use shared `lib/scoring.ts` between paint and SSR. SSR pages must render the climate charts as static SVG (use `@visx/*` or static Recharts) so they're visible with JS off. Verify with Lighthouse: LCP<2.0s, CLS<0.05, TBT<100ms. Do not implement premium features or auth UI yet — a logged-out user should be able to use the free tier. If a design artifact conflicts with a technical constraint, flag it and propose an alternative rather than silently deviating."

**Acceptance:** parity or better with the current live site for free-tier features; SSR pages render identically with JS disabled; Lighthouse budget green on 3 sample routes; PMTiles loads without CORS errors via bunny.net in staging.

---

### Phase 6 — Premium Features + Agency Accounts  (3–4 days)

**Goal:** every feature gated behind an entitlement works. Agencies can manage clients and seats.

**Deliverables:**
- Login / signup UI (magic link form + Google button)
- Account dashboard: saved trips, favourites, alerts
- Trip creation flow, shareable `/trips/[id]` page with server-side OG image
- Alert UI + backend cron job that fires weekly to check alert triggers and queue emails
- Agency dashboard: invite agents, create clients, assign trips, see seat usage vs cap
- Admin-2 zoom unlocks only with active premium entitlement
- Premium variables (wind, snow, SST, heat index, humidity) shown only when entitled

**Session prompt to Claude Code:**
> "Read `REBUILD_PLAN.md` section 5, phase 6. Implement auth UI, dashboard, trip CRUD, agency management. Alert matching logic: a weekly cron in the API container runs `services.alerts.run_weekly()` which loads all active alerts, recomputes match status, and queues email for any that newly match or stopped matching. Gate premium zoom via `usePremiumEntitlement()` hook that reads from `/api/me`. Gate premium variables via the same hook. The frontend MUST fail gracefully when a non-premium user tries to request the premium PMTiles (403) — show an upgrade prompt, not a map crash."

**Acceptance:** full user journey from signup → subscribe in sandbox Paddle → admin-2 unlocks → alert fires on schedule. All auth/entitlement edge cases tested.

---

### Phase 7 — Paddle Live + Observability + Analytics + Cutover  (2–3 days)

**Goal:** v2 is production-worthy and DNS can flip.

**Deliverables:**
- Paddle live-mode products and prices configured
- Paddle live webhook pointed at prod, signature verified
- GlitchTip receiving errors from both `web` and `api`, Slack/email alert on rate spike
- Plausible self-hosted receiving pre-login traffic; PostHog Cloud receiving post-login traffic with an identify call on login
- `robots.txt` blocking `v2.` until cutover; switched to allow on cutover day
- Nightly backup cron installed on host; tested restore works
- Weekly advisory cron installed on host; tested end-to-end (scrape → rebuild advisories layer → publish)
- Yearly ERA5 cron installed on host; calendar reminder set for owner review in mid-January
- Cutover runbook: 8-step document, tested on staging domain swap

**Session prompt to Claude Code:**
> "Read `REBUILD_PLAN.md` section 5, phase 7. Swap Paddle sandbox → live, wire GlitchTip, set up Plausible (pre-login) and PostHog Cloud (post-login, identified after login). Write `infra/scripts/backup-postgres.sh`, `weekly-advisories.sh`, `rebuild-tiles.sh` — each must be idempotent and loggable. Write a cutover runbook in `infra/CUTOVER.md` with exact DNS changes, rollback procedure, and post-cutover verification checklist. Do NOT flip DNS as part of this phase — that's a human decision."

**Acceptance:** staging cutover rehearsal succeeds (v2 subdomain picks up apex traffic when DNS is manually pointed at it); one-button rollback works; after 48h of staging traffic, GlitchTip error count is below threshold, analytics are receiving data from both tools.

---

## 6. After Cutover

- Monitor error rates for 72 hours before decommissioning v1
- Keep v1 server state snapshot for 30 days as a safety net
- Retrospective: update `REBUILD_PLAN.md` with anything that surprised us
- Start v2 roadmap: white-label, home-country-aware advisories, daily (not monthly) climatology

## 7. Things Claude Code should push back on

If during the build Claude Code finds any of the following, it should stop
and ask before proceeding:

- Any need to commit data files over 10MB (use B2 / gitignore instead)
- Any test that requires live external API credentials (refactor to mock)
- Any migration that drops a column or table (needs explicit two-phase plan)
- Any auth change that touches session/cookie/signing logic (requires owner review)
- Any PMTiles layout change that invalidates the bunny.net cache (needs purge script)
- Any change that would require editing the live production server manually outside the container (probably a bug in the automation)
