"""Email adapter: console in dev, a hosted provider in staging/prod.

PII redaction: the concrete `to` address is never logged as-is; we log only the
domain and a one-way hash of the local-part, per the security rules.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass, field
from typing import Mapping, Protocol

import httpx

from wtg_api.config import Settings, get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmailMessage:
    to: str
    subject: str
    text: str
    html: str | None = None
    #: Extra RFC 5322 headers. Exists for `List-Unsubscribe` and
    #: `List-Unsubscribe-Post`, which are list-management requirements at
    #: Gmail and Yahoo for bulk senders rather than a nicety — a footer link
    #: alone does not satisfy them. Every provider below passes them through;
    #: a provider that could not would be the wrong provider for alert mail.
    headers: Mapping[str, str] = field(default_factory=dict)


def redact_email(addr: str) -> str:
    """A log-safe stand-in: the domain, plus a one-way hash of the local part.

    Public because it is not this module's business alone — anything that logs
    about a recipient (invitations, alerts) must construct the line already
    redacted rather than trusting a formatter downstream.
    """
    local, _, domain = addr.partition("@")
    digest = hashlib.sha256(local.encode("utf-8")).hexdigest()[:8]
    return f"{digest}@{domain or '?'}"


# Historical name, kept so existing call sites and tests keep working.
_redacted = redact_email


class EmailProvider(Protocol):
    async def send(self, message: EmailMessage) -> None: ...


class ConsoleEmail:
    async def send(self, message: EmailMessage) -> None:  # pragma: no cover — dev-only
        logger.info(
            "email.console.send to=%s subject=%s headers=%s",
            _redacted(message.to),
            message.subject,
            # Names only. A `List-Unsubscribe` value is a live token for the
            # recipient's account and has no business in a log line.
            sorted(message.headers),
        )
        # For local dev convenience, also print the text body.
        print(f"--- EMAIL ---\nTo: {message.to}\nSubject: {message.subject}\n\n{message.text}\n")


class SendGridEmail:
    def __init__(self, api_key: str, sender: str) -> None:
        self._api_key = api_key
        self._sender = sender

    async def send(self, message: EmailMessage) -> None:
        payload: dict[str, object] = {
            "personalizations": [{"to": [{"email": message.to}]}],
            "from": {"email": self._sender},
            "subject": message.subject,
            "content": [{"type": "text/plain", "value": message.text}]
            + ([{"type": "text/html", "value": message.html}] if message.html else []),
        }
        if message.headers:
            payload["headers"] = dict(message.headers)
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                json=payload,
                headers={"Authorization": f"Bearer {self._api_key}"},
            )
            resp.raise_for_status()
        logger.info("email.sendgrid.sent to=%s", _redacted(message.to))


class PostmarkEmail:
    def __init__(self, token: str, sender: str) -> None:
        self._token = token
        self._sender = sender

    async def send(self, message: EmailMessage) -> None:
        payload: dict[str, object] = {
            "From": self._sender,
            "To": message.to,
            "Subject": message.subject,
            "TextBody": message.text,
            "HtmlBody": message.html,
            "MessageStream": "outbound",
        }
        if message.headers:
            # Postmark takes a list of name/value pairs, not an object.
            payload["Headers"] = [
                {"Name": name, "Value": value} for name, value in message.headers.items()
            ]
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.postmarkapp.com/email",
                json=payload,
                headers={
                    "Accept": "application/json",
                    "X-Postmark-Server-Token": self._token,
                },
            )
            resp.raise_for_status()
        logger.info("email.postmark.sent to=%s", _redacted(message.to))


class ScalewayEmail:
    """Scaleway Transactional Email.

    Chosen because the box is already Scaleway: one account, one invoice, and
    the mail never leaves the EU, which keeps a sub-processor off the privacy
    policy rather than adding one. Unlike the two above, a send is scoped to a
    **project** as well as a key — hence `project_id` in the body, which the
    API requires and will not infer from the token.
    """

    #: `v1alpha1` is Scaleway's own spelling for this endpoint. It is not a
    #: beta we opted into; it is the only version the service publishes.
    _BASE = "https://api.scaleway.com/transactional-email/v1alpha1"

    def __init__(
        self, secret_key: str, project_id: str, sender: str, region: str = "fr-par"
    ) -> None:
        self._secret_key = secret_key
        self._project_id = project_id
        self._sender = sender
        self._region = region

    async def send(self, message: EmailMessage) -> None:
        payload: dict[str, object] = {
            "from": {"email": self._sender},
            "to": [{"email": message.to}],
            "subject": message.subject,
            "text": message.text,
            "project_id": self._project_id,
        }
        if message.html:
            payload["html"] = message.html
        if message.headers:
            # Pairs, like Postmark, but keyed `key`/`value` rather than
            # `Name`/`Value`. NOTE: that Scaleway passes `List-Unsubscribe`
            # through untouched is not documented either way — verify it
            # against a real send before the first bulk alert run, because a
            # silently dropped header is a Gmail bulk-sender violation we
            # would not see from our side.
            payload["additional_headers"] = [
                {"key": name, "value": value} for name, value in message.headers.items()
            ]
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{self._BASE}/regions/{self._region}/emails",
                json=payload,
                headers={"X-Auth-Token": self._secret_key},
            )
            resp.raise_for_status()
        logger.info("email.scaleway.sent to=%s", _redacted(message.to))


def build_provider(settings: Settings | None = None) -> EmailProvider:
    """Resolve the configured provider, or refuse.

    `ConsoleEmail` is reachable only by asking for it. A half-configured
    provider raises instead of degrading to it — see the note on
    `Settings._fail_closed_on_half_configured_email` for why silently logging
    magic-link tokens is the worse of the two failures.
    """
    settings = settings or get_settings()
    missing = settings.missing_email_credentials()
    if missing:
        # Unreachable through a booted app, because `Settings` will not
        # validate in this state. Kept because `model_copy` bypasses
        # validation, and because a guard on the failure that has no symptoms
        # is worth having twice.
        raise RuntimeError(
            f"EMAIL_PROVIDER={settings.email_provider} requires "
            f"{', '.join(missing)}; refusing to fall back to console email."
        )
    if settings.email_provider == "sendgrid":
        return SendGridEmail(settings.sendgrid_api_key, settings.email_from)
    if settings.email_provider == "postmark":
        return PostmarkEmail(settings.postmark_token, settings.email_from)
    if settings.email_provider == "scaleway":
        return ScalewayEmail(
            settings.scaleway_secret_key,
            settings.scaleway_project_id,
            settings.email_from,
            settings.scaleway_email_region,
        )
    return ConsoleEmail()
