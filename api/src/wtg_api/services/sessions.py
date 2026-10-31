"""Session cookie helpers.

Sessions are itsdangerous URLSafeTimedSerializer payloads holding the user id
and the user's `session_version` at the time of issue. They are set as
HttpOnly, Secure, SameSite=Lax cookies. Expiry is enforced by `max_age` on
verification (30-day sliding); revocation by `deps.optional_user` comparing
`sv` against the user row.

Magic-link tokens carry a `jti` naming their `MagicLinkToken` row, which is
what makes them single-use — see `models.magic_link_token`.
"""

from __future__ import annotations

import hashlib
import hmac
import uuid
from dataclasses import dataclass

from fastapi import Request, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from wtg_api.config import get_settings

_SESSION_SALT = "wtg.session.v1"
_MAGIC_LINK_SALT = "wtg.magic-link.v1"
_FINGERPRINT_KEY = b"wtg.fingerprint.v1"


def _serializer(salt: str) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().session_secret, salt=salt)


@dataclass(frozen=True)
class SessionPayload:
    user_id: uuid.UUID
    session_version: int


@dataclass(frozen=True)
class MagicLinkClaim:
    email: str
    jti: uuid.UUID


def fingerprint(value: str) -> str:
    """A keyed, non-reversible stand-in for an email address or an IP.

    Keyed with `SESSION_SECRET` rather than a bare hash, because the space of
    IPv4 addresses (and of plausible email addresses) is small enough to
    enumerate against an unkeyed digest.
    """
    key = hmac.new(get_settings().session_secret.encode(), _FINGERPRINT_KEY, hashlib.sha256)
    return hmac.new(key.digest(), value.encode(), hashlib.sha256).hexdigest()


def issue_session(response: Response, user_id: uuid.UUID, session_version: int) -> None:
    s = get_settings()
    token = _serializer(_SESSION_SALT).dumps({"uid": str(user_id), "sv": session_version})
    response.set_cookie(
        key=s.session_cookie_name,
        value=token,
        max_age=s.session_ttl_seconds,
        httponly=True,
        secure=s.environment == "prod",
        samesite="lax",
        path="/",
    )


def clear_session(response: Response) -> None:
    s = get_settings()
    response.delete_cookie(s.session_cookie_name, path="/")


def read_session(request: Request) -> SessionPayload | None:
    s = get_settings()
    token = request.cookies.get(s.session_cookie_name)
    if not token:
        return None
    try:
        data = _serializer(_SESSION_SALT).loads(token, max_age=s.session_ttl_seconds)
    except SignatureExpired:
        return None
    except BadSignature:
        return None
    try:
        # A cookie minted before `sv` existed reads as version 0, which is the
        # column's default — so deploying revocation signed nobody out.
        version = data.get("sv", 0)
        if not isinstance(version, int):
            return None
        return SessionPayload(user_id=uuid.UUID(data["uid"]), session_version=version)
    except (AttributeError, KeyError, ValueError, TypeError):
        return None


def issue_magic_link_token(email: str, jti: uuid.UUID) -> str:
    """Sign a link for `email`. `jti` must name a `MagicLinkToken` row."""
    return _serializer(_MAGIC_LINK_SALT).dumps({"email": email.lower(), "jti": str(jti)})


def verify_magic_link_token(token: str) -> MagicLinkClaim | None:
    """Check signature and age only. Whether it was already spent is the caller's
    question, answered by the `MagicLinkToken` row."""
    s = get_settings()
    try:
        data = _serializer(_MAGIC_LINK_SALT).loads(token, max_age=s.magic_link_ttl_seconds)
    except SignatureExpired:
        return None
    except BadSignature:
        return None
    if not isinstance(data, dict):
        return None
    email, jti = data.get("email"), data.get("jti")
    if not isinstance(email, str) or not isinstance(jti, str):
        return None
    try:
        return MagicLinkClaim(email=email, jti=uuid.UUID(jti))
    except ValueError:
        return None
