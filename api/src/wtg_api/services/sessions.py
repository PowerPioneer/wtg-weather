"""Session cookie helpers.

Sessions are itsdangerous URLSafeTimedSerializer payloads holding the user id.
They are set as HttpOnly, Secure, SameSite=Lax cookies. Expiry is enforced by
`max_age` on verification (30-day sliding).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import Request, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from wtg_api.config import get_settings

_SESSION_SALT = "wtg.session.v1"
_MAGIC_LINK_SALT = "wtg.magic-link.v1"


def _serializer(salt: str) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().session_secret, salt=salt)


@dataclass(frozen=True)
class SessionPayload:
    user_id: uuid.UUID


def issue_session(response: Response, user_id: uuid.UUID) -> None:
    s = get_settings()
    token = _serializer(_SESSION_SALT).dumps({"uid": str(user_id)})
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
        return SessionPayload(user_id=uuid.UUID(data["uid"]))
    except (KeyError, ValueError, TypeError):
        return None


def issue_magic_link_token(email: str) -> str:
    return _serializer(_MAGIC_LINK_SALT).dumps({"email": email.lower()})


def verify_magic_link_token(token: str) -> str | None:
    s = get_settings()
    try:
        data = _serializer(_MAGIC_LINK_SALT).loads(token, max_age=s.magic_link_ttl_seconds)
    except SignatureExpired:
        return None
    except BadSignature:
        return None
    email = data.get("email") if isinstance(data, dict) else None
    return email if isinstance(email, str) else None
