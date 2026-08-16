"""One-click unsubscribe for alert email: the token, and the opt-out it applies.

**Security implication — this is auth-adjacent.** The token is a bearer
credential that arrives in an inbox and is acted on with no session, which is
the same shape as a magic link. It is deliberately much weaker than one:

- Its own salt (``wtg.alert-unsub.v1``) under ``SESSION_SECRET``, sharing
  neither salt nor purpose with the session, magic-link or invite serializers.
  A token minted here cannot be replayed as any of them, and vice versa.
- It authorises exactly one state change — setting
  ``users.alerts_email_opted_out_at`` — and nothing reads it as identity. It
  cannot sign anybody in, cannot read a mailbox address back out, and cannot be
  escalated by pointing it at another endpoint.
- It carries **no email address**. The recipient is resolved from the row, so a
  token that verifies still only silences the account it was minted for.
- Expiry is on the signature, at :attr:`Settings.alert_unsubscribe_ttl_seconds`
  (a year). Unlike an invitation there is no row to expire alongside it, because
  there is no invitation-shaped record — the "row" is the user, who outlives
  every token.

Replay is a no-op rather than an error. A signature stays valid until it
expires, so a second press — by the user, or by a mail client retrying the
RFC 8058 POST, or by a link scanner — must land on the same state and say so.
Un-setting the flag is not something this token can do; re-subscribing is a
signed-in action in ``/account``.

Scope is the **user**, not the alert. See ``User.alerts_email_opted_out_at``.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import NamedTuple
from urllib.parse import urlencode

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.config import get_settings
from wtg_api.models import User
from wtg_api.services.email import redact_email

logger = logging.getLogger(__name__)

_UNSUBSCRIBE_SALT = "wtg.alert-unsub.v1"


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().session_secret, salt=_UNSUBSCRIBE_SALT)


def issue_unsubscribe_token(user_id: uuid.UUID, alert_id: uuid.UUID | None = None) -> str:
    """Mint a token for ``user_id``.

    ``alert_id`` rides along for context only — it names the alert whose email
    carried this link, so a log line or a confirmation page can be specific.
    Nothing authorises off it, which is why an alert deleted between the send
    and the click does not break the unsubscribe. A link that stops working
    because the user tidied their account is a link that generates a spam
    complaint instead.
    """
    payload: dict[str, str] = {"uid": str(user_id)}
    if alert_id is not None:
        payload["aid"] = str(alert_id)
    return _serializer().dumps(payload)


class UnsubscribeToken(NamedTuple):
    """The result of reading a token.

    Expiry and forgery are told apart for the same reason ``InviteToken`` tells
    them apart: a year-old link that ran out is a real one, and the holder
    should be told to unsubscribe from `/account` instead. A token that does not
    verify is indistinguishable from a guess.
    """

    user_id: uuid.UUID | None
    alert_id: uuid.UUID | None = None
    expired: bool = False


def _uuid_or_none(raw: object) -> uuid.UUID | None:
    if not isinstance(raw, str):
        return None
    try:
        return uuid.UUID(raw)
    except ValueError:
        return None


def read_unsubscribe_token(token: str) -> UnsubscribeToken:
    try:
        data = _serializer().loads(
            token, max_age=get_settings().alert_unsubscribe_ttl_seconds
        )
    except SignatureExpired:
        return UnsubscribeToken(None, expired=True)
    except BadSignature:
        return UnsubscribeToken(None)
    if not isinstance(data, dict):
        return UnsubscribeToken(None)
    user_id = _uuid_or_none(data.get("uid"))
    if user_id is None:
        return UnsubscribeToken(None)
    return UnsubscribeToken(user_id, _uuid_or_none(data.get("aid")))


def unsubscribe_url(token: str) -> str:
    """The URL that goes in both `List-Unsubscribe` and the email footer.

    Served by the API rather than the web app because a mail client performing
    the RFC 8058 one-click POST talks to it directly, with no browser and no
    session — there is nothing for a Next.js route to add, and one fewer hop is
    one fewer thing that can be down when somebody is trying to make email stop.
    """
    origin = get_settings().public_api_origin.rstrip("/")
    return f"{origin}/api/alerts/unsubscribe?{urlencode({'token': token})}"


async def apply_unsubscribe(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    """Set the opt-out, idempotently. ``None`` when the user is gone.

    Idempotent by *keeping the first timestamp*: a replay must not look like a
    fresh unsubscribe, or the record of when somebody actually opted out is
    whatever date a link scanner last touched the message.
    """
    user = await session.get(User, user_id)
    if user is None:
        return None
    if user.alerts_email_opted_out_at is None:
        user.alerts_email_opted_out_at = datetime.now(timezone.utc)
        await session.commit()
        # Redacted at construction, per the root CLAUDE.md rule: this line is
        # the only place the flow names a recipient at all.
        logger.info("alerts.unsubscribed user=%s", redact_email(user.email))
    return user
