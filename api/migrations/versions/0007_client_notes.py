"""client notes

Additive: a new table only, per the expand-then-deploy rule in
`infra/CLAUDE.md`. `clients.notes` — the single free-text field on the profile —
is untouched and keeps its meaning; this table is the dated, attributed
timeline the client page shows alongside it.

Revision ID: 0007_client_notes
Revises: 0006_invitations
Create Date: 2026-08-16 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_client_notes"
down_revision: Union[str, None] = "0006_invitations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "client_notes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("author_user_id", sa.Uuid(), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        # SET NULL, not CASCADE: an agent leaving the agency must not take the
        # handover notes they wrote with them.
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_client_notes_client_id", "client_notes", ["client_id"])


def downgrade() -> None:
    op.drop_index("ix_client_notes_client_id", table_name="client_notes")
    op.drop_table("client_notes")
