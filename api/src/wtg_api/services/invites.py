"""Agency seat invitations: tokens, seat accounting, and the invite email.

Security notes, because this is auth-adjacent code:

- An invite token is an `itsdangerous` `URLSafeTimedSerializer` payload over
  the invitation's id, under its own salt (`wtg.invite.v1`). It shares neither
  salt nor purpose with the session or magic-link serializers, so a token
  minted for one cannot be replayed as another even though all three are signed
  with `SESSION_SECRET`.
- The token carries **no email address and no organization id**. Everything the
  accept path needs is read from the row, so a signature that verifies still
  cannot claim a seat in an org the invitation was not written for.
- Expiry is enforced twice: `max_age` on the signature, and `expires_at` on the
  row. The row is authoritative, which is what lets an operator shorten
  `INVITE_TTL_SECONDS` and have it apply to links already in inboxes.
- Single use is a database fact (`accepted_at`), not a signature property —
  signatures stay valid until they expire, so a forwarded link would otherwise
  keep working after the seat was taken.

Seat accounting lives here too, because a pending invitation reserves a seat.
Counting only memberships would let an owner on a 3-seat plan send ten invites
and end up with ten members, which is the cap not existing.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import NamedTuple
from urllib.parse import urlencode

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.config import get_settings
from wtg_api.models import Invitation, Membership
from wtg_api.services.email import EmailMessage, build_provider, redact_email

logger = logging.getLogger(__name__)

_INVITE_SALT = "wtg.invite.v1"


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().session_secret, salt=_INVITE_SALT)


def invite_expiry(now: datetime | None = None) -> datetime:
    now = now or datetime.now(timezone.utc)
    return now + timedelta(seconds=get_settings().invite_ttl_seconds)


def issue_invite_token(invitation_id: uuid.UUID) -> str:
    return _serializer().dumps({"iid": str(invitation_id)})


class InviteToken(NamedTuple):
    """The result of reading a token.

    Two failures, told apart on purpose. A token whose *signature* has aged out
    is a real invitation that ran out of time, and the recipient should be told
    that so they can ask for another; a token that does not verify at all is
    indistinguishable from a guess and gets the same answer as an unknown id.
    Collapsing them into one `None` made a legitimately late click look like a
    forgery.
    """

    invitation_id: uuid.UUID | None
    expired: bool = False


def read_invite_token(token: str) -> InviteToken:
    try:
        data = _serializer().loads(token, max_age=get_settings().invite_ttl_seconds)
    except SignatureExpired:
        return InviteToken(None, expired=True)
    except BadSignature:
        return InviteToken(None)
    raw = data.get("iid") if isinstance(data, dict) else None
    if not isinstance(raw, str):
        return InviteToken(None)
    try:
        return InviteToken(uuid.UUID(raw))
    except ValueError:
        return InviteToken(None)


def invite_url(token: str) -> str:
    origin = get_settings().public_web_origin
    return f"{origin}/invite?{urlencode({'token': token})}"


@dataclass(frozen=True)
class SeatUsage:
    """What the cap is measured against.

    `members` is the number the `/api/me` contract already calls `seats_used`;
    `pending` is the invitations that have not been accepted or revoked. The
    cap applies to their sum — see the module docstring.
    """

    members: int
    pending: int
    cap: int

    @property
    def used(self) -> int:
        return self.members + self.pending

    @property
    def available(self) -> int:
        return max(self.cap - self.used, 0)

    @property
    def at_cap(self) -> bool:
        return self.used >= self.cap


async def seat_usage(session: AsyncSession, org_id: uuid.UUID, cap: int) -> SeatUsage:
    members = await session.scalar(
        select(func.count())
        .select_from(Membership)
        .where(Membership.organization_id == org_id)
    )
    pending = await session.scalar(
        select(func.count())
        .select_from(Invitation)
        .where(
            Invitation.organization_id == org_id,
            Invitation.accepted_at.is_(None),
            Invitation.revoked_at.is_(None),
            Invitation.expires_at > datetime.now(timezone.utc),
        )
    )
    return SeatUsage(members=int(members or 0), pending=int(pending or 0), cap=cap)


async def send_invite_email(
    *, to: str, org_name: str, token: str, inviter: str | None
) -> None:
    """Mail the invitation. Always through the adapter, which tests replace.

    The log line is constructed already-redacted: the invitee's address is the
    one piece of PII this flow handles and it must not reach a log in the clear
    (root `CLAUDE.md`).
    """
    url = invite_url(token)
    who = f"{inviter} has" if inviter else "You have been"
    days = max(get_settings().invite_ttl_seconds // 86400, 1)
    await build_provider().send(
        EmailMessage(
            to=to,
            subject=f"Join {org_name} on Where to Go for Great Weather",
            text=(
                f"{who} invited you to join {org_name}.\n\n"
                f"Open the link below to accept and sign in:\n\n{url}\n\n"
                f"The link works once and expires in {days} days. "
                "If you weren't expecting it, ignore this message — "
                "nothing happens until it is opened."
            ),
        )
    )
    logger.info("invite.sent to=%s org=%s", redact_email(to), org_name)
