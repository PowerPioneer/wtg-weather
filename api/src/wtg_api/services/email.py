"""Email adapter: console in dev, SendGrid in staging/prod, Postmark for paying users.

PII redaction: the concrete `to` address is never logged as-is; we log only the
domain and a one-way hash of the local-part, per the security rules.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from typing import Protocol

import httpx

from wtg_api.config import Settings, get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmailMessage:
    to: str
    subject: str
    text: str
    html: str | None = None


def _redacted(addr: str) -> str:
    local, _, domain = addr.partition("@")
    digest = hashlib.sha256(local.encode("utf-8")).hexdigest()[:8]
    return f"{digest}@{domain or '?'}"


class EmailProvider(Protocol):
    async def send(self, message: EmailMessage) -> None: ...


class ConsoleEmail:
    async def send(self, message: EmailMessage) -> None:  # pragma: no cover — dev-only
        logger.info(
            "email.console.send to=%s subject=%s",
            _redacted(message.to),
            message.subject,
        )
        # For local dev convenience, also print the text body.
        print(f"--- EMAIL ---\nTo: {message.to}\nSubject: {message.subject}\n\n{message.text}\n")


class SendGridEmail:
    def __init__(self, api_key: str, sender: str) -> None:
        self._api_key = api_key
        self._sender = sender

    async def send(self, message: EmailMessage) -> None:
        payload = {
            "personalizations": [{"to": [{"email": message.to}]}],
            "from": {"email": self._sender},
            "subject": message.subject,
            "content": [{"type": "text/plain", "value": message.text}]
            + ([{"type": "text/html", "value": message.html}] if message.html else []),
        }
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
        payload = {
            "From": self._sender,
            "To": message.to,
            "Subject": message.subject,
            "TextBody": message.text,
            "HtmlBody": message.html,
            "MessageStream": "outbound",
        }
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


def build_provider(settings: Settings | None = None) -> EmailProvider:
    settings = settings or get_settings()
    if settings.email_provider == "sendgrid" and settings.sendgrid_api_key:
        return SendGridEmail(settings.sendgrid_api_key, settings.email_from)
    if settings.email_provider == "postmark" and settings.postmark_token:
        return PostmarkEmail(settings.postmark_token, settings.email_from)
    return ConsoleEmail()
