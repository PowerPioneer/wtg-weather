Generate and apply an Alembic migration for the API.

Workflow:
1. Ask the user what schema change they want.
2. Edit models under `api/src/wtg_api/models/`.
3. `uv run --directory api alembic revision --autogenerate -m "<description>"`.
4. Hand-review the generated file; autogenerate misses enums and indexes.
5. `uv run --directory api alembic upgrade head` to apply.

Never edit a migration that has been merged to `main`.
