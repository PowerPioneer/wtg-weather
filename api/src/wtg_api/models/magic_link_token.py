from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from wtg_api.db import Base


class MagicLinkToken(Base):
    """One issued sign-in link, so that it can be spent once and counted.

    The link itself is still a signed itsdangerous token — the signature and its
    `max_age` decide whether it is *genuine and fresh*. This row decides the two
    things a signature cannot:

    - **single use.** `id` is the token's `jti`; verifying sets `used_at`, and a
      second verify of the same link finds it already set. Without it a link
      forwarded, left in a shared mailbox or lifted from a log signed its
      holder in as often as they liked for fifteen minutes.
    - **rate.** `POST /api/auth/magic-link` counts recent rows per address and
      per client before it sends anything, because each request is an email
      from our domain to an address the caller chose.

    Neither question needs the address or the IP in the clear, so neither is
    stored: both are keyed HMACs (`services.sessions.fingerprint`). A request
    for a stranger's address therefore leaves no readable trace of that address
    here, and the table holds no PII the `users` table does not already hold.
    Rows are useless after a day and the issuing endpoint prunes them.
    """

    __tablename__ = "magic_link_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
