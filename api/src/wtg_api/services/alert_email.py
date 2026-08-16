"""Turn one alert transition into a sendable message.

The design is Atlas and it lives in `web/src/emails/alert.tsx`, because that is
where the rest of the design system lives and react-email is what produces
table-based HTML that survives Outlook. The API image is `python:3.12-slim`
with no Node in it, so the template cannot be rendered here at send time.

So it is rendered *there*, once, by `pnpm -C web email:render`, into
`templates/emails/` next to this module with `{{placeholder}}` sentinels where
the per-recipient values go. This module substitutes them. The arrangement is
the one `magic-link.tsx` already described in its header; WS-D is where it got
a script and a guard behind it.

Two guards, because a generated artifact that nobody regenerates is the usual
way this goes wrong:

* `web/src/emails/templates.sync.test.tsx` fails `pnpm test` if the committed
  artifact drifts from the source;
* :func:`render` refuses to return a body with a `{{placeholder}}` left in it,
  so a template that grows a new field and a sender that does not know about it
  is a failed send rather than a customer reading `{{score}}`.

Substitution, not a template engine: the values are escaped for the HTML part
with `html.escape`, which matches React's own escaping rule character for
character (`& < > " '`, the last as `&#x27;`). `test_alert_email.py` pins that
by rendering the same values through both and comparing bytes.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from functools import lru_cache
from html import escape
from pathlib import Path

from wtg_api.config import get_settings
from wtg_api.services.email import EmailMessage

logger = logging.getLogger(__name__)

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "emails"

MATCHED = "alert-matched"
STOPPED = "alert-stopped"

_PLACEHOLDER = re.compile(r"\{\{([a-z_]+)\}\}")


class TemplateUnavailable(RuntimeError):
    """The rendered artifact is missing from the image.

    Loud rather than silently falling back to a plain-text body: a deploy that
    lost the templates should be obvious on the first run, not discovered as a
    month of unbranded email.
    """


@dataclass(frozen=True)
class AlertTemplate:
    subject: str
    html: str
    text: str


@lru_cache(maxsize=4)
def load_template(name: str) -> AlertTemplate:
    """One artifact off disk, memoised for the life of the process.

    Unlike the country bundle these do not change under a running container —
    they ship inside the image — so there is no mtime check here.
    """
    html_path = TEMPLATE_DIR / f"{name}.html"
    text_path = TEMPLATE_DIR / f"{name}.txt"
    manifest_path = TEMPLATE_DIR / "manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        return AlertTemplate(
            subject=str(manifest[name]["subject"]),
            html=html_path.read_text(encoding="utf-8"),
            text=text_path.read_text(encoding="utf-8"),
        )
    except (OSError, KeyError, ValueError, TypeError) as exc:
        raise TemplateUnavailable(
            f"no rendered email template {name!r} under {TEMPLATE_DIR}. "
            f"Run `pnpm -C web email:render` and commit the result."
        ) from exc


def _substitute(template: str, values: dict[str, str], *, as_html: bool) -> str:
    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in values:
            raise KeyError(key)
        value = values[key]
        return escape(value, quote=True) if as_html else value

    out = _PLACEHOLDER.sub(replace, template)
    leftover = _PLACEHOLDER.search(out)
    if leftover is not None:  # pragma: no cover — `replace` raises first
        raise KeyError(leftover.group(1))
    return out


def render(name: str, values: dict[str, str]) -> AlertTemplate:
    """Fill one template. Raises ``KeyError`` on a placeholder with no value."""
    template = load_template(name)
    return AlertTemplate(
        subject=_substitute(template.subject, values, as_html=False),
        html=_substitute(template.html, values, as_html=True),
        text=_substitute(template.text, values, as_html=False),
    )


def build_message(
    *,
    to: str,
    now_matches: bool,
    place: str,
    month: str,
    score: int,
    previous_score: int | None,
    place_path: str,
    unsubscribe_url: str,
) -> EmailMessage:
    """The whole message, headers included.

    `List-Unsubscribe` and `List-Unsubscribe-Post` are not decoration: Gmail
    and Yahoo require one-click list management from bulk senders, and a footer
    link does not satisfy it. The URL is the same one the footer carries, which
    is deliberate — one code path, so a broken unsubscribe is broken in a way
    somebody notices.
    """
    settings = get_settings()
    web = settings.public_web_origin.rstrip("/")
    filled = render(
        MATCHED if now_matches else STOPPED,
        {
            "place": place,
            "month": month,
            "score": str(score),
            # An alert that has never been scored has no previous run to print.
            # "—" rather than "0", which would read as a measurement.
            "previous_score": "—" if previous_score is None else str(previous_score),
            "place_url": f"{web}{place_path}",
            "manage_url": f"{web}/account?s=alerts",
            "unsubscribe_url": unsubscribe_url,
        },
    )
    return EmailMessage(
        to=to,
        subject=filled.subject,
        text=filled.text,
        html=filled.html,
        headers={
            "List-Unsubscribe": f"<{unsubscribe_url}>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
    )
