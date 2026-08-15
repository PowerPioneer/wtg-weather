"""share token on trips

A trip is private until its owner shares it. The token is a separate secret
from the trip id so that a leaked link can be rotated without destroying the
trip, and so that knowing an id grants nothing.

Revision ID: 0004_trip_share_token
Revises: 0003_onboarding_state
Create Date: 2026-08-15 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_trip_share_token"
down_revision: Union[str, None] = "0003_onboarding_state"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("trips", sa.Column("share_token", sa.String(length=64), nullable=True))
    # Unique because the token is the lookup key for the public view, and
    # indexed because that lookup is the only way in for an anonymous viewer.
    op.create_index(
        "ix_trips_share_token", "trips", ["share_token"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_trips_share_token", table_name="trips")
    op.drop_column("trips", "share_token")
