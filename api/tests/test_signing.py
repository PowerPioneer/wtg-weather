from __future__ import annotations

import time

from wtg_api.services.signing import sign_path, verify


def test_sign_and_verify_roundtrip() -> None:
    signed = sign_path("/premium.pmtiles", "secret", 900)
    path, query = signed.url.split("?", 1)
    params = dict(pair.split("=", 1) for pair in query.split("&"))
    assert path == "/premium.pmtiles"
    assert verify(path, params["exp"], params["sig"], "secret") is True


def test_verify_rejects_forged_signature() -> None:
    signed = sign_path("/premium.pmtiles", "secret", 900)
    _, query = signed.url.split("?", 1)
    params = dict(pair.split("=", 1) for pair in query.split("&"))
    # Flip a character in the signature
    bad_sig = params["sig"][:-1] + ("0" if params["sig"][-1] != "0" else "1")
    assert verify("/premium.pmtiles", params["exp"], bad_sig, "secret") is False


def test_verify_rejects_wrong_path() -> None:
    signed = sign_path("/premium.pmtiles", "secret", 900)
    _, query = signed.url.split("?", 1)
    params = dict(pair.split("=", 1) for pair in query.split("&"))
    assert verify("/free.pmtiles", params["exp"], params["sig"], "secret") is False


def test_verify_rejects_wrong_secret() -> None:
    signed = sign_path("/premium.pmtiles", "secret", 900)
    _, query = signed.url.split("?", 1)
    params = dict(pair.split("=", 1) for pair in query.split("&"))
    assert verify("/premium.pmtiles", params["exp"], params["sig"], "other") is False


def test_verify_rejects_expired() -> None:
    now = int(time.time())
    # Sign "now" with a TTL of 1s, then verify 2 seconds later.
    signed = sign_path("/premium.pmtiles", "secret", 1, now=now)
    _, query = signed.url.split("?", 1)
    params = dict(pair.split("=", 1) for pair in query.split("&"))
    assert verify("/premium.pmtiles", params["exp"], params["sig"], "secret", now=now + 2) is False


def test_verify_rejects_missing_params() -> None:
    assert verify("/p", None, "sig", "secret") is False
    assert verify("/p", "123", None, "secret") is False
    assert verify("/p", "not-a-number", "sig", "secret") is False
