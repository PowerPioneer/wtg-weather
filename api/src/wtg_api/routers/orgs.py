"""Organizations, memberships, invitations, and agency clients.

Shape of the surface:

- An **organization** is created by whoever runs the agency wizard; they become
  its owner. It starts on `Plan.free` with a one-seat cap and moves only when a
  signature-verified Paddle webhook says so.
- A seat is offered as an **invitation**, never as a membership. Creating a
  membership directly would mean minting a user row for an address nobody has
  proved they control, and handing that address the org's plan — the invitation
  token exists precisely so the mailbox is the proof. `services.invites` holds
  the token rules; `routers/invites.py` holds the accept side.
- The **seat cap** is enforced against memberships *plus* open invitations. Ten
  invitations against three seats is the cap not existing.
- **Clients** are records an agency keeps about the people it plans for. They
  have no login (see the client page's "Managed record" note) and they are
  reachable only through their own organization: every read here goes through
  `_load_membership`, which 404s a caller who is not a member. A client id is
  not a capability.

Roles: owner and admin manage seats, plans and client deletion. An agent works
on clients and trips. `services.billing.billable_organization` is the other
half of that line — an agent sees the agency's clients, never its card.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.deps import current_user, db_session
from wtg_api.models import (
    DEFAULT_SEAT_CAP,
    Client,
    ClientNote,
    Invitation,
    Membership,
    Organization,
    Plan,
    Role,
    Trip,
    User,
)
from wtg_api.schemas import (
    ClientCreate,
    ClientNoteCreate,
    ClientNoteRead,
    ClientRead,
    ClientTripRead,
    ClientUpdate,
    InvitationRead,
    MemberRead,
    MembershipInvite,
    OrganizationCreate,
    OrganizationDetail,
    OrganizationRead,
)
from wtg_api.services.invites import (
    invite_expiry,
    issue_invite_token,
    seat_usage,
    send_invite_email,
)

router = APIRouter(prefix="/api/orgs", tags=["orgs"])

# Detail strings the web branches on. "At the cap" is not an error to apologise
# for — it is the upgrade path — so the client has to be able to tell it apart
# from the other two conflicts without parsing prose.
SEAT_CAP_DETAIL = "seat cap reached"
ALREADY_MEMBER_DETAIL = "already a member"
ALREADY_INVITED_DETAIL = "invitation already pending"


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
        # 404 rather than 403: to a non-member this organization does not
        # exist, and saying "forbidden" would confirm that the id does.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "organization not found")
    return m


def _require_owner_or_admin(m: Membership) -> None:
    if m.role not in (Role.owner, Role.admin):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "owner or admin required")


async def _load_org(session: AsyncSession, org_id: uuid.UUID) -> Organization:
    org = await session.get(Organization, org_id)
    if org is None:  # pragma: no cover — membership implies the org exists
        raise HTTPException(status.HTTP_404_NOT_FOUND, "organization not found")
    return org


async def _load_client(
    session: AsyncSession, org_id: uuid.UUID, client_id: uuid.UUID
) -> Client:
    client = await session.get(Client, client_id)
    if client is None or client.organization_id != org_id:
        # Another org's client id is "not found", not "forbidden" — same rule
        # as the org itself.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "client not found")
    return client


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


@router.get("/{org_id}", response_model=OrganizationDetail)
async def get_org(
    org_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> OrganizationDetail:
    await _load_membership(session, user, org_id)
    org = await _load_org(session, org_id)
    usage = await seat_usage(session, org_id, org.seat_cap)
    return OrganizationDetail(
        id=org.id,
        name=org.name,
        plan=org.plan,
        seat_cap=org.seat_cap,
        seats_used=usage.members,
        seats_pending=usage.pending,
    )


# --- Members ---


@router.get("/{org_id}/memberships", response_model=list[MemberRead])
async def list_memberships(
    org_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> list[MemberRead]:
    await _load_membership(session, user, org_id)
    rows = (
        await session.execute(
            select(Membership, User)
            .join(User, User.id == Membership.user_id)
            .where(Membership.organization_id == org_id)
            .order_by(Membership.created_at)
        )
    ).all()
    return [
        MemberRead(
            id=m.id,
            user_id=m.user_id,
            organization_id=m.organization_id,
            role=m.role,
            email=u.email,
            name=u.name,
            created_at=m.created_at,
        )
        for m, u in rows
    ]


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
        # There is no transfer-ownership flow yet, and removing the last owner
        # would leave an org nobody can bill or invite for.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot remove owner")
    await session.delete(target)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Invitations ---


async def _create_invitation(
    session: AsyncSession,
    *,
    user: User,
    org_id: uuid.UUID,
    payload: MembershipInvite,
) -> Invitation:
    mine = await _load_membership(session, user, org_id)
    _require_owner_or_admin(mine)
    org = await _load_org(session, org_id)

    usage = await seat_usage(session, org_id, org.seat_cap)
    if usage.at_cap:
        raise HTTPException(status.HTTP_409_CONFLICT, SEAT_CAP_DETAIL)

    email = payload.email.lower()

    already = (
        await session.execute(
            select(Membership.id)
            .join(User, User.id == Membership.user_id)
            .where(Membership.organization_id == org_id, User.email == email)
        )
    ).first()
    if already is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, ALREADY_MEMBER_DETAIL)

    pending = (
        await session.execute(
            select(Invitation.id).where(
                Invitation.organization_id == org_id,
                Invitation.email == email,
                Invitation.accepted_at.is_(None),
                Invitation.revoked_at.is_(None),
                Invitation.expires_at > datetime.now(timezone.utc),
            )
        )
    ).first()
    if pending is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, ALREADY_INVITED_DETAIL)

    invitation = Invitation(
        organization_id=org_id,
        email=email,
        role=Role(payload.role),
        invited_by_user_id=user.id,
        expires_at=invite_expiry(),
    )
    session.add(invitation)
    # Flushed, not committed: the row needs an id to sign a token over, but the
    # invitation only becomes real once the mail is away. A committed row whose
    # email never left would be a seat reserved for nobody, and the owner would
    # have no way to tell it apart from one in flight.
    await session.flush()
    token = issue_invite_token(invitation.id)
    try:
        await send_invite_email(
            to=email,
            org_name=org.name,
            token=token,
            inviter=user.name,
        )
    except Exception as exc:  # noqa: BLE001 — provider-agnostic by design
        await session.rollback()
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "could not send the invitation email"
        ) from exc
    await session.commit()
    await session.refresh(invitation)
    return invitation


@router.post(
    "/{org_id}/invites",
    response_model=InvitationRead,
    status_code=status.HTTP_201_CREATED,
)
async def invite_agent(
    org_id: uuid.UUID,
    payload: MembershipInvite,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Invitation:
    """Offer a seat by email. The token goes to the mailbox, never the caller."""
    return await _create_invitation(session, user=user, org_id=org_id, payload=payload)


@router.post(
    "/{org_id}/memberships",
    response_model=InvitationRead,
    status_code=status.HTTP_201_CREATED,
)
async def invite_member(
    org_id: uuid.UUID,
    payload: MembershipInvite,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Invitation:
    """Older path for the same act, kept so existing callers keep working.

    It used to create the membership outright, along with a `User` row for the
    address if none existed — so an owner could conjure an account for any
    email and hand it the agency's plan without that address ever agreeing. It
    now does exactly what `POST /invites` does. Prefer that path; this one is
    here for compatibility and will go when nothing calls it.
    """
    return await _create_invitation(session, user=user, org_id=org_id, payload=payload)


@router.get("/{org_id}/invites", response_model=list[InvitationRead])
async def list_invites(
    org_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> list[Invitation]:
    """Open invitations only — spent and revoked ones are history, not seats."""
    await _load_membership(session, user, org_id)
    rows = await session.execute(
        select(Invitation)
        .where(
            Invitation.organization_id == org_id,
            Invitation.accepted_at.is_(None),
            Invitation.revoked_at.is_(None),
            Invitation.expires_at > datetime.now(timezone.utc),
        )
        .order_by(Invitation.created_at)
    )
    return list(rows.scalars().all())


@router.delete(
    "/{org_id}/invites/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def revoke_invite(
    org_id: uuid.UUID,
    invitation_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Response:
    """Kill the link. Marked, not deleted — see `Invitation`'s docstring."""
    mine = await _load_membership(session, user, org_id)
    _require_owner_or_admin(mine)
    invitation = await session.get(Invitation, invitation_id)
    if invitation is None or invitation.organization_id != org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "invitation not found")
    if invitation.accepted_at is not None:
        # The seat is already taken; removing the person is a membership
        # delete, which is a different (and more consequential) act.
        raise HTTPException(
            status.HTTP_409_CONFLICT, "invitation has already been accepted"
        )
    if invitation.revoked_at is None:
        invitation.revoked_at = datetime.now(timezone.utc)
        await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Clients ---


