from __future__ import annotations

import logging
import re

import sentry_sdk
from sentry_sdk.integrations.asyncio import AsyncioIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from wtg_api.config import Settings

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")

logger = logging.getLogger(__name__)


def _scrub(value: object) -> object:
    if isinstance(value, str):
        scrubbed = _EMAIL_RE.sub("[redacted-email]", value)
        scrubbed = _IP_RE.sub("[redacted-ip]", scrubbed)
        return scrubbed
    if isinstance(value, dict):
        return {k: _scrub(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_scrub(v) for v in value]
    return value


def _before_send(event: dict, _hint: dict) -> dict | None:
    # CLAUDE.md rule: never send PII. Belt-and-braces — redact email + IP
    # from the serialized event before it leaves the process.
    if "user" in event:
        event["user"].pop("email", None)
        event["user"].pop("ip_address", None)
    if "request" in event and isinstance(event["request"], dict):
        event["request"].pop("cookies", None)
        headers = event["request"].get("headers")
        if isinstance(headers, dict):
            for k in ("authorization", "cookie", "x-forwarded-for"):
                headers.pop(k, None)
    if "extra" in event:
        event["extra"] = _scrub(event["extra"])  # type: ignore[assignment]
    if "breadcrumbs" in event and "values" in event["breadcrumbs"]:
        event["breadcrumbs"]["values"] = _scrub(event["breadcrumbs"]["values"])
    return event


def init_sentry(settings: Settings) -> bool:
    """Initialise sentry-sdk for GlitchTip. No-op when DSN is blank."""

    if not settings.glitchtip_dsn:
        logger.info("glitchtip_disabled", extra={"reason": "no_dsn"})
        return False

    sentry_sdk.init(
        dsn=settings.glitchtip_dsn,
        environment=settings.environment,
        release=settings.glitchtip_release or None,
        traces_sample_rate=settings.glitchtip_traces_sample_rate,
        send_default_pii=False,
        before_send=_before_send,
        integrations=[
            StarletteIntegration(),
            FastApiIntegration(),
            AsyncioIntegration(),
        ],
    )
    logger.info("glitchtip_enabled", extra={"environment": settings.environment})
    return True
