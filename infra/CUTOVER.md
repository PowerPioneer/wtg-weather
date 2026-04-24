# Cutover Runbook — v1 apex → v2

Flip `wheretogoforgreatweather.com` from the v1 server to the v2 stack
(`v2.wheretogoforgreatweather.com`) with minimal user-visible downtime and a
one-command rollback.

**Who:** the repo owner, on a weekday morning CET, not on a Friday.
**Pre-reqs done before the day:** Phase 7 acceptance signed off, Paddle live
products configured, GlitchTip / Plausible / PostHog ingesting for ≥48h from
staging traffic, nightly backup ran green at least once.

---

## T-7 days — preparation

1. **Verify v2 staging** is receiving synthetic traffic and errors are flat:
   - `https://v2.wheretogoforgreatweather.com/_glitchtip` — error rate < 0.5%
     of sessions over the last 48h.
   - `https://v2.wheretogoforgreatweather.com/_plausible` — visits recorded.
2. **Back up v1** to B2 out of band (`./infra/scripts/backup-postgres.sh` on
   the new box targets the v2 Postgres, not v1 — take a manual v1 dump with
   the v1 tooling and copy to a safe location).
3. **Lower apex DNS TTL** on the v1 zone from its current value to **300s**
   at least 48h before the cutover so resolvers drop the old record quickly.
   (Cutover lives or dies on this step — skip it and you're stuck with the
   old IP in caches for hours.)
4. **Notify** any agency customers of the scheduled window (15-minute risk
   envelope; actual user-visible downtime ~30s).

## T-1 day — dry run

1. Boot a scratch subdomain (e.g. `preview.wheretogoforgreatweather.com`)
   as a CNAME to `v2.wheretogoforgreatweather.com` — exercises Caddy's
   on-demand TLS for a second hostname.
2. Confirm `GET /` returns 200, tiles load, `/api/health` returns 200.
3. Run `./infra/scripts/backup-postgres.sh` manually. Inspect log — must end
   with `backup OK`. Run `./infra/scripts/restore-postgres.sh wtg latest`
   against a disposable scratch DB on the v2 host and confirm schema + row
   counts match.
4. Trigger a GlitchTip test error via `GET /api/debug/error` and a client
   error via `/debug/client-error`; confirm both show up.

## T-0 — cutover

All commands run on the v2 host unless stated.

### 1. Freeze writes on v1

On the v1 box, put the app into maintenance mode (502 banner is fine).
Stop any cron that writes to Postgres. Take a final v1 dump:
```
pg_dump -U wtg -Fc wtg > /root/v1-final.dump
```

### 2. Copy v1 state into v2 Postgres

Copy `v1-final.dump` to the v2 host, then on the v2 host:
```
docker compose cp v1-final.dump postgres:/tmp/v1-final.dump
WTG_RESTORE_CONFIRM=yes-overwrite \
  ./infra/scripts/restore-postgres.sh wtg <stamp-placeholder>
```
(The restore script's "stamp" arg is ignored for a direct file — for the v1
dump, run `pg_restore` inline instead:
```
docker compose exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d wtg --clean --if-exists --no-owner \
  --no-privileges /tmp/v1-final.dump
```
)

### 3. Flip Paddle to live

On the v2 host, edit `.env`:
- `PADDLE_SANDBOX=false`
- `PADDLE_CHECKOUT_BASE_URL=` (leave empty — config auto-picks live URL)
- `PADDLE_API_KEY=<live-key>`
- `PADDLE_WEBHOOK_SECRET=<live-signing-secret>`
- `PADDLE_PRICE_CONSUMER_PREMIUM=<live-price-id>`
- `PADDLE_PRICE_AGENCY_STARTER=<live-price-id>`
- `PADDLE_PRICE_AGENCY_PRO=<live-price-id>`

In the Paddle dashboard, repoint the live webhook at
`https://wheretogoforgreatweather.com/api/webhooks/paddle`.

Restart the API so it picks up the new env:
```
docker compose up -d --force-recreate api
```

### 4. Flip web env to prod

