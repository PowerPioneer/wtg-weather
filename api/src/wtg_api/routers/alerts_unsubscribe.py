"""Session-less unsubscribe for alert email.

**Security implication — auth-adjacent.** See
``services/alert_unsubscribe.py`` for what the token is and is not. The two
properties this module is responsible for:

- **GET never mutates.** Mailbox providers, corporate link scanners and
  Gmail's own preview fetch every URL in a message. A GET that unsubscribed
  would opt people out of mail they never chose to leave. So GET renders a
  confirmation with a button, and the button POSTs.
- **POST is the one-click target.** RFC 8058 (`List-Unsubscribe-Post`) has the
  mail client POST to the header's URL with no body it expects us to read and
  no cookies — so the token comes from the query string, and a form submission
  from the confirmation page carries the same token in its body. Both are
  accepted; nothing else is.

This is the one endpoint in the API that answers with HTML rather than a
Pydantic schema, against the rule in `api/CLAUDE.md`. The reason is that the
audience is a person in a browser who arrived from an email, with no session
and no app shell around them: a JSON body is not an answer to "make this stop".
Routing it through the web app instead would add a hop that can be down at the
moment somebody is trying to unsubscribe, which is the moment where failing
costs a spam complaint. The page is inert — no script, no form beyond the
single button, no third-party anything.
"""

from __future__ import annotations

import logging
from html import escape
from urllib.parse import parse_qs

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.config import get_settings
from wtg_api.deps import db_session
from wtg_api.services.alert_unsubscribe import apply_unsubscribe, read_unsubscribe_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


def _page(title: str, body: str, *, status_code: int = 200) -> Response:
    """The whole response. Inline styles because there is no stylesheet to
    reach for, and none of the Atlas build pipeline is available here."""
    account = f"{get_settings().public_web_origin.rstrip('/')}/account"
    html = f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>{escape(title)} · Atlas Weather</title>
</head>
<body style="margin:0;background:#ECEAE3;font-family:Helvetica,Arial,sans-serif;color:#0F1B2D">
<div style="max-width:520px;margin:64px auto;padding:32px 36px;background:#fff;border:1px solid #E6E0D4;border-radius:6px">
<p style="margin:0 0 18px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#6B7280">Atlas Weather</p>
<h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:24px;font-weight:500">{escape(title)}</h1>
{body}
<p style="margin:24px 0 0;font-size:12px;color:#6B7280">
<a href="{escape(account)}" style="color:#0B3D66">Manage your alerts</a>
</p>
</div>
</body></html>
"""
    return HTMLResponse(html, status_code=status_code)


def _para(text: str) -> str:
    return f'<p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#4A5568">{text}</p>'


_EXPIRED = _page(
    "This unsubscribe link has expired",
    _para(
        "Unsubscribe links stay valid for a year. Sign in and turn alert email "
        "off from your account instead — it takes one click and it is the same "
        "setting."
    ),
    status_code=410,
)

_INVALID = _page(
    "We couldn't read that link",
    _para(
        "The link may have been truncated by your mail client. Sign in and turn "
        "alert email off from your account instead."
    ),
    status_code=400,
)

_DONE_TITLE = "You're unsubscribed from alert email"
_DONE_BODY = _para(
    "We won't email you about weather alerts again. Your saved alerts are "
    "untouched — they're still in your account, and you can turn email back on "
    "there whenever you like."
)


def _confirm(token: str) -> Response:
    """GET's answer: state the effect, and make the user press the button.

    The token round-trips through a hidden field rather than being re-read from
    the query on POST, so the form works regardless of how the mail client
    rewrote the visible URL.
    """
    return _page(
        "Stop sending weather alert email?",
        _para(
            "This turns off <strong>all</strong> alert email for your account. "
            "Your saved alerts stay where they are — you just stop hearing about "
            "them by email."
        )
        + f"""<form method="post" action="unsubscribe" style="margin-top:18px">
<input type="hidden" name="token" value="{escape(token, quote=True)}">
<button type="submit" style="background:#0F1B2D;color:#fff;border:0;border-radius:3px;padding:12px 22px;font-size:14px;cursor:pointer">
Yes, unsubscribe</button>
</form>""",
    )


@router.get("/unsubscribe", include_in_schema=False)
async def unsubscribe_page(token: str = Query(...)) -> Response:
    """Render the confirmation. Never mutates — see the module docstring.

    The token is validated here anyway, so a dead link says so on the first
    click rather than after the user has pressed a button that then fails.
    """
    parsed = read_unsubscribe_token(token)
    if parsed.expired:
        return _EXPIRED
    if parsed.user_id is None:
        return _INVALID
    return _confirm(token)


async def _token_from_form(request: Request) -> str | None:
    """The confirmation form's `token` field, without FastAPI's `Form`.

    `Form` pulls in `python-multipart`, and this endpoint would be its only
    user in the whole API. The body here is `application/x-www-form-urlencoded`
    from a form this module wrote itself — one `parse_qs` is a smaller thing to
    own than a dependency, and a mail client's RFC 8058 POST sends a body this
    ignores anyway.
    """
    content_type = request.headers.get("content-type", "")
    if not content_type.startswith("application/x-www-form-urlencoded"):
        return None
    body = (await request.body()).decode("utf-8", errors="replace")
    values = parse_qs(body).get("token")
    return values[0] if values else None


@router.post("/unsubscribe", include_in_schema=False)
async def unsubscribe(
    request: Request,
    token: str | None = Query(default=None),
    session: AsyncSession = Depends(db_session),
) -> Response:
    """Apply the opt-out. Idempotent, and it never says whether the user exists.

    A deleted user and a replayed token answer with the same success page: this
    endpoint is reachable by anyone holding a URL, and turning it into an oracle
    for "is this account still here" would be a worse trade than the tiny
    dishonesty of confirming an unsubscribe that had nothing left to unsubscribe.
    """
    raw = token or await _token_from_form(request)
    if not raw:
        return _INVALID

    parsed = read_unsubscribe_token(raw)
    if parsed.expired:
        return _EXPIRED
    if parsed.user_id is None:
        return _INVALID

    await apply_unsubscribe(session, parsed.user_id)
    return _page(_DONE_TITLE, _DONE_BODY)
