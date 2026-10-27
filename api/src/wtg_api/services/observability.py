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
# Magic-link, invite and unsubscribe links all carry a bearer token as
# `?token=`. A magic-link token is also the recipient's address in base64, so
# the email regex above never sees it.
_QUERY_TOKEN_RE = re.compile(r"((?:^|[?&])token=)[^&#\s\"]*")

logger = logging.getLogger(__name__)


def redact_query_tokens(text: str) -> str:
    return _QUERY_TOKEN_RE.sub(r"\1[redacted]", text)


class QueryTokenFilter(logging.Filter):
    """Redacts `?token=` from uvicorn's access line before it is formatted.

    The line is built from `record.args` (client, method, full path with query,
    HTTP version, status), so the path argument is rewritten rather than the
    message.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.args, tuple):
            record.args = tuple(
                redact_query_tokens(arg) if isinstance(arg, str) else arg
                for arg in record.args
            )
        return True


def install_log_redaction() -> None:
    """Attach `QueryTokenFilter` to uvicorn's access logger, once.

    Called from `create_app`, which uvicorn imports after configuring logging,
    so the filter survives its `dictConfig`.
    """
    access = logging.getLogger("uvicorn.access")
    if not any(isinstance(f, QueryTokenFilter) for f in access.filters):
        access.addFilter(QueryTokenFilter())


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
        for k in ("url", "query_string"):
            value = event["request"].get(k)
            if isinstance(value, str):
                event["request"][k] = redact_query_tokens(value)
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
        # Transactions carry the same `request` block, query string included.
        before_send_transaction=_before_send,
        integrations=[
            StarletteIntegration(),
            FastApiIntegration(),
            AsyncioIntegration(),
        ],
    )
    logger.info("glitchtip_enabled", extra={"environment": settings.environment})
    return True