In `.env` on the v2 host:
- `NEXT_PUBLIC_APP_ENV=prod`
- `NEXT_PUBLIC_SITE_URL=https://wheretogoforgreatweather.com`
- `NEXT_PUBLIC_API_URL=https://wheretogoforgreatweather.com/api`
- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=wheretogoforgreatweather.com`

Rebuild + restart `web`:
```
docker compose up -d --build web
```

This also flips `robots.txt` from blanket-disallow to crawlable
(see `web/src/app/robots.ts`).

### 5. Teach Caddy about the apex

Edit `Caddyfile` on the v2 host — replace the `v2.…` site block's host
selector with a pair:
```
v2.wheretogoforgreatweather.com, wheretogoforgreatweather.com {
    ...
}
```
Reload Caddy (no downtime):
```
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```
Caddy will auto-provision a Let's Encrypt cert for the apex on first HTTPS
request. Verify:
```
curl -vI https://wheretogoforgreatweather.com/ 2>&1 | grep -i 'HTTP/\|issuer'
```

### 6. DNS flip

On the DNS provider for `wheretogoforgreatweather.com`:
- Change the apex `A` / `AAAA` records from the v1 IPs to the v2 host IPs.
- Leave `www` as `CNAME → wheretogoforgreatweather.com` if it already is;
  otherwise set it.

Watch propagation:
```
while true; do dig +short wheretogoforgreatweather.com @1.1.1.1; sleep 5; done
```

### 7. Smoke test on the real apex

- `curl -sfI https://wheretogoforgreatweather.com/` → 200
- `curl -sf https://wheretogoforgreatweather.com/api/health` → 200
- Load `/` in an incognito window, verify the map renders.
- Log in with a test account, verify `PostHog` receives an `identify`.
- Click an upgrade prompt → arrives at the **live** Paddle checkout
  (URL should be `checkout.paddle.com`, not `sandbox-checkout.paddle.com`).
- Trigger `./infra/scripts/weekly-advisories.sh` manually once to warm the
  fresh path on the new apex.

### 8. Re-raise DNS TTL

Once you're confident (24h), raise the apex TTL back to its long-term
value (3600s or higher).

---

## Rollback

If any smoke-test step fails and the problem isn't obviously fixable in
≤5 minutes, roll back. The v1 box is still running — you haven't touched it.

1. **Revert DNS**: set the apex `A` record back to the v1 IP. TTL is 300s,
   so resolvers drop the v2 record within ~5 minutes.
2. **Lift v1 maintenance mode** once DNS has propagated (check with
   `dig +short wheretogoforgreatweather.com @1.1.1.1`).
3. **Keep v2 running** — it will serve the `v2.` subdomain as before.
4. **Restore any writes** made on v2 between step 2 and rollback: dump
   affected tables from v2 Postgres and re-apply to v1 by hand. Typically
   small (orders, magic-link tokens).
5. **Repoint Paddle webhook** back at v1.
6. **Post-mortem** before attempting cutover again.

---

## Post-cutover checklist (first 72h)

- [ ] GlitchTip error rate stays under staging baseline + 50%. If it
  spikes, the first dashboard to check is `/_glitchtip`.
- [ ] Plausible unique visitors ≥ v1 baseline (compare to v1 analytics).
- [ ] PostHog `identify` firing on every login; no anonymous post-login
  sessions.
- [ ] `./infra/scripts/backup-postgres.sh` fires at 02:00 UTC on the new
  host (`tail /var/log/wtg-backup.log`). Verify the artifact in B2.
- [ ] Weekly advisory cron fires on Sunday; fresh `advisories.json`
  published (`curl -sI https://wheretogoforgreatweather.com/advisories.json`
  shows a recent `last-modified`).
- [ ] Weekly alert cron fires on Monday; `/var/log/wtg-alerts.log` has
  the JSON report line.
- [ ] One live Paddle transaction round-trips end to end (owner's own
  sub; immediately refund via the Paddle dashboard after verification).
- [ ] Lighthouse budget on `/` still green: LCP<2.0s, CLS<0.05, TBT<100ms.

## v1 decommission

- T+30 days after cutover: if no rollback was needed, snapshot the v1
  host image to cold storage and terminate the instance. Keep the
  snapshot for 12 months.
- Remove v1-specific DNS records (staging, backup subdomains, etc.).
- Archive the v1 repo with a README pointing to this one.

---

## Calendar reminders to set now

- **Next January 15** — owner reviews `yearly-era5.sh` output, manually
  promotes the new year's data if the QA comparison looks clean.
- **T+30 days** — v1 decommission.
- **T+90 days** — rotate `SESSION_SECRET`, `TILE_SIGNING_SECRET`,
  `PADDLE_WEBHOOK_SECRET`. Forces all sessions to re-auth — do it during
  a low-traffic window.
