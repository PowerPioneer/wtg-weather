"""Authentication: magic link (primary) + Google OAuth.

Security notes:
- Magic-link tokens are itsdangerous URLSafeTimedSerializer with a 15-minute TTL,
  and **single use**: each names a `MagicLinkToken` row that verifying spends.
- Issuing one is throttled per address and per client IP (see `config.py`),
  because each request sends mail to an address the caller chose.
- Session cookies are HttpOnly, Secure (in non-dev), SameSite=Lax, 30-day sliding,
  and revocable all at once through `users.session_version` (`/logout-all`).
- Google sign-in links to an existing account by email only when Google says
  that email is verified.
- We never log raw email addresses; `email.py::redact_email` hashes the local-part.
"""

from __future__ import annotations

import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import ColumnElement, delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.config import get_settings
from wtg_api.deps import current_user, db_session
from wtg_api.models import MagicLinkToken, User
from wtg_api.schemas import MagicLinkRequest, MagicLinkResponse
from wtg_api.services.email import EmailMessage, build_provider, redact_email
from wtg_api.services.sessions import (
    clear_session,
    fingerprint,
    issue_magic_link_token,
    issue_session,
    verify_magic_link_token,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

#: How long a `MagicLinkToken` row is kept. It only has to outlive the longest
#: throttle window it is counted in.
_TOKEN_ROW_RETENTION = timedelta(days=1)


def _client_ip(request: Request) -> str | None:
    """The browser's address as Caddy saw it.

    The API publishes no port (`docker-compose.yml`), so every public request
    arrives through Caddy, which — with no `trusted_proxies` configured —
    discards any `X-Forwarded-For` the client sent and writes the real peer
    address. The right-most entry is the one Caddy wrote, whatever precedes it.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        last = forwarded.split(",")[-1].strip()
        if last:
            return last
    return request.client.host if request.client else None


async def _user_by_email(session: AsyncSession, email: str) -> User | None:
    return (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()


async def _issued_since(
    session: AsyncSession, which: ColumnElement[bool], since: datetime
) -> int:
    stmt = (
        select(func.count())
        .select_from(MagicLinkToken)
        .where(which, MagicLinkToken.created_at > since)
    )
    return (await session.execute(stmt)).scalar_one()


def _throttled(retry_after_seconds: int) -> HTTPException:
    # The same answer whichever limit tripped, and whether or not the address
    # has an account: a 429 must say nothing about who exists.
    return HTTPException(
        status.HTTP_429_TOO_MANY_REQUESTS,
        "too many sign-in links requested; try again later",
        headers={"Retry-After": str(retry_after_seconds)},
    )


@router.post("/magic-link", response_model=MagicLinkResponse)
async def magic_link(
    payload: MagicLinkRequest,
    request: Request,
    session: AsyncSession = Depends(db_session),
) -> MagicLinkResponse:
    s = get_settings()
    email = payload.email.lower()
    now = datetime.now(timezone.utc)
    email_hash = fingerprint(email)
    ip = _client_ip(request)
    ip_hash = fingerprint(ip) if ip else None

    await session.execute(
        delete(MagicLinkToken).where(MagicLinkToken.created_at < now - _TOKEN_ROW_RETENTION)
    )

    email_window = s.magic_link_ttl_seconds
    if (
        await _issued_since(
            session,
            MagicLinkToken.email_hash == email_hash,
            now - timedelta(seconds=email_window),
        )
        >= s.magic_link_max_per_email
    ):
        await session.commit()
        logger.warning("auth.magic_link.throttled scope=email to=%s", redact_email(email))
        raise _throttled(email_window)

    ip_window = s.magic_link_ip_window_seconds
    if ip_hash is not None and (
        await _issued_since(
            session, MagicLinkToken.ip_hash == ip_hash, now - timedelta(seconds=ip_window)
        )
        >= s.magic_link_max_per_ip
    ):
        await session.commit()
        logger.warning("auth.magic_link.throttled scope=ip ip=%s", ip_hash[:12])
        raise _throttled(ip_window)

    jti = uuid.uuid4()
    session.add(MagicLinkToken(id=jti, email_hash=email_hash, ip_hash=ip_hash, created_at=now))
    await session.commit()

    token = issue_magic_link_token(email, jti)
    origin = s.public_web_origin
    verify_url = f"{origin}/login/verify?{urlencode({'token': token})}"

    provider = build_provider()
    await provider.send(
        EmailMessage(
            to=email,
            subject="Your sign-in link",
            text=(
                "Click the link below to sign in to Where to Go for Great Weather.\n\n"
                f"{verify_url}\n\nThis link expires in 15 minutes."
            ),
        )
    )
    return MagicLinkResponse(sent=True)


@router.get("/verify")
async def magic_link_verify(
    token: str = Query(..., min_length=10),
    session: AsyncSession = Depends(db_session),
) -> Response:
    claim = verify_magic_link_token(token)
    if claim is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid or expired token")

    # Spend the link. A conditional UPDATE rather than read-then-write, so two
    # requests racing with one link cannot both find it unspent. Invalid,
    # expired and already-used all answer the same 400, so the response does
    # not tell the holder of a stolen link which of the three it was.
    spent = await session.execute(
        update(MagicLinkToken)
        .where(
            MagicLinkToken.id == claim.jti,
            MagicLinkToken.email_hash == fingerprint(claim.email),
            MagicLinkToken.used_at.is_(None),
        )
        .values(used_at=datetime.now(timezone.utc))
    )
    if spent.rowcount != 1:
        await session.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid or expired token")

    email = claim.email
    user = await _user_by_email(session, email)
    if user is None:
        # Two links for one new address, opened together, both get here; the
        # second insert hits the unique email. A savepoint keeps the link just
        # spent above, and the account the other request made is the one.
        try:
            async with session.begin_nested():
                user = User(email=email)
                session.add(user)
        except IntegrityError:
            user = await _user_by_email(session, email)
            if user is None:  # pragma: no cover — the conflict was this row
                raise
    await session.commit()
    await session.refresh(user)

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    issue_session(response, user.id, user.session_version)
    return response


@router.post("/logout")
async def logout() -> Response:
    """Sign out of this browser. A copy of its cookie anywhere else stays valid
    until `/logout-all` or the end of its 30 days."""
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_session(response)
    return response


@router.post("/logout-all")
async def logout_all(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Response:
    """Sign out everywhere: every session cookie issued to this user so far —
    other browsers, a lost phone, a copied cookie — is refused from now on."""
    user.session_version += 1
    await session.commit()
    logger.info("auth.logout_all user=%s", user.id)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_session(response)
    return response


# --- Google OAuth ---

_GOOGLE_AUTHZ = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo"


@router.get("/google")
async def google_authorize(response: Response) -> Response:
    s = get_settings()
    if not s.google_client_id:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "google oauth not configured")
    state = secrets.token_urlsafe(24)
    response = Response(status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    response.set_cookie(
        "wtg_oauth_state",
        state,
        max_age=600,
        httponly=True,
        secure=s.environment == "prod",
        samesite="lax",
        path="/api/auth",
    )
    params = {
        "client_id": s.google_client_id,
        "redirect_uri": s.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
    }
    response.headers["Location"] = f"{_GOOGLE_AUTHZ}?{urlencode(params)}"
    return response


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    session: AsyncSession = Depends(db_session),
) -> Response:
    s = get_settings()
    cookie_state = request.cookies.get("wtg_oauth_state")
    if not cookie_state or not secrets.compare_digest(cookie_state, state):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid oauth state")

    async with httpx.AsyncClient(timeout=10.0) as client:
        token_resp = await client.post(
            _GOOGLE_TOKEN,
            data={
                "code": code,
                "client_id": s.google_client_id,
                "client_secret": s.google_client_secret,
                "redirect_uri": s.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "google token exchange failed")
        access_token = token_resp.json().get("access_token")
        if not access_token:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "no access token from google")

        info_resp = await client.get(
            _GOOGLE_USERINFO,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if info_resp.status_code != 200:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "google userinfo failed")
        info = info_resp.json()

    google_sub = info.get("sub")
    email = (info.get("email") or "").lower()
    if not google_sub or not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "google userinfo missing fields")
    # This address is matched against existing accounts below, so it has to be
    # one Google has seen its holder prove. A Google account can carry an
    # address its owner never verified; trusting that would hand them whichever
    # account of ours already uses it. `is not True` rather than falsiness: the
    # claim must be present and boolean true.
    if info.get("email_verified") is not True:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "google account email is not verified")

    user = (
        await session.execute(select(User).where(User.google_sub == google_sub))
    ).scalar_one_or_none()
    if user is None:
        user = await _user_by_email(session, email)
        # Found by address, but already linked to a *different* Google account:
        # refuse rather than re-point it. Overwriting would silently unlink the
        # account's owner from their own Google sign-in, and hand the account
        # to whichever Google identity last presented this address (Workspace
        # admins can reassign one).
        if user is not None and user.google_sub not in (None, google_sub):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "this account is linked to a different Google account",
            )
    if user is None:
        user = User(email=email, name=info.get("name"), google_sub=google_sub)
        session.add(user)
    else:
        user.google_sub = google_sub
        if info.get("name") and not user.name:
            user.name = info["name"]
    await session.commit()
    await session.refresh(user)

    response = Response(status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    response.headers["Location"] = s.public_web_origin
    response.delete_cookie("wtg_oauth_state", path="/api/auth")
    issue_session(response, user.id, user.session_version)
    return response
