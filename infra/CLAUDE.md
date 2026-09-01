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
docker compose build api
docker compose run --rm api alembic upgrade head   # only if migrations landed
docker compose up -d api
./infra/scripts/build-web.sh && docker compose up -d web
```

`docker compose up -d` does **not** rebuild an image. A deploy that only
changes compose (a new volume, a new env var) still needs `build` if the code
moved too, or the container comes up with the new wiring and the old code.

### Migrations run between build and up

**Nothing runs Alembic for you.** The image's `CMD` is bare `uvicorn` — no
entrypoint script, no migration hook — so a deploy that ships a migration and
skips this step comes up against the old schema.

That fails wider than it sounds. A new column on a model is named in *every*
`SELECT` SQLAlchemy emits for that table, not just by the endpoints that use
it: `0004`'s `trips.share_token` would take out `GET /api/trips` (which
`/account` calls) and `GET /api/trips/{id}` alike, with `UndefinedColumn`.

Migrate **before** `up -d`, not after. Every migration so far is additive, and
adds columns either nullable (`0004`) or `NOT NULL` with a server default
(`0003`) — so the currently-running old code is perfectly happy with a column
it does not know about. Expand first, then deploy. The reverse order leaves a
window where the new code is serving against a schema that cannot answer it,
and that window is however long the migration takes plus however long it takes
you to notice.

Keep new migrations to that shape. One that drops a column, renames one, or
adds a `NOT NULL` without a default breaks the old code the moment it lands —
which means the safe order is no longer "migrate first" and there isn't a safe
order at all without a two-step deploy.

Use `run --rm`, not `exec`. `exec` needs the new container to already be
running, which is the state you are trying to avoid; `run` starts a throwaway
container from the image you just built, on the same network with the same
env, and leaves the serving one alone. `alembic` is a runtime dependency in
`api/pyproject.toml`, so it survives the image's `uv sync --no-dev` and is on
`PATH` at `/app/.venv/bin`.

Check what is pending before deciding whether the step applies:

```bash
docker compose run --rm api alembic current
```

There is no rollback step here on purpose. Migrations are **forward-only**
(root `CLAUDE.md`), so a schema change that has to be undone is undone by a new
migration, and a deploy that has to be undone is a rebuild at the previous
commit — the old code tolerates the newer schema, which is the whole point of
keeping changes additive. If a migration destroyed or rewrote data, the way
back is `restore-postgres.sh`, not `alembic downgrade`.

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

## The daily-climatology rebuild

Moving the product from ERA5 monthly means onto daily statistics changes what
the numbers **mean**, not just their values: `t` is the mean daily maximum
rather than the 24-hour mean, the chart band is a within-month spread rather
than an interannual one, and the baked `pref_<mm>` is scored against a
day/night pair. Tiles and country bundle must therefore ship **together** — a
window where the map paints daily maxima while the pages still serve 24-hour
means is worse than either state alone.

### Capacity first

Two volumes, and only one of them can grow. `vol-distracted-joliot` is **Local
NVMe**, 100 GB, holds `pipeline/data` *and* Docker's data root, and is fixed by
the instance type. `wtg-weather-v2-system` is **Block Storage** and is the root
disk — that one resizes, and was taken from 10 GB to 110 GB on 2026-09-01.

Growing the Scaleway volume does **not** grow the filesystem. Until this runs,
`df -h /` still reports the old size:

```bash
lsblk                       # confirm the device and partition number first
growpart /dev/sda 1
resize2fs /dev/sda1
df -h /
```

Then put the raw ERA5 downloads on the newly-large root and bind them into the
tree, so nothing existing has to move:

```bash
mkdir -p /srv/era5 /opt/wtg-weather/pipeline/data/raw/era5/daily
```

```bash
/srv/era5  /opt/wtg-weather/pipeline/data/raw/era5/daily  none  bind  0 0
```

This arrangement is better than the separate volume it replaced: Docker's data
root is on the *other* disk, so filling `/` with ERA5 can no longer take the
site down.

**The intermediates still land on the Local NVMe**, and that is the disk with
no headroom. Daily admin-1 aggregation adds roughly 4 GB of part files plus a
~5 GB combined Parquet against ~13 GB free. So the swapfile reclaim is not
optional:

**The swapfile is already 16 GB** as of 2026-09-01 — the reclaim from 33 GB
had been done at some point and the note here was stale. Do not shrink it
further: `build_feature_collection` still holds 49k features and `json.dumps`
a ~3.9 GB string at admin-2. Check
`df -h /opt/wtg-weather/pipeline/data` before starting aggregation; it was at
80 % used with 18 GB free when the daily download began, and the daily
intermediates want most of that.

### Order

```bash
# 1. Download. 840 chunks, resumable. `setsid` so it outlives the SSH session.
export PATH=/root/.local/bin:$PATH
setsid nohup uv run --directory pipeline wtg download era5-daily --years 2016-2025 -v \
  > /var/log/wtg-era5-daily.log 2>&1 < /dev/null &

