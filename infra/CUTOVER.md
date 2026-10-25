# Cutover Runbook — v1 apex → v2

Flip `wheretogoforgreatweather.com` from the v1 server (51.159.164.178, Flask,
no Docker) to the v2 stack (51.15.37.62, `/opt/wtg-weather`) with a short
user-visible window and a rollback that is one DNS change.

**Who:** the repo owner, on a weekday morning CET, not on a Friday.

Rewritten 2026-10-25. The previous version predated Paddle Billing, the ops
subdomains and the pre-render build, and its step 2 restored a v1 `pg_dump`
over the v2 database with `--clean` — v1 is a different application with a
different schema, so that would have dropped v2's tables. **No data moves from
v1** (owner's decision, 2026-10-25): v1 has no accounts worth carrying, and v2
starts from its own database.

---

## Gates — all green before T-7

- [ ] **Legal pages signed off.** The owner has reviewed `/privacy`, `/terms`,
      `/refunds` and `/contact`, and the `DraftNotice` is removed from
      `components/legal/legal-shell.tsx`. Paddle's live website review reads
      these pages, so this gates the next item.
- [ ] **Sandbox purchase end to end** on v2: pricing → overlay → webhook →
      premium tiles within ~60 s → customer portal → cancel → falls back to
      free tiles.
- [ ] **Paddle live prepared** (dashboard, live mode):
  - products and prices for the three plans — note the three `pri_` ids;
  - **default payment link** = `https://wheretogoforgreatweather.com/checkout/pay`
    (Paddle refuses to create any transaction without one);
  - **website approval** for `wheretogoforgreatweather.com`;
  - a notification destination for
    `https://wheretogoforgreatweather.com/api/webhooks/paddle`, its secret noted;
  - a live API key and a **client-side token** (`live_…`).
- [ ] **PostHog Cloud EU** project exists; its `phc_…` key is to hand. Host is
      `https://eu.i.posthog.com` (the code's default).
- [ ] **GlitchTip** has been receiving events from api and web, error rate flat.
- [ ] **Nightly backup** green on the most recent night (`tail /var/log/wtg-backup.log`).
- [ ] **v1 is healthy enough to roll back to**: valid TLS certificate and free
      disk. Its certificate expired on 2026-10-20 because the 8 GB root disk was
      full and `certbot.timer` failed silently every day; a rollback target with
      a dead certificate is not a rollback target.

## T-7 days — preparation

1. **Lower the apex TTL to 300 s** at TransIP, and the `www` record's too.
   Cutover lives or dies on this step. TransIP's *Naam* field is **relative**
   (`@`, `www`); pasting a fully qualified name creates
   `www.wheretogoforgreatweather.com.wheretogoforgreatweather.com`, which
   resolves silently to nothing.
2. **Google Cloud console** → the OAuth client → *Authorised redirect URIs*: add
   `https://wheretogoforgreatweather.com/api/auth/google/callback` next to the
   v2 one. Adding it early costs nothing; adding it late breaks Google sign-in
   at T-0.
3. **Scaleway Transactional Email**: verify `wheretogoforgreatweather.com` as a
   sending domain — SPF, DKIM and a DMARC record at TransIP — and send yourself
   a magic link through it. Scaleway's handling of `List-Unsubscribe` is still
   unverified (`api/CLAUDE.md`); check the alert mail's headers on the same send.
4. **Plausible**: add `wheretogoforgreatweather.com` as a site at
   `plausible.v2.wheretogoforgreatweather.com`.
5. **Search Console**: add the apex as a domain property (DNS TXT), so the
   sitemap can be submitted on the day.
6. **bunny.net**: note the pull zone's **origin URL**. If it is
   `https://v2.wheretogoforgreatweather.com`, the Caddyfile below keeps
   `/_tiles/*` served on that hostname for exactly that reason — do not change
   the origin as part of the cutover.
7. **Snapshot the v1 instance** in the Scaleway console. Not for data — for
   rollback and the 30-day decommission.

## T-1 day — dry run

1. Point a scratch name (`preview.wheretogoforgreatweather.com`, A → v2's IP)
   and add it to the v2 site block's host list; confirm Caddy obtains a
   certificate and `/`, `/api/health` and a country page answer 200. Remove it
   afterwards.
2. Run `./infra/scripts/backup-postgres.sh` by hand — must end `backup OK` —
   and rehearse the restore into a scratch database:
   `RESTORE_TARGET_DB=wtg_restore_drill ./infra/scripts/restore-postgres.sh wtg latest`.
3. Trigger `GET /api/debug/error` and `/debug/client-error`; both must appear in
   GlitchTip.
4. Write the T-0 `.env` changes below into a copy (`.env.cutover`) so the day
   is a file move, not typing secrets under pressure.

---

## T-0 — cutover

All commands on the v2 host in `/opt/wtg-weather` unless stated.

### 1. v1: maintenance banner (optional)

v1 has nothing to freeze — no data moves. A banner is only worth it if v1 has
forms that would silently stop working; otherwise skip.

### 2. `.env` on v2

Paddle → live:

```
PADDLE_SANDBOX=false
PADDLE_API_KEY=<live API key>
PADDLE_WEBHOOK_SECRET=<live notification secret>
PADDLE_PRICE_CONSUMER_PREMIUM=<live pri_>
PADDLE_PRICE_AGENCY_STARTER=<live pri_>
PADDLE_PRICE_AGENCY_PRO=<live pri_>
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=live_…
```

There is no checkout-URL variable: Paddle Billing opens the overlay by
transaction id, and the payment link defaults to `PUBLIC_WEB_ORIGIN` +
`/checkout/pay`. A `PADDLE_CHECKOUT_BASE_URL` left over in `.env` is dead
Paddle Classic configuration — delete it. The environment (sandbox/live) is
derived from the client token's prefix, not a second setting.

Origins → apex:

```
PUBLIC_WEB_ORIGIN=https://wheretogoforgreatweather.com
GOOGLE_REDIRECT_URI=https://wheretogoforgreatweather.com/api/auth/google/callback
NEXT_PUBLIC_SITE_URL=https://wheretogoforgreatweather.com
NEXT_PUBLIC_API_URL=https://wheretogoforgreatweather.com/api
NEXT_PUBLIC_APP_ENV=prod
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=wheretogoforgreatweather.com
NEXT_PUBLIC_POSTHOG_KEY=phc_…
```

Leave `NEXT_PUBLIC_POSTHOG_HOST` unset (EU default) — or, if it is set, make
sure it says `eu`. Leave `CDN_URL`, `NEXT_PUBLIC_CDN_URL` and
`NEXT_PUBLIC_PLAUSIBLE_SRC` alone: the CDN and the ops subdomains do not move.

`NEXT_PUBLIC_APP_ENV=prod` is what flips `robots.txt` from `Disallow: /` to
crawlable and points its sitemap and `Host` at `SITE_URL`.

**Every `NEXT_PUBLIC_*` is inlined at build time**, so none of them takes
effect until the web image is rebuilt (step 4). And the privacy policy's
PostHog disclosure is rendered from the same build argument as the code that
loads PostHog — the key and the disclosure arrive in the same build, or neither
does.

### 3. Caddyfile: commit it, do not edit it on the box

Make this change in the repo, commit, push, then `git pull --ff-only` on v2 —
the box and the repo must not diverge again (see `infra/CLAUDE.md` § Caddy).

- Rename the site block `v2.wheretogoforgreatweather.com` to
  `wheretogoforgreatweather.com`, keeping its contents.
- In its `/_tiles/*` route change
  `Access-Control-Allow-Origin` to `https://wheretogoforgreatweather.com`.
  **This is the line that blanks the map if forgotten**: the browser fetches
  tiles from the CDN with the page's origin, and a tile response allowing only
  `v2.` is refused for a page on the apex.
- Add the two redirect hosts:

```
www.wheretogoforgreatweather.com {
    redir https://wheretogoforgreatweather.com{uri} permanent
}

v2.wheretogoforgreatweather.com {
    # Still the CDN's origin: bunny pulls tiles from this hostname, so the
    # tile route stays here verbatim (forward_auth, headers, file_server).
    route /_tiles/* {
        ...same block as the apex...
    }
    redir https://wheretogoforgreatweather.com{uri} permanent
}
```

One public web origin, not two: a single `Access-Control-Allow-Origin` value is
then correct, and bunny — which does not reliably honour `Vary: Origin` — can
never serve one origin's cached header to the other.

The ops subdomains (`glitchtip.v2.…`, `plausible.v2.…`) stay as they are.

### 4. Rebuild and recreate

```bash
docker compose up -d --force-recreate api
NO_CACHE=1 ./infra/scripts/build-web.sh && docker compose up -d --force-recreate web
docker compose up -d --force-recreate caddy
```

- `api` reads `.env` at container create, so `--force-recreate` is required.
- `build-web.sh`, never `docker compose up --build web`: only the script can
  reach the API during the build, and without it none of the ~2,800 country
  pages pre-render. `NO_CACHE=1` because the canonical URLs, OG tags and
  sitemap host all change with `SITE_URL` while the source tree does not.
- Check the image is the one running:
  `docker image inspect --format '{{.Created}}' wtg-weather-web` against
  `docker inspect wtg-weather-web-1 --format '{{.State.StartedAt}}'`.
- Caddy is recreated rather than reloaded so it cannot be holding the old file.
  Its certificate for the apex is issued on the first HTTPS request *after*
  DNS points here (HTTP-01 challenge), so expect a few seconds of TLS errors
  right after step 6, not before.

### 5. Purge the CDN

```bash
# rebuild-tiles.sh purges the whole zone at the end; the purge alone is:
curl -X POST -H "AccessKey: $BUNNY_API_KEY" \
  "https://api.bunny.net/pullzone/$BUNNY_PULL_ZONE_ID/purgeCache"
```

The tile responses cached at the edge carry the old `Access-Control-Allow-Origin`
with a year's `max-age`. Without a purge the apex map stays blank for anyone
who hits a warm edge.

### 6. DNS flip

At TransIP: apex `A` → `51.15.37.62`; replace v1's `AAAA` with v2's IPv6 or
**delete it** — a stale `AAAA` sends IPv6 clients to v1 indefinitely. `www`:
`CNAME → wheretogoforgreatweather.com.` (or an `A` to the same IP).

```bash
while true; do dig +short wheretogoforgreatweather.com A @1.1.1.1; dig +short wheretogoforgreatweather.com AAAA @1.1.1.1; sleep 5; done
```

### 7. Paddle

Live notification destination already points at the apex (gates). Send a
test notification from the dashboard; the API log must show it verified.

### 8. Smoke test on the real apex

- `curl -sI https://wheretogoforgreatweather.com/` → 200, issuer Let's Encrypt.
- `curl -s https://wheretogoforgreatweather.com/api/health` → 200.
- `curl -sI https://www.wheretogoforgreatweather.com/peru` and
  `https://v2.wheretogoforgreatweather.com/peru` → 308 to the apex.
- `curl -sI https://wheretogoforgreatweather.com/about` → 308 to `/`;
  `/cookies` → 308 to `/privacy#cookies` (v1's two URLs v2 has no page for).
- `curl -s https://wheretogoforgreatweather.com/robots.txt` → `Allow`, sitemap on the apex.
- Incognito: the map renders **with colour** (tiles + CORS + purge all right),
  a country page renders, its canonical points at the apex.
- Sign in by magic link (mail arrives, link is on the apex) and by Google.
- PostHog receives an `identify` for that session; Plausible counts the visit.
- Upgrade → Paddle overlay in **live** mode → one real purchase → premium
  unlocks → refund it from the Paddle dashboard → access drops back.
- Submit `https://wheretogoforgreatweather.com/sitemap.xml` in Search Console.

### 9. Re-raise the TTL

After 24 h without rollback, apex and `www` back to 3600 s or higher.

---

## Rollback

If a smoke-test step fails and is not obviously fixable in five minutes:

1. **DNS back to v1** (51.159.164.178, and its `AAAA`). TTL is 300 s.
2. **Revert the Caddyfile commit** and `git pull` + recreate caddy, so
   `v2.` serves again instead of redirecting to an apex that now points at v1.
3. **`.env`**: restore the pre-cutover copy, then recreate `api` and rebuild
   `web` (`NO_CACHE=1 ./infra/scripts/build-web.sh`). Until the rebuild, v2
   pages carry apex canonicals — harmless for the minutes it takes.
4. **Paddle**: switch nothing back in live mode — v1 sells nothing — but refund
   any purchase made during the window by hand.
5. Purge the CDN again (the tile CORS header changed back).
6. Post-mortem before the next attempt.

---

## Post-cutover checklist (first 72 h)

- [ ] GlitchTip error rate under the staging baseline + 50 %.
- [ ] Plausible visitors on the apex site ≥ the v1 baseline.
- [ ] PostHog `identify` on every sign-in; no events from signed-out visitors.
- [ ] Backup fires at 02:00 UTC (`tail /var/log/wtg-backup.log`), artefact in B2.
- [ ] Sunday 03:00 advisory run: a country page's per-government `checked` date
      moves to that Sunday. Then check `docker compose ps` for a `web` stuck in
      `created` — that cron's `--force-recreate` has taken the site down before.
- [ ] Monday 04:00 alert run: `/var/log/wtg-alerts.log` has its JSON report line.
- [ ] Signed-tile 403 rate flat, CDN hit ratio recovering after the purge.
- [ ] Lighthouse on `/`: LCP < 2.0 s, CLS < 0.05, TBT < 100 ms.
- [ ] Search Console: sitemap processed, no spike in 404s (watch `/about`,
      `/cookies`, and anything v1 linked that its sitemap did not list).

## v1 decommission

- **T+30 days** without rollback: take a final snapshot of the v1 instance,
  keep it 12 months, terminate the instance.
- Remove v1-only DNS records.
- Archive the v1 repository with a README pointing here.

## Calendar reminders to set now

- **January 15** — review `yearly-era5.sh` output before promoting the new year.
- **T+30 days** — v1 decommission.
- **T+90 days** — rotate `SESSION_SECRET`, `TILE_SIGNING_SECRET` and
  `PADDLE_WEBHOOK_SECRET` (forces every session to sign in again; low-traffic
  window).