@router.get("/{org_id}/clients", response_model=list[ClientRead])
async def list_clients(
    org_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> list[ClientRead]:
    await _load_membership(session, user, org_id)
    rows = (
        await session.execute(
            select(Client, func.count(Trip.id))
            .outerjoin(Trip, Trip.client_id == Client.id)
            .where(Client.organization_id == org_id)
            .group_by(Client.id)
            .order_by(Client.name)
        )
    ).all()
    return [
        ClientRead(
            id=c.id,
            name=c.name,
            email=c.email,
            notes=c.notes,
            trip_count=int(count or 0),
            created_at=c.created_at,
        )
        for c, count in rows
    ]


@router.post(
    "/{org_id}/clients", response_model=ClientRead, status_code=status.HTTP_201_CREATED
)
async def create_client(
    org_id: uuid.UUID,
    payload: ClientCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Client:
    # Any member may create a client: making records for the people you plan
    # for is the agent's job, not the owner's.
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


@router.get("/{org_id}/clients/{client_id}", response_model=ClientRead)
async def get_client(
    org_id: uuid.UUID,
    client_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> ClientRead:
    await _load_membership(session, user, org_id)
    client = await _load_client(session, org_id, client_id)
    count = await session.scalar(
        select(func.count()).select_from(Trip).where(Trip.client_id == client.id)
    )
    return ClientRead(
        id=client.id,
        name=client.name,
        email=client.email,
        notes=client.notes,
        trip_count=int(count or 0),
        created_at=client.created_at,
    )


@router.patch("/{org_id}/clients/{client_id}", response_model=ClientRead)
async def update_client(
    org_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: ClientUpdate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> ClientRead:
    await _load_membership(session, user, org_id)
    client = await _load_client(session, org_id, client_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(client, key, value)
    await session.commit()
    await session.refresh(client)
    count = await session.scalar(
        select(func.count()).select_from(Trip).where(Trip.client_id == client.id)
    )
    return ClientRead(
        id=client.id,
        name=client.name,
        email=client.email,
        notes=client.notes,
        trip_count=int(count or 0),
        created_at=client.created_at,
    )


@router.delete("/{org_id}/clients/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    org_id: uuid.UUID,
    client_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Response:
    mine = await _load_membership(session, user, org_id)
    _require_owner_or_admin(mine)
    client = await _load_client(session, org_id, client_id)
    # `Trip.client_id` is ON DELETE SET NULL: deleting a client unassigns its
    # trips rather than destroying an agent's work.
    await session.delete(client)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{org_id}/clients/{client_id}/trips", response_model=list[ClientTripRead])
async def list_client_trips(
    org_id: uuid.UUID,
    client_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> list[ClientTripRead]:
    """Every trip assigned to this client, whoever in the org authored it."""
    await _load_membership(session, user, org_id)
    client = await _load_client(session, org_id, client_id)
    rows = (
        await session.execute(
            select(Trip, User)
            .join(User, User.id == Trip.owner_id)
            .where(Trip.client_id == client.id)
            .order_by(Trip.updated_at.desc())
        )
    ).all()
    return [
        ClientTripRead(
            id=t.id,
            title=t.title,
            country_iso2=t.country_iso2,
            region_code=t.region_code,
            month=t.month,
            owner_name=u.name,
            owner_email=u.email,
            # Whether a link exists, never the link itself: the token is the
            # owner's capability to hand out.
            shared=t.share_token is not None,
            updated_at=t.updated_at,
        )
        for t, u in rows
    ]


# --- Client notes ---


@router.get("/{org_id}/clients/{client_id}/notes", response_model=list[ClientNoteRead])
async def list_client_notes(
    org_id: uuid.UUID,
    client_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> list[ClientNoteRead]:
    await _load_membership(session, user, org_id)
    client = await _load_client(session, org_id, client_id)
    rows = (
        await session.execute(
            select(ClientNote, User)
            .outerjoin(User, User.id == ClientNote.author_user_id)
            .where(ClientNote.client_id == client.id)
            .order_by(ClientNote.created_at.desc())
        )
    ).all()
    return [
        ClientNoteRead(
            id=n.id,
            body=n.body,
            author_name=u.name if u else None,
            author_email=u.email if u else None,
            created_at=n.created_at,
        )
        for n, u in rows
    ]


@router.post(
    "/{org_id}/clients/{client_id}/notes",
    response_model=ClientNoteRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_client_note(
    org_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: ClientNoteCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> ClientNoteRead:
    await _load_membership(session, user, org_id)
    client = await _load_client(session, org_id, client_id)
    note = ClientNote(client_id=client.id, author_user_id=user.id, body=payload.body)
    session.add(note)
    await session.commit()
    await session.refresh(note)
    return ClientNoteRead(
        id=note.id,
        body=note.body,
        author_name=user.name,
        author_email=user.email,
        created_at=note.created_at,
    )


@router.delete(
    "/{org_id}/clients/{client_id}/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_client_note(
    org_id: uuid.UUID,
    client_id: uuid.UUID,
    note_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Response:
    mine = await _load_membership(session, user, org_id)
    client = await _load_client(session, org_id, client_id)
    note = await session.get(ClientNote, note_id)
    if note is None or note.client_id != client.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "note not found")
    # Your own note, or anyone's if you run the org.
    if note.author_user_id != user.id and mine.role not in (Role.owner, Role.admin):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not your note")
    await session.delete(note)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