# 2. Aggregate, then derive. The coverage matrix is built once and cached.
uv run --directory pipeline wtg process aggregate --level all
uv run --directory pipeline wtg process percentiles --level all

# 3. Fit the sunshine coefficients (optional but wanted; see below).
uv run --directory pipeline python scripts/calibrate_sunshine.py --year 2023 --write

# 4. Re-derive the map's temperature ramp, and paste what it prints into
#    web/src/lib/display-modes.ts. Do NOT skip this.
uv run --directory pipeline python scripts/derive_ramp_stops.py --variable t2m_max

# 5. Build and publish.
uv run --directory pipeline wtg build geojson
uv run --directory pipeline wtg publish api-data

# 6. Ship, in this order.
docker compose build api && docker compose up -d api
NO_CACHE=1 ./infra/scripts/build-web.sh && docker compose up -d web
./infra/scripts/rebuild-tiles.sh
```

Measured on the first real run (2026-09-01), not estimated: **~66 MB per
chunk, ~55 GB for the full 840, ~28 s each — six to seven hours end to end.**
The earlier ~39 GB estimate was low by a third. Progress:

```bash
grep -c retrieving /var/log/wtg-era5-daily.log
ls /opt/wtg-weather/pipeline/data/raw/era5/daily/*.nc | wc -l
```

**Do not `pkill -f era5_daily` over SSH.** The pattern appears in the command
line pkill is itself running under, so it matches its own shell and kills the
session before doing anything useful. It presents as the command silently
producing no output at all, which is a confusing five minutes. Find the PID
with `ps` and `kill` that.

No migration is expected: this is all file-backed reference data served off the
read-only mount. Check `docker compose run --rm api alembic current` anyway.

`NO_CACHE=1` on the web build is not optional. The pre-render bakes API
*responses* into the image while Docker's cache key is the source tree, so a
republish without it ships the previous pre-render — the country pages would
keep the old numbers while the map showed the new ones.

Step 4 is the one that looks skippable and is not. The ramp stops were chosen
against the 24-hour mean; the map now paints the daily maximum, which is warmer
everywhere and by a different amount in each climate. Skipping it leaves a map
whose colours are all shifted one bin warm.

Finish by verifying the CDN with a range request against a signed URL and
comparing `Content-Range`'s total against the on-disk size — that is the check
that catches bunny serving stale bytes.

### What the sunshine model does without step 3

It runs on the literature Ångström–Prescott coefficients and
`validate_sunshine` logs `SUNSHINE_UNCALIBRATED` on every pipeline run. That is
a working state, not a broken one — but grep for that tag before believing any
claim that the sunshine figures are calibrated.

## Cutover

The v1 → v2 apex switch is documented step-by-step in `infra/CUTOVER.md`,
including rollback and the 72h post-cutover checklist. Do not flip DNS
without reading it end to end.

## Cron (on host, not in container)

The four jobs live in `infra/cron/crontab`, which is the complete table —
`crontab <file>` replaces rather than merges, so `crontab -l` and that file
must agree. Install it (and back up whatever is there first):

```bash
crontab -l > /root/crontab.$(date -u +%FT%TZ).bak    # if anything is scheduled
crontab /opt/wtg-weather/infra/cron/crontab
crontab -l
```

cron's PATH is not a login shell's: `uv` lives in `/root/.local/bin` and is
absent from the default, which is why the file sets PATH explicitly.

- Weekly Sun 03:00 UTC: `weekly-advisories.sh` — scrape + consolidate advisories,
  and rebuild the tiles via `rebuild-tiles.sh` **only if a country's advisory
  level actually moved** (the level is baked into the tiles as the `safety`
  property, so a level change is a tile change). Runs `uv` on the host, not in
  a container.
- Weekly Mon 04:00 UTC: `weekly-alerts.sh` — recompute alert matches, email on transitions
- Yearly Jan 15 04:00 UTC: `yearly-era5.sh` — full pipeline rebuild, old year swap
- Nightly 02:00 UTC: `backup-postgres.sh` — dump, encrypt, upload to B2

## US advisory scrape (Cloudflare 403)

**Update 2026-08-16: the box currently scrapes the US successfully.** The
scraper reads the Consular Affairs API (`cadataapi.state.gov`), which is not
behind the Cloudflare rule that blocks `travel.state.gov` — verified by a
clean 277-record scrape from v2 during the weekly run. The arrangement below
is therefore the **fallback** for if that host ever starts blocking too; the
`ADVISORY_STALE` warning is what tells you it has. Everything in this section
about not evading the block stands unchanged.

`travel.state.gov` returns 403 to this box. Cloudflare is blocking the
datacenter IP, not us specifically, and the block is legitimate: **do not work
around it.** Nothing in this repo may disguise the client, rotate a user
agent, route through a proxy chosen to look residential, or solve a challenge.
The five other governments answer fine from v2; only the US needs a hand.

### Recommended arrangement

Run the US scrape from a machine on a permitted network — the owner's home
machine — and rsync the dump onto v2 before the Sunday 03:00 UTC cron:

```bash
# On the home machine, in a checkout of this repo:
uv run --directory pipeline wtg download advisories --source us

# The dump lands in pipeline/data/raw/advisories/us_state/<UTC stamp>.json.
# Copy just that directory; everything else on v2 is newer than it.
rsync -av --include='*/' --include='*.json' --exclude='*' \
  pipeline/data/raw/advisories/us_state/ \
  root@51.15.37.62:/opt/wtg-weather/pipeline/data/raw/advisories/us_state/
