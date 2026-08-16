from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from wtg_api.db import Base, TimestampMixin

if TYPE_CHECKING:
    from wtg_api.models.client import Client


class ClientNote(Base, TimestampMixin):
    """One dated entry on a client record, written by a member of the org.

    Separate from `Client.notes` (a single free-text field on the profile)
    because the client page shows a timeline: who said what, when. A blob
    cannot answer "who", and the design's notes rail is attributed.

    `author_user_id` is nullable and `SET NULL`: an agent who leaves the agency
    is removed from the org, and their notes have to survive that — losing the
    handover note when the person handing over leaves is the exact failure the
    feature exists to prevent.
    """

    __tablename__ = "client_notes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)

    client: Mapped[Client] = relationship(back_populates="note_entries")
