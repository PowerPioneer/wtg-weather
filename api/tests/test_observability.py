from __future__ import annotations

import logging

import pytest

from wtg_api.config import Settings
from wtg_api.main import create_app
from wtg_api.services.observability import _before_send, _scrub, init_sentry

# A real magic-link token: its first segment is the recipient's address in
# base64, so a logged token is a logged email as well as a live credential.
_TOKEN = "eyJlbWFpbCI6InBlcnNvbkBleGFtcGxlLmNvbSJ9.auBL2w.1ofujKR8kEsnz6YfXiNbleUmZck"


def test_access_log_redacts_query_tokens(caplog: pytest.LogCaptureFixture) -> None:
    """Uvicorn's access line carries the full path, query string included.

    Found on 2026-10-27, reading the logs of a sign-in outage: every
    `/api/auth/verify` line held the token in clear.
    """
    create_app()
    with caplog.at_level(logging.INFO, logger="uvicorn.access"):
        # Uvicorn's own format and argument order (`httptools_impl.py`).
        logging.getLogger("uvicorn.access").info(
            '%s - "%s %s HTTP/%s" %d',
            "172.19.0.8:44262",
            "GET",
            f"/api/auth/verify?token={_TOKEN}&next=%2Faccount",
            "1.1",
            500,
        )
    line = caplog.records[-1].getMessage()
    assert _TOKEN not in line
    assert "/api/auth/verify?token=[redacted]&next=%2Faccount" in line


def test_access_log_redaction_installed_once() -> None:
    create_app()
    create_app()
    access = logging.getLogger("uvicorn.access")
    assert len([f for f in access.filters if type(f).__name__ == "QueryTokenFilter"]) == 1


def test_before_send_redacts_query_tokens() -> None:
    event: dict = {
        "request": {
            "url": f"https://wheretogoforgreatweather.com/api/auth/verify?token={_TOKEN}",
            "query_string": f"token={_TOKEN}",
        },
    }
    out = _before_send(event, {})
    assert out is not None
    assert _TOKEN not in str(out)
    assert out["request"]["query_string"] == "token=[redacted]"


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
