from __future__ import annotations

from fastapi import FastAPI, HTTPException

from wtg_api import __version__
from wtg_api.config import get_settings
from wtg_api.middleware import SlidingSessionMiddleware, install_cors
from wtg_api.routers import (
    auth,
    onboarding,
    orgs,
    paddle,
    paddle_checkout,
    public,
    tiles,
    trips,
    users,
)
from wtg_api.services.observability import init_sentry


def create_app() -> FastAPI:
    settings = get_settings()
    init_sentry(settings)

    app = FastAPI(title="wtg-api", version=__version__)

    install_cors(app)
    app.add_middleware(SlidingSessionMiddleware)

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "version": __version__}

    if settings.environment == "dev":

        @app.get("/api/debug/error", include_in_schema=False)
        async def _debug_error() -> None:
            raise RuntimeError("wtg-api deliberate test error")

        @app.get("/api/debug/http-error", include_in_schema=False)
        async def _debug_http_error() -> None:
            raise HTTPException(status_code=500, detail="wtg-api deliberate HTTP error")

    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(trips.router)
    app.include_router(orgs.router)
    app.include_router(tiles.router)
    app.include_router(paddle.router)
    app.include_router(paddle_checkout.router)
    app.include_router(onboarding.router)
    app.include_router(public.router)

    return app


app = create_app()
