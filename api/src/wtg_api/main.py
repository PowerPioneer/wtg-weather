from __future__ import annotations

from fastapi import FastAPI

from wtg_api import __version__
from wtg_api.middleware import SlidingSessionMiddleware, install_cors
from wtg_api.routers import auth, orgs, paddle, public, tiles, trips, users


def create_app() -> FastAPI:
    app = FastAPI(title="wtg-api", version=__version__)

    install_cors(app)
    app.add_middleware(SlidingSessionMiddleware)

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "version": __version__}

    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(trips.router)
    app.include_router(orgs.router)
    app.include_router(tiles.router)
    app.include_router(paddle.router)
    app.include_router(public.router)

    return app


app = create_app()
