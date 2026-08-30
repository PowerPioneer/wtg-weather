from __future__ import annotations

from wtg_api.config import Settings
from wtg_api.services.observability import _before_send, _scrub, init_sentry


def test_scrub_redacts_email_and_ip() -> None:
    body = {
        "note": "user foo@bar.com signed in from 203.0.113.4",
        "nested": {"ip": "10.0.0.1"},
        "list": ["ok", "alice@example.org"],
    }
    out = _scrub(body)
    assert "foo@bar.com" not in str(out)
    assert "203.0.113.4" not in str(out)
    assert "10.0.0.1" not in str(out)
    assert "alice@example.org" not in str(out)


def test_before_send_drops_pii_fields() -> None:
    event: dict = {
        "user": {"email": "x@y.com", "ip_address": "1.2.3.4", "id": "u1"},
        "request": {
            "cookies": {"wtg_session": "secret"},
            "headers": {"authorization": "Bearer x", "user-agent": "ua"},
        },
        "extra": {"trace": "user bob@example.com hit /api/me"},
    }
    out = _before_send(event, {})
    assert out is not None
    assert "email" not in out["user"] and "ip_address" not in out["user"]
    assert out["user"]["id"] == "u1"
    assert "cookies" not in out["request"]
    assert "authorization" not in out["request"]["headers"]
    assert out["request"]["headers"]["user-agent"] == "ua"
    assert "bob@example.com" not in str(out["extra"])


def test_init_sentry_noop_when_dsn_blank() -> None:
    settings = Settings(glitchtip_dsn="")
    assert init_sentry(settings) is False


def test_paddle_payment_link_defaults_to_our_own_domain() -> None:
    """Not a paddle.com host, and that is the point.

    Paddle Billing's payment link is a page on *our* site that runs Paddle.js;
    Paddle appends `?_ptxn=` to it. The setting this replaced pointed at
    `checkout.paddle.com/checkout/custom`, which is Paddle Classic and cannot
    take a `pri_` price.
    """
    settings = Settings(
        public_web_origin="https://v2.wheretogoforgreatweather.com",
        paddle_payment_link_url="",
    )
    assert settings.paddle_payment_link_url == (
        "https://v2.wheretogoforgreatweather.com/checkout/pay"
    )


def test_paddle_payment_link_does_not_double_up_slashes() -> None:
    settings = Settings(
        public_web_origin="https://example.com/", paddle_payment_link_url=""
    )
    assert settings.paddle_payment_link_url == "https://example.com/checkout/pay"


def test_paddle_payment_link_explicit_override_preserved() -> None:
    settings = Settings(
        paddle_sandbox=False,
        paddle_payment_link_url="https://mock.example.com/pay",
    )
    assert settings.paddle_payment_link_url == "https://mock.example.com/pay"
