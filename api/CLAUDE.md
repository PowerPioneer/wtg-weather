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
- **Entitlements**: all protected routes pass through `services.entitlements`
  which resolves `(user, plan)` and caches for 60 seconds in Redis.
- **Country data**: `/v1/countries*` serves the pipeline's
  `wtg publish api-data` bundle from a read-only bind mount
  (`COUNTRY_DATA_DIR`, `/srv/wtg-data` in compose), via
  `services.country_data`. No database, because there is nothing to write:
  it is reference data regenerated whole by the yearly climate rebuild and the
  weekly advisory run. It is mounted rather than loaded into Postgres because
  the pipeline runs on the host and Postgres is on the internal-only network
  this repo forbids exposing to it.

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
- Rate limits: 100 req/min anonymous, 600 req/min authenticated,
  implemented with `slowapi` + Redis.
- CORS: only `https://wheretogoforgreatweather.com` and
  `https://v2.wheretogoforgreatweather.com` in prod; `localhost:3000` in dev.

## Migrations

- `uv run alembic revision --autogenerate -m "description"` — generate
- Always hand-review the generated migration; autogenerate misses enums
  and indexes.
- Never edit a migration after it's been merged to main.
