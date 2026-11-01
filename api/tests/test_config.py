from __future__ import annotations

import pytest
from pydantic import ValidationError

from wtg_api.config import Settings

_STRONG = "x" * 32
_SECRETS = ("session_secret", "tile_signing_secret", "paddle_webhook_secret")


def _prod(**overrides: str) -> Settings:
    values = {name: _STRONG for name in _SECRETS}
    values.update(overrides)
    return Settings(environment="prod", email_provider="console", **values)


def test_prod_boots_with_strong_secrets() -> None:
    assert _prod().session_secret == _STRONG


@pytest.mark.parametrize("name", _SECRETS)
@pytest.mark.parametrize(
    "value",
    ["", "short-but-not-empty", "__default__"],
    ids=["empty", "short", "dev-default"],
)
def test_prod_refuses_a_weak_secret(name: str, value: str) -> None:
    if value == "__default__":
        value = Settings.model_fields[name].default
    with pytest.raises(ValidationError, match=name.upper()):
        _prod(**{name: value})


def test_refusal_never_prints_the_value() -> None:
    leaked = "leaked-but-too-short"
    with pytest.raises(ValidationError) as excinfo:
        _prod(session_secret=leaked)
    assert leaked not in str(excinfo.value)
    # Nor anything else it was given: the boot traceback lands in the log.
    assert "input_value" not in str(excinfo.value)


@pytest.mark.parametrize("environment", ["dev", "test"])
def test_dev_and_test_keep_their_defaults(environment: str) -> None:
    s = Settings(environment=environment, email_provider="console", session_secret="")
    assert s.session_secret == ""
