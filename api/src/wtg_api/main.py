from __future__ import annotations

from fastapi import FastAPI

from wtg_api import __version__


def create_app() -> FastAPI:
    app = FastAPI(title="wtg-api", version=__version__)

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "version": __version__}

    return app


app = create_app()
