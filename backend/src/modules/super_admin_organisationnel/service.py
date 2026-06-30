# -*- coding: utf-8 -*-
"""Service métier pour la gestion organisationnelle Super Admin."""
import secrets
from datetime import datetime, timedelta
from uuid import UUID
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .modeles import Domaine, Departement, Invitation, Equipe
from .schemas import (
    DomaineCreate, DomaineUpdate,
    DepartementCreate, DepartementUpdate,
    InvitationCreate,
    EquipeCreate, EquipeUpdate,
)


# ============ DOMAINES ============

async def lister_domaines(session: AsyncSession) -> list[Domaine]:
    """Liste tous les domaines."""
    result = await session.execute(
        select(Domaine).order_by(Domaine.nom)
    )
    return list(result.scalars().all())


async def obtenir_domaine(session: AsyncSession, domaine_id: UUID) -> Domaine | None:
    """Récupère un domaine par son ID."""
    result = await session.execute(
        select(Domaine).where(Domaine.id == domaine_id)
    )
    return result.scalar_one_or_none()


async def creer_domaine(session: AsyncSession, data: DomaineCreate) -> Domaine:
    """Crée un nouveau domaine."""
    domaine = Domaine(**data.model_dump())
    session.add(domaine)
    await session.commit()
    await session.refresh(domaine)
    return domaine


async def modifier_domaine(session: AsyncSession, domaine_id: UUID, data: DomaineUpdate) -> Domaine | None:
    """Modifie un domaine."""
    domaine = await obtenir_domaine(session, domaine_id)
    if not domaine:
        return None
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(domaine, key, value)
    await session.commit()
    await session.refresh(domaine)
    return domaine


async def supprimer_domaine(session: AsyncSession, domaine_id: UUID) -> bool:
    """Supprime un domaine."""
    domaine = await obtenir_domaine(session, domaine_id)
    if not domaine:
        return False
    await session.delete(domaine)
    await session.commit()
    return True


# ============ DEPARTEMENTS ============

async def lister_departements(session: AsyncSession) -> list[Departement]:
    """Liste tous les départements avec leur domaine."""
    result = await session.execute(
        select(Departement)
        .options(selectinload(Departement.domaine))
        .order_by(Departement.nom)
    )
    return list(result.scalars().all())


async def obtenir_departement(session: AsyncSession, departement_id: UUID) -> Departement | None:
    """Récupère un département par son ID."""
    result = await session.execute(
        select(Departement)
        .options(selectinload(Departement.domaine))
        .where(Departement.id == departement_id)
    )
    return result.scalar_one_or_none()


async def creer_departement(session: AsyncSession, data: DepartementCreate) -> Departement:
    """Crée un nouveau département."""
    departement = Departement(**data.model_dump())
    session.add(departement)
    await session.commit()
    await session.refresh(departement)
    await session.refresh(departement, ["domaine"])
    return departement


async def modifier_departement(session: AsyncSession, departement_id: UUID, data: DepartementUpdate) -> Departement | None:
    """Modifie un département."""
    departement = await obtenir_departement(session, departement_id)
    if not departement:
        return None
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(departement, key, value)
    await session.commit()
    await session.refresh(departement)
    await session.refresh(departement, ["domaine"])
    return departement


async def supprimer_departement(session: AsyncSession, departement_id: UUID) -> bool:
    """Supprime un département."""
    departement = await obtenir_departement(session, departement_id)
    if not departement:
        return False
    await session.delete(departement)
    await session.commit()
    return True


# ============ INVITATIONS ============

async def lister_invitations(session: AsyncSession) -> list[Invitation]:
    """Liste toutes les invitations."""
    result = await session.execute(
        select(Invitation).order_by(Invitation.date_creation.desc())
    )
    return list(result.scalars().all())


async def creer_invitation(session: AsyncSession, data: InvitationCreate, cree_par: UUID) -> Invitation:
    """Crée une nouvelle invitation avec token unique."""
    token = secrets.token_urlsafe(32)
    invitation = Invitation(
        **data.model_dump(),
        token=token,
        cree_par=cree_par,
        date_expiration=datetime.utcnow() + timedelta(days=7),
    )
    session.add(invitation)
    await session.commit()
    await session.refresh(invitation)
    return invitation


async def annuler_invitation(session: AsyncSession, invitation_id: UUID) -> bool:
    """Annule une invitation."""
    result = await session.execute(
        select(Invitation).where(Invitation.id == invitation_id)
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        return False
    invitation.statut = "annulee"
    await session.commit()
    return True


async def renvoyer_invitation(session: AsyncSession, invitation_id: UUID) -> Invitation | None:
    """Renvoie une invitation (prolonge l'expiration)."""
    result = await session.execute(
        select(Invitation).where(Invitation.id == invitation_id)
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        return None
    invitation.date_expiration = datetime.utcnow() + timedelta(days=7)
    invitation.token = secrets.token_urlsafe(32)
    await session.commit()
    await session.refresh(invitation)
    return invitation


# ============ EQUIPES ============

async def lister_equipes(session: AsyncSession) -> list[Equipe]:
    """Liste toutes les équipes avec leur département."""
    result = await session.execute(
        select(Equipe)
        .options(selectinload(Equipe.departement))
        .order_by(Equipe.nom)
    )
    return list(result.scalars().all())


async def obtenir_equipe(session: AsyncSession, equipe_id: UUID) -> Equipe | None:
    """Récupère une équipe par son ID."""
    result = await session.execute(
        select(Equipe)
        .options(selectinload(Equipe.departement))
        .where(Equipe.id == equipe_id)
    )
    return result.scalar_one_or_none()


async def creer_equipe(session: AsyncSession, data: EquipeCreate) -> Equipe:
    """Crée une nouvelle équipe."""
    equipe = Equipe(**data.model_dump())
    session.add(equipe)
    await session.commit()
    await session.refresh(equipe)
    await session.refresh(equipe, ["departement"])
    return equipe


async def modifier_equipe(session: AsyncSession, equipe_id: UUID, data: EquipeUpdate) -> Equipe | None:
    """Modifie une équipe."""
    equipe = await obtenir_equipe(session, equipe_id)
    if not equipe:
        return None
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(equipe, key, value)
    await session.commit()
    await session.refresh(equipe)
    await session.refresh(equipe, ["departement"])
    return equipe


async def supprimer_equipe(session: AsyncSession, equipe_id: UUID) -> bool:
    """Supprime une équipe."""
    equipe = await obtenir_equipe(session, equipe_id)
    if not equipe:
        return False
    await session.delete(equipe)
    await session.commit()
    return True