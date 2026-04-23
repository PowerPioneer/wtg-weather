"""onboarding state on users

Revision ID: 0003_onboarding_state
Revises: 0002_core_schema
Create Date: 2026-04-23 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_onboarding_state"
down_revision: Union[str, None] = "0002_core_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("onboarding_kind", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "onboarding_step",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "onboarding_completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "onboarding_data",
            sa.JSON().with_variant(sa.dialects.postgresql.JSONB(), "postgresql"),
            nullable=False,
            server_default="{}",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "onboarding_data")
    op.drop_column("users", "onboarding_completed")
    op.drop_column("users", "onboarding_step")
    op.drop_column("users", "onboarding_kind")
