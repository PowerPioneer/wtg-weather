from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from wtg_api.db import Base, TimestampMixin
from wtg_api.models.membership import Role

if TYPE_CHECKING:
    from wtg_api.models.organization import Organization


class Invitation(Base, TimestampMixin):
    """A pending offer of a seat in an organization.

    Security-relevant, because accepting one is an authentication event: the
    token is mailed to `email` and possession of it proves control of that
    mailbox, exactly as a magic link does. Three columns exist purely to make
    that safe:

    - `expires_at` — checked independently of the signed token's own `max_age`,
      so shortening the TTL in config takes effect on tokens already issued.
    - `accepted_at` — single use. The signature stays valid until it expires,
      so without a row to consult, a forwarded link would keep working after
      the seat was taken.
    - `revoked_at` — an owner who mis-typed an address needs the link dead
      before it is opened, and deleting the row would make a later accept
      indistinguishable from a forged id.

    None of the three is a `bool`: knowing *when* an invitation was taken or
    withdrawn is what makes a seat-count dispute answerable.
    """

    __tablename__ = "invitations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Lower-cased by the router before it lands here, so "A@x.com" and
    # "a@x.com" cannot hold two seats between them.
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    role: Mapped[Role] = mapped_column(Enum(Role, name="role"), nullable=False)
    invited_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    accepted_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    organization: Mapped[Organization] = relationship()

    @property
    def is_pending(self) -> bool:
        """Still spendable — the state the seat count reserves a seat for."""
        return self.accepted_at is None and self.revoked_at is None
