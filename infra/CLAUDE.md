# Infra

Docker Compose on a 16GB Ubuntu server, Caddy front, bunny.net CDN in front.

## Daily commands

- `docker compose up -d` — boot
- `docker compose logs -f api web` — tail
- `docker compose exec postgres psql -U wtg wtg` — DB shell
- `./infra/scripts/backup-postgres.sh` — manual backup (also runs nightly)
- `./infra/scripts/restore-postgres.sh <db> <stamp|latest>` — restore from B2
- `./infra/scripts/rebuild-tiles.sh` — regenerate PMTiles and purge bunny.net cache
- `./infra/scripts/build-web.sh` — build the web image with the country pages
  pre-rendered (idempotent; use instead of `docker compose build web`)

## Deploying

There is **no image registry** — compose builds from source on the box:

```bash
git pull --ff-only
docker compose build api && docker compose up -d api
./infra/scripts/build-web.sh && docker compose up -d web
```

`docker compose up -d` does **not** rebuild an image. A deploy that only
changes compose (a new volume, a new env var) still needs `build` if the code
moved too, or the container comes up with the new wiring and the old code.

`build-web.sh` exists because `next build` pre-renders the ~2,800 country
pages against `/v1/countries`, and a plain build cannot reach the API:
BuildKit's default driver will not attach a build to the compose network at
all, and even on a builder that lives there, a build step's sandbox can route
to the subnet but cannot resolve `api` in it. So the script keeps a
`docker-container` builder on the network and passes the API's **IP**. It
verifies the pre-render happened rather than assuming it — an unrendered image
looks identical at runtime, just slower on each page's first hit — and fails
unless `ALLOW_UNRENDERED=1`.

Note the API container's IP changes whenever it is recreated, which is why the
script resolves it per build rather than pinning it anywhere.

Country data (`pipeline/data/final/api/`) is served off a read-only mount and
cached on file mtime, so `wtg publish api-data` reaches the API with no
restart. It does **not** reach already-rendered pages, which are ISR-cached for
30 days: a content-only change needs
`docker compose up -d --force-recreate web`.

## Cutover

The v1 → v2 apex switch is documented step-by-step in `infra/CUTOVER.md`,
including rollback and the 72h post-cutover checklist. Do not flip DNS
without reading it end to end.

## Cron (on host, not in container)

- Weekly Sun 03:00 UTC: `weekly-advisories.sh` — scrape + consolidate advisories,
  and rebuild the tiles via `rebuild-tiles.sh` **only if a country's advisory
  level actually moved** (the level is baked into the tiles as the `safety`
  property, so a level change is a tile change). Runs `uv` on the host, not in
  a container.
- Weekly Mon 04:00 UTC: `weekly-alerts.sh` — recompute alert matches, email on transitions
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
  to `glitchtip-web:8000`. Subdomain (not subpath) because GlitchTip emits
  absolute URLs for its static assets and breaks under path stripping.
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
