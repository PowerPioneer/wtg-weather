from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PADDLE_SANDBOX_API = "https://sandbox-api.paddle.com"
_PADDLE_LIVE_API = "https://api.paddle.com"
# The page on *our own* domain that hosts Paddle.js. Paddle Billing has no
# hand-buildable checkout URL — a transaction's `checkout.url` is this link
# with `?_ptxn=<transaction id>` appended, and Paddle.js on that page opens the
# checkout when it sees the parameter. It must be an approved website in
# Paddle > Checkout > Website approval.
_PADDLE_PAY_PATH = "/checkout/pay"

# What each email provider needs before it can send anything. `build_provider`
# and the startup check below read this same map, so a provider cannot be
# taught to one without the other noticing.
_EMAIL_CREDENTIALS: dict[str, tuple[str, ...]] = {
    "sendgrid": ("sendgrid_api_key",),
    "postmark": ("postmark_token",),
    "scaleway": ("scaleway_secret_key", "scaleway_project_id"),
}


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
    # Longer than a magic link because an invitation is addressed to somebody
    # who may not be at their desk, and shorter than a session because it is
    # still a bearer credential for a mailbox. Enforced twice — on the token's
    # signature and on the row's `expires_at` — so lowering it here expires
    # links that were already sent.
    invite_ttl_seconds: int = 7 * 24 * 3600
    session_cookie_name: str = "wtg_session"
    session_ttl_seconds: int = 30 * 24 * 3600

    # An unsubscribe link has to outlive the email it arrived in — people act on
    # a year-old newsletter, and a dead unsubscribe link is a spam complaint
    # instead. Long, therefore, but not unbounded: it is still a bearer token,
    # even though the only thing it can do is silence the holder's own alert
    # mail. Enforced on the signature; there is no row to expire alongside it,
    # unlike an invitation.
    alert_unsubscribe_ttl_seconds: int = 365 * 24 * 3600

    # --- Alert matching ---
    #
    # `alert_match_score` is the 0–100 score at or above which a place counts as
    # matching. 70 is the floor of the "Good option" bin in the web's
    # `SCORE_BINS`, so the email agrees with the badge the user saw when they
    # created the alert.
    alert_match_score: int = 70
    # Confirmed by the owner 2026-08-31, closing `web/design/HANDOFF.md` open
    # decision #3, which specced "score delta ≥ 5 points vs baseline".
    #
    # It is the hysteresis guard: a run only emails when the score has moved at
    # least this far from the score at the last email, so a value oscillating
    # across the match line cannot mail somebody every Monday.
    #
    # It does not bind today, and that is why 5 was cheap to accept. The
    # published score is quantised to {25, 60, 75, 90}, so the smallest possible
    # move across the match line is 15 points and any threshold from 1 to 15
    # behaves identically. It is named and configurable because the moment
    # scoring becomes continuous it becomes load-bearing — revisit it then,
    # rather than discovering it as a literal buried in a conditional.
    alert_score_delta_points: int = 5

    # CDN hostname tile URLs are signed against. Production points the
    # `cdn.wheretogoforgreatweather.com` CNAME at the bunny.net pull zone
    # `wtgweather` (zone names must be ≥4 chars, hence not `wtg`). Override
    # per-environment via `CDN_URL`.
    cdn_url: str = "https://cdn.wheretogoforgreatweather.com"
    public_web_origin: str = "http://localhost:3000"
    # Where `/api/*` is reachable from the public internet. In production Caddy
    # fronts both the web app and `/api/*` on the same hostname, so this tracks
    # `public_web_origin` unless set — but a dev box runs Next on :3000 and the
    # API on :8000, and an unsubscribe link is one of the few URLs the API mints
    # for somebody outside the docker network to click.
    public_api_origin: str = ""

    # Where the pipeline's `wtg publish api-data` bundle is mounted. Compose
    # binds `./pipeline/data/final/api` here read-only; a dev run against a
    # local checkout points it at the same path outside the container.
    country_data_dir: str = "/srv/wtg-data"

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/google/callback"

    email_provider: Literal["sendgrid", "postmark", "scaleway", "console"] = "console"
    sendgrid_api_key: str = ""
    postmark_token: str = ""
    # Scaleway Transactional Email needs *both* a secret key and a project id:
    # a send is scoped to a project and the API will not infer one from the
    # token, so a key on its own cannot address the endpoint. `build_provider`
    # therefore requires the pair before it selects this provider.
    scaleway_secret_key: str = ""
    scaleway_project_id: str = ""
    # `fr-par` is the only region offering the service today. Configurable so a
    # second one costs a variable rather than a release.
    scaleway_email_region: str = "fr-par"
    email_from: str = "hello@wheretogoforgreatweather.com"

    paddle_api_key: str = ""
    paddle_sandbox: bool = True
    # Where customer-portal sessions are minted. Sandbox and live are separate
    # hosts with separate keys; pairing a live key with the sandbox host (or the
    # reverse) fails closed with a 403 from Paddle rather than doing something
    # surprising. Left empty to track `paddle_sandbox`.
    paddle_api_base_url: str = ""
    # Our default payment link — see `_PADDLE_PAY_PATH`. Left empty it tracks
    # `public_web_origin`; set it only to point at a different approved domain.
    # Note this is *not* a paddle.com host: the old `paddle_checkout_base_url`
    # was, and it addressed Paddle Classic, which cannot take a `pri_` price.
    paddle_payment_link_url: str = ""
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

    def missing_email_credentials(self) -> list[str]:
        """Env var names the selected provider requires and does not have."""
        return [
            name.upper()
            for name in _EMAIL_CREDENTIALS.get(self.email_provider, ())
            if not getattr(self, name)
        ]

    @model_validator(mode="after")
    def _fail_closed_on_half_configured_email(self) -> Settings:
        """Refuse to boot rather than quietly downgrade to `ConsoleEmail`.

        The fallback is the dangerous part, not the missing key: console mode
        *prints the magic-link token to the container log* and reports the send
        as successful, so a typo'd variable looks like a working deploy until
        somebody notices no mail has arrived — and by then the auth tokens are
        in the log stream. Same fail-closed shape as Caddy's missing basic-auth
        hash (`infra/CLAUDE.md`).
        """
        missing = self.missing_email_credentials()
        if missing:
            raise ValueError(
                f"EMAIL_PROVIDER={self.email_provider} requires "
                f"{', '.join(missing)}. Set them, or set EMAIL_PROVIDER=console "
                "to log mail deliberately."
            )
        return self

    @model_validator(mode="after")
    def _resolve_paddle_checkout_base_url(self) -> Settings:
        if not self.paddle_payment_link_url:
            self.paddle_payment_link_url = (
                f"{self.public_web_origin.rstrip('/')}{_PADDLE_PAY_PATH}"
            )
        if not self.paddle_api_base_url:
            self.paddle_api_base_url = (
                _PADDLE_SANDBOX_API if self.paddle_sandbox else _PADDLE_LIVE_API
            )
        if not self.public_api_origin:
            self.public_api_origin = self.public_web_origin
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
