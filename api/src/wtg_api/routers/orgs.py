"""Organizations, memberships, and agency clients.

Agency owners invite agents (which creates a pending user + membership) and
create clients that can be assigned to trips. Seat caps are enforced from the
org's plan.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.deps import current_user, db_session
from wtg_api.models import (
    DEFAULT_SEAT_CAP,
    Client,
    Membership,
    Organization,
    Plan,
    Role,
    User,
)
from wtg_api.schemas import (
    ClientCreate,
    ClientRead,
    MembershipInvite,
    MembershipRead,
    OrganizationCreate,
    OrganizationRead,
)

router = APIRouter(prefix="/api/orgs", tags=["orgs"])


async def _load_membership(
    session: AsyncSession, user: User, org_id: uuid.UUID
) -> Membership:
    m = (
        await session.execute(
            select(Membership).where(
                Membership.user_id == user.id, Membership.organization_id == org_id
            )
        )
    ).scalar_one_or_none()
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "organization not found")
    return m


def _require_owner_or_admin(m: Membership) -> None:
    if m.role not in (Role.owner, Role.admin):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "owner or admin required")


@router.post("", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
async def create_org(
    payload: OrganizationCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Organization:
    org = Organization(
        name=payload.name, plan=Plan.free, seat_cap=DEFAULT_SEAT_CAP[Plan.free]
    )
    session.add(org)
    await session.flush()
    session.add(Membership(user_id=user.id, organization_id=org.id, role=Role.owner))
    await session.commit()
    await session.refresh(org)
    return org


@router.get("/{org_id}", response_model=OrganizationRead)
async def get_org(
    org_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Organization:
    await _load_membership(session, user, org_id)
    org = await session.get(Organization, org_id)
    assert org is not None  # membership loaded above
    return org


@router.get("/{org_id}/memberships", response_model=list[MembershipRead])
async def list_memberships(
    org_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> list[Membership]:
    await _load_membership(session, user, org_id)
    result = await session.execute(
        select(Membership).where(Membership.organization_id == org_id)
    )
    return list(result.scalars().all())


@router.post(
    "/{org_id}/memberships",
    response_model=MembershipRead,
    status_code=status.HTTP_201_CREATED,
)
async def invite_member(
    org_id: uuid.UUID,
    payload: MembershipInvite,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Membership:
    mine = await _load_membership(session, user, org_id)
    _require_owner_or_admin(mine)

    org = await session.get(Organization, org_id)
    assert org is not None

    count = (
        await session.execute(
            select(func.count())
            .select_from(Membership)
            .where(Membership.organization_id == org_id)
        )
    ).scalar_one()
    if int(count) >= org.seat_cap:
        raise HTTPException(status.HTTP_409_CONFLICT, "seat cap reached")

    email = payload.email.lower()
    invitee = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if invitee is None:
        invitee = User(email=email)
        session.add(invitee)
        await session.flush()

    existing = (
        await session.execute(
            select(Membership).where(
                Membership.user_id == invitee.id,
                Membership.organization_id == org_id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "already a member")

    membership = Membership(
        user_id=invitee.id, organization_id=org_id, role=Role(payload.role)
    )
    session.add(membership)
    await session.commit()
    await session.refresh(membership)
    return membership


@router.delete(
    "/{org_id}/memberships/{membership_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_member(
    org_id: uuid.UUID,
    membership_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Response:
    mine = await _load_membership(session, user, org_id)
    _require_owner_or_admin(mine)
    target = await session.get(Membership, membership_id)
    if target is None or target.organization_id != org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "membership not found")
    if target.role == Role.owner:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot remove owner")
    await session.delete(target)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Clients ---


@router.get("/{org_id}/clients", response_model=list[ClientRead])
async def list_clients(
    org_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> list[Client]:
    await _load_membership(session, user, org_id)
    result = await session.execute(
        select(Client).where(Client.organization_id == org_id)
    )
    return list(result.scalars().all())


@router.post(
    "/{org_id}/clients", response_model=ClientRead, status_code=status.HTTP_201_CREATED
)
async def create_client(
    org_id: uuid.UUID,
    payload: ClientCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Client:
    await _load_membership(session, user, org_id)
    client = Client(
        organization_id=org_id,
        name=payload.name,
        email=payload.email,
        notes=payload.notes,
    )
    session.add(client)
    await session.commit()
    await session.refresh(client)
    return client


@router.delete("/{org_id}/clients/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    org_id: uuid.UUID,
    client_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Response:
    mine = await _load_membership(session, user, org_id)
    _require_owner_or_admin(mine)
    client = await session.get(Client, client_id)
    if client is None or client.organization_id != org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "client not found")
    await session.delete(client)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