```

Nothing else is required. `latest_source_files` picks the newest non-empty
dump per source directory by filename, so the copied file is used by the next
`wtg process advisories` — which the Sunday cron runs anyway. Doing it any
time before Sunday is enough; doing it after just means the level lands a week
later.

Two properties make this safe rather than fragile: a zero-record dump is
rejected as a failed scrape rather than accepted as "the US lists nobody", and
a `--source all` run that 403s on the US still writes the other five (the CLI
exits non-zero afterwards, so the cron log shows the failure without losing
the successful sources).

### What it looks like when it is missed

`wtg process advisories` warns, on stdout and through the logger, tagged so it
can be found without reading prose:

```
$ grep ADVISORY_STALE /var/log/wtg-advisories.log
2027-01-10T03:00:41Z WARNING ADVISORY_STALE source=us_state age_days=38 threshold_days=21 —
  its newest dump is older than the threshold; consolidation is publishing an
  old snapshot as this government's current position.
```

Threshold is 21 days (two missed weekly runs), overridable with
`WTG_ADVISORY_STALE_DAYS`. It is a warning, not a failure: an old US snapshot
is better than dropping the US from a six-government consensus, and the run
must still publish the other five. There are two staleness checks and they
answer different questions — this absolute one, and a relative one that
reports a source falling behind the others. Only the absolute one fires when
*nothing* has been scraped, because then no source is behind any other.

On the country page the same fact surfaces as a neutral (rather than
level-coloured) combined badge once **every** government's `checked` date is
more than 14 days old, with the date printed. One live source keeps the panel
current, so a lone stale US does not grey out the site — which is correct, and
also means the page will not tell you the US specifically has gone cold. The
log line is the check for that.

### The decision still to make

Where the US scrape runs is the owner's call and it is not made yet:

1. **Manual, from the home machine** (above). Zero infrastructure, but it is a
   recurring human task and the thing most likely to quietly stop happening —
   which is exactly what the staleness warning exists to catch.
2. **Scheduled on the home machine** (cron/launchd + the rsync above). Same
   shape, no recurring attention, but it depends on a machine that sleeps and
   an SSH key living on it.
3. **A small allowed egress** — a VPS on a network Cloudflare does not block,
   scraping only `travel.state.gov` and rsyncing the dump. More moving parts
   and another host to patch, in exchange for the US being as automatic as the
   other five.

Until one is chosen, option 1 is what the runbook above describes, and the
`ADVISORY_STALE` warning is the safety net.

### Closed 2026-08-21: advisory changes now reach the country pages

`weekly-advisories.sh` used to consolidate and rebuild tiles but never run
`wtg publish api-data`, so the **map** was current while the country pages
served whatever the last manual publish wrote. It now publishes on **every**
successful consolidation, and recreates `web` only when a payload actually
changed.

Publishing had to sit *outside* the level-change branch, and that is the
subtle part. The branch watches the safety index — levels only, byte-stable.
The pages read `advisories.json`, which also carries each government's
`checked` date, and that moves every week a scrape succeeds. Those dates are
what the stale badge reads (neutral once every source is >14 days old), so
gating the publish on a level change would have made a site scraping perfectly
every Sunday announce that its advisories may be out of date, a fortnight after
the last time any government moved one. The map and the pages answer different
questions and update on different cadences.

The recreate is deliberately non-fatal: the bundle is published and the API
already serves it (mtime-keyed cache, no restart needed), so a failed recreate
must not abort the tile rebuild that keeps the map honest. It costs a few
seconds of 502s through Caddy on the weeks it runs.

## Caddy

**The committed `Caddyfile` is the real production config as of 2026-08-17.**
It had diverged badly: the box ran a working subdomain arrangement that was
never committed, while the repo held a draft that could not run at all
(pre-2.8 `basicauth` spelling, a literal `<bcrypt-hash>`, and basic auth over
the Plausible script path, which would have blocked analytics for every
visitor). The box's version is now the committed one, so a disk failure no
longer loses the SSL, CORS and tile-signing configuration. Keep them in step —
`ssh <box> 'cd /opt/wtg-weather && git diff --stat Caddyfile'` should be empty.

`CADDY_BASICAUTH_HASH` must be in `.env` (username is `admin`; only the hash
leaves the box). Rotate the ops password with:

```bash
docker compose exec caddy caddy hash-password      # prompts twice, prints hash
# write it into .env with EVERY `$` DOUBLED — see below — then:
docker compose up -d caddy
docker compose exec caddy sh -c 'echo ${#CADDY_BASICAUTH_HASH}'   # must be 60
```

**Double the dollars.** Compose interpolates `$` in `.env` values and a bcrypt
hash contains three, so a pasted hash arrives at Caddy with its middle eaten —
24 characters instead of 60. Write `$$2a$$14$$…`, not `$2a$14$…`. The failure is
silent in the worst way: a mangled hash still answers **401**, so the ops UIs
look protected and are merely impossible to log into. If `docker compose config`
warns that some random-looking string "variable is not set", that string is a
fragment of your hash. Verified end to end on 2026-08-17 after hitting it.

If that variable is missing, compose refuses to start caddy and Caddy refuses
to load the config ("username and password are required") — verified
2026-08-17. Fail-closed on purpose.

Two paths are deliberately exempt from basic auth, each because its caller
carries its own credential or none at all: GlitchTip's Sentry ingest endpoints
(`/api/<id>/{envelope,store,security,minidump}/`, authenticated by the DSN
public key) and Plausible's `/js/*` + `/api/event` (fetched by every visitor's
browser). Removing either exemption silently disables that tool — see
`web/CLAUDE.md` and the observability notes: the GlitchTip one is exactly why
no event reached the instance for months.

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

### A reboot used to take the site down (fixed 2026-08-31)

v2 also had Caddy installed as a **host package**, running from
`/etc/caddy/Caddyfile` — 26 lines of the distro default, nothing to do with
this repo — as a systemd unit that was `enabled`. It had been stopped by hand
at some point but never disabled, so it was invisible until the box was first
rebooted, when it started at boot, took port 80, and the compose `caddy`
container could not bind:

```
failed to bind host port 0.0.0.0:80/tcp: address already in use
```

Disabled with `systemctl disable --now caddy`. If a future image or `apt`
operation reinstates it, the same thing happens again; `apt purge caddy` on v2
would close it permanently.

**The symptom is deliberately misleading and worth recognising.** The site is
completely down, but nothing looks broken: the box is up, `docker compose ps`
shows every other service healthy, and Caddy's own logs end with a clean
`"exiting; byeee!!"` and `exit_code: 0`, because SIGTERM at shutdown is a
graceful stop. There is no crash, no OOM and no disk symptom to find — the only
evidence is `ss -tlnp | grep :80` showing a non-Docker process holding it. The
tell from outside is that **443 refuses while 22 times out**: refused means the
host is alive and nothing is listening, so reach for this before suspecting
disk, `.env` or the last deploy.

**Second-order trap: a failed port bind leaves a stale container.** Once the
conflict is cleared, `docker compose up -d caddy` will happily *start* the
container created by the failed attempt, and it comes up `healthy` with no
published ports at all — `docker port wtg-weather-caddy-1` prints nothing and
`docker compose ps` shows `80/tcp, 443/tcp` rather than `0.0.0.0:80->80/tcp`.
Caddy is running and serving; nothing on the host forwards to it. Recover with
`docker compose up -d --force-recreate caddy`, not a plain `up -d`.

### `.env` changes need the container recreated

Compose injects `.env` at container **create** time. Editing `.env` and running
`docker compose up -d <service>` does nothing when the service is otherwise
unchanged — the running container keeps the old values. After rotating a
secret, use `--force-recreate` on every service that reads it. A rotated
`PADDLE_API_KEY` that only reached `.env` leaves `api` authenticating with the
revoked one, which surfaces as a 502 from `/api/paddle/checkout-url` and
nowhere else.

## Rules

- Never expose Postgres, Redis, GlitchTip, or Plausible ports on the
  host network. Internal docker network only.
- Secrets live in `.env` at repo root, loaded by compose. Production
  server has its own `.env` — NEVER copied from dev.
- B2 bucket name: `wtg-backups`, EU Central region. Retention is a single
  bucket lifecycle rule (prefix `wtg/`, hide after 35 days, delete 7 days
  later) — an effective ~35–42 day window. B2 lifecycle rules cannot express
  the originally-specced 30-daily/8-weekly/12-monthly tiers; that needs a
  small pruning script if it's ever wanted.
- Backup key custody: `BACKUP_AGE_RECIPIENT` (public key) lives in the box's
  `.env`; the age **private** key lives off-box with the owner and nowhere
  else. A restore starts by placing that key on the box and pointing
  `BACKUP_AGE_IDENTITY` at it. Scripts parse `.env` themselves (grep, not
  source), so cron can call them bare — verified after the first scheduled
  backup died for want of env on 2026-08-17.
- Restore drill (last run 2026-08-17): full chain verified on v2 —
  dump → age-encrypt → B2 upload → download → decrypt → `pg_restore` into a
  scratch DB, schema restored at head (`0009`), ~1 minute end to end at
  current (pre-launch) data volumes. Use
  `RESTORE_TARGET_DB=wtg_restore_drill restore-postgres.sh wtg latest` to
  rehearse without touching the live database; drop the scratch DB after.
  The `b2` CLI is a uv tool at `/root/.local/bin/b2`.
- Before any destructive op (`docker compose down -v`, `rm -rf data/`),
  Claude must explicitly confirm with the user.
