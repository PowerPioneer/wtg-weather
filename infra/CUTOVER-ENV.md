# Cutover `.env` checklist

Every `.env` change the v1 → v2 apex cutover needs, for `infra/CUTOVER.md`
T-0 step 2. Prepare it at T-1 as `/opt/wtg-weather/.env.cutover` (a copy of the
current `.env` with these values changed), so the day is
`cp .env /root/.env.pre-cutover.<stamp> && cp .env.cutover .env`.

No values here — only names, targets and how to check them. Secrets stay in the
box's `.env` (root `CLAUDE.md`: never committed, never copied from dev).

**Read by** says which container needs recreating; **build** means the value is
inlined into the web bundle by `next build`, so it only takes effect after
`NO_CACHE=1 ./infra/scripts/build-web.sh`.

## Paddle: sandbox → live

These seven move **together**. The API creates a transaction on one account and
the browser opens it on another if they disagree, and `lib/paddle.ts` refuses
to open a checkout when the environment and the token disagree.

| Variable | Cutover value | Read by | Check |
|---|---|---|---|
| `PADDLE_SANDBOX` | `false` | api | Unset means **sandbox** on purpose — it must be written out. |
| `PADDLE_API_KEY` | live API key | api | Created in the **live** dashboard; sandbox keys are refused by `api.paddle.com`. |
| `PADDLE_WEBHOOK_SECRET` | secret of the live notification destination | api | From *Developer tools → Notifications* on the destination pointing at the apex. A mismatch logs `paddle.webhook.bad_signature`. |
| `PADDLE_PRICE_CONSUMER_PREMIUM` | live `pri_…` | api | Live price ids differ from sandbox ones. |
| `PADDLE_PRICE_AGENCY_STARTER` | live `pri_…` | api | 〃 |
| `PADDLE_PRICE_AGENCY_PRO` | live `pri_…` | api | 〃 |
| `NEXT_PUBLIC_PADDLE_ENV` | `production` | **build** | No default. Must be exactly `production`; the code cross-checks it against the token. |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | `live_…` | **build** | Client-side token from the live dashboard. A `test_…` token with `production` refuses to open checkout. |

Delete if present: `PADDLE_CHECKOUT_BASE_URL` (Paddle Classic, unused).
Leave unset: `PADDLE_API_BASE_URL` and `PADDLE_PAYMENT_LINK_URL` — they follow
`PADDLE_SANDBOX` and `PUBLIC_WEB_ORIGIN`.

## Origins: `v2.` → apex

| Variable | Cutover value | Read by | Check |
|---|---|---|---|
| `PUBLIC_WEB_ORIGIN` | `https://wheretogoforgreatweather.com` | api | Magic links, unsubscribe links, and Paddle's default payment link (`/checkout/pay`) are built from it. No trailing slash. |
| `GOOGLE_REDIRECT_URI` | `https://wheretogoforgreatweather.com/api/auth/google/callback` | api | Must be listed exactly in the Google Cloud OAuth client (T-7). |
| `NEXT_PUBLIC_SITE_URL` | `https://wheretogoforgreatweather.com` | **build** | Canonicals, OG tags, sitemap, `robots.txt` host, Paddle's success URL. |
| `NEXT_PUBLIC_API_URL` | `https://wheretogoforgreatweather.com/api` | **build** | |
| `NEXT_PUBLIC_APP_ENV` | `prod` | **build** | Flips `robots.txt` from `Disallow: /` to crawlable. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | `wheretogoforgreatweather.com` | **build** | Must match the site added in Plausible (T-7), or visits are dropped. |

Leave unset: `PUBLIC_API_ORIGIN` (tracks `PUBLIC_WEB_ORIGIN`).

## Unchanged — check they are still right

| Variable | Expected | Why it does not move |
|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | `phc_…` (already set) | Same project. |
| `NEXT_PUBLIC_POSTHOG_HOST` | unset, or `https://eu.i.posthog.com` | The code defaults to the EU host; a `us` value would send EU data to the US. |
| `CDN_URL`, `NEXT_PUBLIC_CDN_URL` | the bunny.net hostname | The CDN does not move. |
| `NEXT_PUBLIC_PLAUSIBLE_SRC` | `https://plausible.v2.wheretogoforgreatweather.com/js/script.js` | The ops subdomains keep their `v2.` names. |
| `GLITCHTIP_DSN_API`, `GLITCHTIP_DSN_WEB` | `http://…@glitchtip-web:8000/…` | Internal hostnames, unaffected. |
| `NEXT_PUBLIC_GLITCHTIP_DSN_WEB` | `https://…@glitchtip.v2.wheretogoforgreatweather.com/…` | Ops subdomain, unaffected. |
| `EMAIL_PROVIDER` | `scaleway` | The sending domain is verified at T-7, not here. |
| `CADDY_BASICAUTH_HASH` | 60 characters, `$` doubled | Untouched — but a rewritten `.env` is where it gets mangled. Check with `docker compose exec caddy sh -c 'echo ${#CADDY_BASICAUTH_HASH}'`. |

## Check it before swapping

```bash
./infra/scripts/check-env-cutover.sh .env.cutover
```

Prints names and pass/fail only, never a value, so the output is safe to share.

## After swapping the file

```bash
docker compose config --quiet && echo "compose OK"   # a warning naming a random string = a mangled `$`
docker compose up -d --force-recreate api
NO_CACHE=1 ./infra/scripts/build-web.sh && docker compose up -d --force-recreate web
```

Then confirm what actually reached the containers, without printing secrets:

```bash
docker compose exec api python -c "from wtg_api.config import get_settings as g; s=g(); print(s.paddle_sandbox, s.public_web_origin, s.google_redirect_uri, s.paddle_price_consumer_premium[:8])"
curl -s https://v2.wheretogoforgreatweather.com/robots.txt | head -3        # before DNS: should already say Allow
```

`robots.txt` allowing crawling on `v2.` for the few minutes before DNS moves is
harmless: its `Host` and sitemap already name the apex.
