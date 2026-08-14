# Infra

Docker Compose on a 16GB Ubuntu server, Caddy front, bunny.net CDN in front.

## Daily commands

- `docker compose up -d` — boot
- `docker compose logs -f api web` — tail
- `docker compose exec postgres psql -U wtg wtg` — DB shell
- `./infra/scripts/backup-postgres.sh` — manual backup (also runs nightly)
- `./infra/scripts/restore-postgres.sh <db> <stamp|latest>` — restore from B2
- `./infra/scripts/rebuild-tiles.sh` — regenerate PMTiles and purge bunny.net cache
- `./infra/scripts/setup-build-builder.sh` — create the buildx builder that can
  reach `api` during a build (idempotent; run it before building `web`)

## Deploying

There is **no image registry** — compose builds from source on the box:

```bash
git pull --ff-only
docker compose build api && docker compose up -d api
./infra/scripts/setup-build-builder.sh
BUILDX_BUILDER=wtg-internal docker compose build web && docker compose up -d web
```

`docker compose up -d` does **not** rebuild an image. A deploy that only
changes compose (a new volume, a new env var) still needs `build` if the code
moved too, or the container comes up with the new wiring and the old code.

The `web` build goes through a named builder because `next build` pre-renders
the ~2,800 country pages against `/v1/countries`, and BuildKit's default driver
cannot attach a build to the compose network. Without the builder the image
still works — those pages just render on first request.

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
