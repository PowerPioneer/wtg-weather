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
