"""Session middleware: refreshes a valid session cookie on each request.

This gives us the 30-day sliding expiry described in `api/CLAUDE.md`. The
actual auth decisions are made per-route via the `current_user` dependency.
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from wtg_api.config import get_settings
from wtg_api.services.sessions import issue_session, read_session


class SlidingSessionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        if response.status_code >= 500:
            return response
        payload = read_session(request)
        if payload is None:
            return response
        # If the handler already wrote the session cookie (login/logout/verify),
        # do not stomp on it — let the explicit value stand.
        cookie_name = get_settings().session_cookie_name
        for header_name, header_value in response.raw_headers:
            if header_name.lower() == b"set-cookie" and header_value.lower().startswith(
                cookie_name.lower().encode() + b"="
            ):
                return response
        issue_session(response, payload.user_id)
        return response
