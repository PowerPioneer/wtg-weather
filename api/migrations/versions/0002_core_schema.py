"""core schema: users, organizations, memberships, clients, trips, favourites, alerts, paddle_webhook_events

Revision ID: 0002_core_schema
Revises: 0001_initial
Create Date: 2026-04-22 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_core_schema"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PLAN_VALUES = (
    "free",
    "consumer_premium",
    "agency_starter",
    "agency_pro",
    "agency_enterprise",
)
ROLE_VALUES = ("owner", "admin", "agent", "member")


def upgrade() -> None:
    plan_values_sql = ", ".join(f"'{v}'" for v in PLAN_VALUES)
    role_values_sql = ", ".join(f"'{v}'" for v in ROLE_VALUES)
    op.execute(
        f"DO $$ BEGIN CREATE TYPE plan AS ENUM ({plan_values_sql}); "
        f"EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
    )
    op.execute(
        f"DO $$ BEGIN CREATE TYPE role AS ENUM ({role_values_sql}); "
        f"EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
    )
    plan_enum = postgresql.ENUM(*PLAN_VALUES, name="plan", create_type=False)
    role_enum = postgresql.ENUM(*ROLE_VALUES, name="role", create_type=False)

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=True),
        sa.Column("google_sub", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_google_sub", "users", ["google_sub"], unique=True)

    op.create_table(
        "organizations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("plan", plan_enum, nullable=False, server_default="free"),
        sa.Column("seat_cap", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("paddle_customer_id", sa.String(length=255), nullable=True),
        sa.Column("paddle_subscription_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_organizations_paddle_subscription_id",
        "organizations",
        ["paddle_subscription_id"],
        unique=True,
    )

    op.create_table(
        "memberships",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", role_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "organization_id", name="uq_membership_user_org"),
    )
    op.create_index("ix_memberships_user_id", "memberships", ["user_id"])
    op.create_index("ix_memberships_organization_id", "memberships", ["organization_id"])

    op.create_table(
        "clients",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_clients_organization_id", "clients", ["organization_id"])

    op.create_table(
        "trips",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "owner_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "client_id",
            sa.Uuid(),
            sa.ForeignKey("clients.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("country_iso2", sa.String(length=2), nullable=True),
        sa.Column("region_code", sa.String(length=20), nullable=True),
        sa.Column("month", sa.Integer(), nullable=True),
        sa.Column(
            "preferences",
            sa.JSON().with_variant(
                sa.dialects.postgresql.JSONB(), "postgresql"
            ),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_trips_owner_id", "trips", ["owner_id"])
    op.create_index("ix_trips_client_id", "trips", ["client_id"])

    op.create_table(
        "favourites",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("country_iso2", sa.String(length=2), nullable=False),
        sa.Column("region_code", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "user_id",
            "country_iso2",
            "region_code",
            name="uq_favourite_user_country_region",
        ),
    )
    op.create_index("ix_favourites_user_id", "favourites", ["user_id"])

    op.create_table(
        "alerts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("country_iso2", sa.String(length=2), nullable=True),
        sa.Column("region_code", sa.String(length=20), nullable=True),
        sa.Column("month", sa.Integer(), nullable=True),
        sa.Column(
            "preferences",
            sa.JSON().with_variant(
                sa.dialects.postgresql.JSONB(), "postgresql"
            ),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_matched", sa.Boolean(), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_alerts_user_id", "alerts", ["user_id"])

    op.create_table(
        "paddle_webhook_events",
        sa.Column("event_id", sa.String(length=255), primary_key=True),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("paddle_webhook_events")
    op.drop_index("ix_alerts_user_id", table_name="alerts")
    op.drop_table("alerts")
    op.drop_index("ix_favourites_user_id", table_name="favourites")
    op.drop_table("favourites")
    op.drop_index("ix_trips_client_id", table_name="trips")
    op.drop_index("ix_trips_owner_id", table_name="trips")
    op.drop_table("trips")
    op.drop_index("ix_clients_organization_id", table_name="clients")
    op.drop_table("clients")
    op.drop_index("ix_memberships_organization_id", table_name="memberships")
    op.drop_index("ix_memberships_user_id", table_name="memberships")
    op.drop_table("memberships")
    op.drop_index(
        "ix_organizations_paddle_subscription_id", table_name="organizations"
    )
    op.drop_table("organizations")
    op.drop_index("ix_users_google_sub", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    sa.Enum(name="role").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="plan").drop(op.get_bind(), checkfirst=True)
