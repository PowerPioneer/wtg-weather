from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PADDLE_SANDBOX_CHECKOUT = "https://sandbox-checkout.paddle.com/checkout/custom"
_PADDLE_LIVE_CHECKOUT = "https://checkout.paddle.com/checkout/custom"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    environment: Literal["dev", "test", "prod"] = "dev"

    database_url: str = "postgresql+asyncpg://wtg:wtg@localhost/wtg"
    redis_url: str = "redis://localhost:6379/0"

    session_secret: str = "dev-session-secret-change-me"
    tile_signing_secret: str = "dev-tile-signing-secret-change-me"
    paddle_webhook_secret: str = "dev-paddle-webhook-secret-change-me"

    tile_signature_ttl_seconds: int = 15 * 60
    magic_link_ttl_seconds: int = 15 * 60
    session_cookie_name: str = "wtg_session"
    session_ttl_seconds: int = 30 * 24 * 3600

    cdn_url: str = "https://wtg.b-cdn.net"
    public_web_origin: str = "http://localhost:3000"

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/google/callback"

    email_provider: Literal["sendgrid", "postmark", "console"] = "console"
    sendgrid_api_key: str = ""
    postmark_token: str = ""
    email_from: str = "hello@wheretogoforgreatweather.com"

    paddle_api_key: str = ""
    paddle_sandbox: bool = True
    # Leave empty in .env to auto-pick based on paddle_sandbox. Set explicitly
    # only to override (e.g. staging pointing at a self-hosted mock).
    paddle_checkout_base_url: str = ""
    paddle_price_consumer_premium: str = "pri_sandbox_consumer_premium"
    paddle_price_agency_starter: str = "pri_sandbox_agency_starter"
    paddle_price_agency_pro: str = "pri_sandbox_agency_pro"

    rate_limit_anonymous: str = "100/minute"
    rate_limit_authenticated: str = "600/minute"

    glitchtip_dsn: str = ""
    glitchtip_traces_sample_rate: float = 0.0
    glitchtip_release: str = ""

    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "https://v2.wheretogoforgreatweather.com",
            "https://wheretogoforgreatweather.com",
        ]
    )

    @model_validator(mode="after")
    def _resolve_paddle_checkout_base_url(self) -> Settings:
        if not self.paddle_checkout_base_url:
            self.paddle_checkout_base_url = (
                _PADDLE_SANDBOX_CHECKOUT if self.paddle_sandbox else _PADDLE_LIVE_CHECKOUT
            )
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
