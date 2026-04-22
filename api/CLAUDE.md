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
