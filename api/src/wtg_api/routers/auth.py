"""Authentication: magic link (primary) + Google OAuth.

Security notes:
- Magic-link tokens are itsdangerous URLSafeTimedSerializer with a 15-minute TTL.
- Session cookies are HttpOnly, Secure (in non-dev), SameSite=Lax, 30-day sliding.
- We never log raw email addresses; `email.py::_redacted` hashes the local-part.
"""

from __future__ import annotations

import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.config import get_settings
from wtg_api.deps import db_session
from wtg_api.models import User
from wtg_api.schemas import MagicLinkRequest, MagicLinkResponse
from wtg_api.services.email import EmailMessage, build_provider
from wtg_api.services.sessions import (
    clear_session,
    issue_magic_link_token,
    issue_session,
    verify_magic_link_token,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/magic-link", response_model=MagicLinkResponse)
async def magic_link(
    payload: MagicLinkRequest,
    request: Request,
    session: AsyncSession = Depends(db_session),
) -> MagicLinkResponse:
    email = payload.email.lower()
    token = issue_magic_link_token(email)
    origin = get_settings().public_web_origin
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
    email = verify_magic_link_token(token)
    if email is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid or expired token")

    user = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user is None:
        user = User(email=email)
        session.add(user)
        await session.commit()
        await session.refresh(user)

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    issue_session(response, user.id)
    return response


@router.post("/logout")
async def logout() -> Response:
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

    user = (
        await session.execute(select(User).where(User.google_sub == google_sub))
    ).scalar_one_or_none()
    if user is None:
        user = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
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
    issue_session(response, user.id)
    return response
