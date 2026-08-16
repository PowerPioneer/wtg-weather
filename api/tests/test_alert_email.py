"""The rendered-template contract between `web/src/emails` and this service.

The load-bearing test here is `test_matches_the_react_render_byte_for_byte`.
Everything else in the alert path can be checked in one language; this cannot —
the design is authored in TSX, rendered by Node, and filled in by Python, and
the only way to know the two agree about escaping is to render the same values
through both and compare the bytes. The React half is committed under
`tests/fixtures/emails/` by `pnpm -C web email:render`.

That fixture is also the client preview the WS-D acceptance criterion asks for:
open `alert-matched.preview.html` in a browser or paste it into a mail client.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from wtg_api.config import get_settings
from wtg_api.services import alert_email
from wtg_api.services.alert_email import (
    MATCHED,
    STOPPED,
    TemplateUnavailable,
    build_message,
    load_template,
    render,
)

FIXTURES = Path(__file__).parent / "fixtures" / "emails"

# `ALERT_PREVIEW_VALUES` in `web/src/emails/render.tsx`. Mirrored rather than
# imported for the obvious reason; the byte comparison below is what keeps the
# mirror honest.
PREVIEW_VALUES = {
    "place": "Peru",
    "month": "April",
    "score": "90",
    "previous_score": "60",
    "place_url": "https://wheretogoforgreatweather.com/peru/april",
    "manage_url": "https://wheretogoforgreatweather.com/account?s=alerts",
    "unsubscribe_url": (
        "https://wheretogoforgreatweather.com/api/alerts/unsubscribe"
        "?token=Im5vdC1hLXJlYWwtdG9rZW4i.aBcDeF.9x0Q_sample-signature"
    ),
}


def _fixture(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


@pytest.mark.parametrize("name", [MATCHED, STOPPED])
def test_matches_the_react_render_byte_for_byte(name: str) -> None:
    """Python's substitution must produce exactly what react-email produced.

    Any divergence is an escaping bug, and escaping bugs in email show up as
    `&amp;amp;` in somebody's subject line rather than as a failing test.
    """
    filled = render(name, PREVIEW_VALUES)
    assert filled.html == _fixture(f"{name}.preview.html")
    assert filled.text == _fixture(f"{name}.preview.txt")


@pytest.mark.parametrize("name", [MATCHED, STOPPED])
def test_no_placeholder_survives_a_render(name: str) -> None:
    filled = render(name, PREVIEW_VALUES)
    for part in (filled.subject, filled.html, filled.text):
        assert not re.search(r"\{\{[a-z_]+\}\}", part)


def test_a_missing_value_is_a_failed_send_not_a_visible_placeholder() -> None:
    values = dict(PREVIEW_VALUES)
    del values["score"]
    with pytest.raises(KeyError):
        render(MATCHED, values)


def test_html_values_are_escaped_but_text_values_are_not() -> None:
    values = dict(PREVIEW_VALUES) | {"place": 'Sint & "Maarten" <b>'}
    filled = render(MATCHED, values)
    # Escaped in markup — and the raw form must not appear anywhere, or a place
    # name is an injection point into every recipient's mail client.
    assert "Sint &amp; &quot;Maarten&quot; &lt;b&gt;" in filled.html
    assert 'Sint & "Maarten" <b>' not in filled.html
    # Not escaped in the plain-text part, which is not markup.
    assert 'Sint & "Maarten" <b>' in filled.text
    # The subject is a header, not markup — escaping it would ship entities.
    assert 'Sint & "Maarten" <b>' in filled.subject


def test_subjects_come_from_the_manifest() -> None:
    assert "now matches" in load_template(MATCHED).subject
    assert "no longer matches" in load_template(STOPPED).subject


def test_missing_artifact_is_loud(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(alert_email, "TEMPLATE_DIR", tmp_path)
    load_template.cache_clear()
    with pytest.raises(TemplateUnavailable):
        load_template(MATCHED)
    load_template.cache_clear()


# ─── the assembled message ───────────────────────────────────────────────


def _message(**overrides):
    kwargs = {
        "to": "traveller@example.com",
        "now_matches": True,
        "place": "Peru",
        "month": "April",
        "score": 90,
        "previous_score": 60,
        "place_path": "/peru/april",
        "unsubscribe_url": "https://example.test/api/alerts/unsubscribe?token=t",
    }
    kwargs.update(overrides)
    return build_message(**kwargs)


def test_message_carries_one_click_unsubscribe_headers() -> None:
    message = _message()
    assert message.headers["List-Unsubscribe"] == (
        "<https://example.test/api/alerts/unsubscribe?token=t>"
    )
    assert message.headers["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"


def test_the_header_url_and_the_footer_link_are_the_same_url() -> None:
    """One code path, so a broken unsubscribe is broken visibly."""
    message = _message()
    header = message.headers["List-Unsubscribe"].strip("<>")
    assert header in message.html
    assert header in message.text


def test_links_are_built_from_the_configured_web_origin(monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "public_web_origin", "https://v2.example.test/")
    message = _message(place_path="/peru/april")
    assert "https://v2.example.test/peru/april" in message.html
    assert "https://v2.example.test/account?s=alerts" in message.html


def test_stopped_matching_uses_the_other_template() -> None:
    assert "no longer matches" in _message(now_matches=False).subject
    assert "now matches" in _message(now_matches=True).subject


def test_an_alert_with_no_previous_score_prints_a_dash_not_a_zero() -> None:
    """0 is not a score the scorer can produce; printing it would be a claim."""
    message = _message(previous_score=None)
    assert "Previous run: —/100" in message.text


def test_both_a_text_and_an_html_part_are_produced() -> None:
    message = _message()
    assert message.html and message.html.startswith("<!DOCTYPE html")
    assert message.text and "<" not in message.text.split("\n")[0]
