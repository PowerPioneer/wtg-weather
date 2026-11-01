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
- **Paddle checkout**: `/api/paddle/checkout-url` creates a **transaction**
  (`POST /transactions`) and returns its id; the browser opens the overlay with
  `Paddle.Checkout.open({transactionId})`. Paddle Billing has no buildable
  checkout URL — a `pri_` price is reachable only through Paddle.js or a
  transaction — so anything that composes a `checkout.paddle.com` URL by hand
  is Paddle *Classic* and will not work. `custom_data` (`plan`, `user_id`,
  `organization_id`) is attached **here**, after the membership check, and must
  stay server-side: `routers/paddle.py::_extract_plan` trusts
  `custom_data["plan"]` over the price, so a client that could set it would buy
  the cheapest price and claim the dearest plan.
- **Email**: `services.email` picks one provider from `EMAIL_PROVIDER` and
  falls back to `ConsoleEmail` whenever the matching credential is missing —
  so a misconfigured production box prints magic links to its own logs rather
  than failing to boot. Prefer **`scaleway`**: the server is already Scaleway,
  so it is one account, one invoice, and no new EU sub-processor. It is the
  only provider needing *two* values (`SCALEWAY_SECRET_KEY` **and**
  `SCALEWAY_PROJECT_ID`) because a send is scoped to a project. Every provider
  must pass `EmailMessage.headers` through untouched — that is where the alert
  mail's `List-Unsubscribe` pair lives, which Gmail and Yahoo require on bulk
  mail and which fails invisibly when dropped. Scaleway's handling of it is
  **unverified**; confirm with a real send before the first alert run.

- **Entitlements**: all protected routes pass through `services.entitlements`,
  which resolves `(user, plan)` from the database on **every** request. There
  is no cache, deliberately: the lookup is one indexed join, and without a
  cache an upgrade, a cancellation or a revoked seat takes effect on the very
  next request rather than up to a minute later. (Earlier docs promised a
  60-second Redis cache that was never built.)
- **Country data**: `/v1/countries*` serves the pipeline's
  `wtg publish api-data` bundle from a read-only bind mount
  (`COUNTRY_DATA_DIR`, `/srv/wtg-data` in compose), via
  `services.country_data`. No database, because there is nothing to write:
  it is reference data regenerated whole by the yearly climate rebuild and the
  weekly advisory run. It is mounted rather than loaded into Postgres because
  the pipeline runs on the host and Postgres is on the internal-only network
  this repo forbids exposing to it.
- **Premium country series**: `GET /api/countries/{slug}/premium` serves the
  bundle's `premium/<slug>.json` (snow, sea temperature, humidity, heat) — a
  sibling of `countries/`, never inside it, because the static pages are built
  from `countries/` and are public HTML. Unlike `/v1/*` it is publicly routed,
  so it is gated like premium tiles: 401 without a session, 403 without the
  entitlement, 404 when the country has no premium series. Responses are
  `Cache-Control: private` — a shared cache must never hold one.

## Rules

- `/v1/*` is deliberately **not** routed by Caddy — it is reachable only from
  inside the docker network, which is where the SSR pages call it from. Adding
  a public route for it means adding a public rate-limit surface for it.
- All DB access is async. Never use sync SQLAlchemy.
- All external HTTP uses `httpx.AsyncClient`; never `requests`.
- Endpoints return Pydantic schemas, never raw model instances.
- Any endpoint touching money, auth, or tile signing must have a test
  that exercises the failure path (forged signature, expired session,
  missing entitlement, double-spend).
- Rate limits: 100 req/min per client IP signed out, 600 req/min per user
  signed in, as fixed windows in Redis (`middleware/rate_limit.py`, no
  slowapi). Only requests that came through Caddy count — no
  `X-Forwarded-For` means the web container rendering pages, which must not
  share one bucket — and `/api/tiles/verify`, `/api/webhooks/*` and
  `/api/health` are exempt. Fails **open** if Redis is unreachable. The
  magic-link throttle in `routers/auth.py` is separate and stricter.
- CORS: only `https://wheretogoforgreatweather.com` and
  `https://v2.wheretogoforgreatweather.com` in prod; `localhost:3000` in dev.

## Migrations

- `uv run alembic revision --autogenerate -m "description"` — generate
- Always hand-review the generated migration; autogenerate misses enums
  and indexes.
- Never edit a migration after it's been merged to main.
