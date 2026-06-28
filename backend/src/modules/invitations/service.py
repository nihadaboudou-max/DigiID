# -*- coding: utf-8 -*-
"""Service métier pour les invitations."""
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles.invitation import Invitation
from src.modules.invitations.schemas import InvitationCreate


async def creer_invitation(
    session: AsyncSession,
    donnees: InvitationCreate,
    cree_par: UUID,
) -> Invitation:
    """Crée une nouvelle invitation."""
    # Vérifier qu'il n'y a pas déjà une invitation en attente pour cet email
    stmt = select(Invitation).where(
        and_(
            Invitation.email == donnees.email,
            Invitation.statut == "en_attente",
        )
    )
    result = await session.execute(stmt)
    existante = result.scalar_one_or_none()
    if existante:
        raise ValueError(f"Une invitation en attente existe déjà pour {donnees.email}")

    # Créer l'invitation
    invitation = Invitation(
        email=donnees.email,
        role=donnees.role,
        domaine_id=donnees.domaine_id,
        departement_id=donnees.departement_id,
        message=donnees.message,
        cree_par=cree_par,
        token=secrets.token_urlsafe(48),
        date_expiration=datetime.now(timezone.utc) + timedelta(days=donnees.duree_jours),
    )
    session.add(invitation)
    await session.commit()
    await session.refresh(invitation)
    return invitation


async def lister_invitations(
    session: AsyncSession,
    cree_par: UUID | None = None,
    domaine_id: UUID | None = None,
    statut: str | None = None,
    page: int = 1,
    par_page: int = 20,
) -> tuple[list[Invitation], int]:
    """Liste les invitations avec filtres."""
    # Construction de la requête
    conditions = []
    if cree_par:
        conditions.append(Invitation.cree_par == cree_par)
    if domaine_id:
        conditions.append(Invitation.domaine_id == domaine_id)
    if statut:
        conditions.append(Invitation.statut == statut)

    # Compter le total
    stmt_count = select(func.count(Invitation.id))
    if conditions:
        stmt_count = stmt_count.where(and_(*conditions))
    total = (await session.execute(stmt_count)).scalar() or 0

    # Récupérer les invitations paginées
    stmt = (
        select(Invitation)
        .order_by(Invitation.date_creation.desc())
        .offset((page - 1) * par_page)
        .limit(par_page)
    )
    if conditions:
        stmt = stmt.where(and_(*conditions))

    result = await session.execute(stmt)
    invitations = list(result.scalars().all())

    return invitations, total


async def obtenir_invitation_par_token(
    session: AsyncSession,
    token: str,
) -> Invitation | None:
    """Récupère une invitation par son token."""
    stmt = select(Invitation).where(Invitation.token == token)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def obtenir_invitation_par_id(
    session: AsyncSession,
    invitation_id: UUID,
) -> Invitation | None:
    """Récupère une invitation par son ID."""
    stmt = select(Invitation).where(Invitation.id == invitation_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def annuler_invitation(
    session: AsyncSession,
    invitation: Invitation,
) -> Invitation:
    """Annule une invitation."""
    if invitation.statut != "en_attente":
        raise ValueError(f"Impossible d'annuler une invitation au statut '{invitation.statut}'")
    invitation.annuler()
    await session.commit()
    await session.refresh(invitation)
    return invitation


async def valider_invitation(
    session: AsyncSession,
    token: str,
) -> tuple[Invitation, str]:
    """
    Valide une invitation et retourne un token d'inscription.
    
    Returns:
        Tuple (invitation, token_inscription)
    """
    invitation = await obtenir_invitation_par_token(session, token)
    if not invitation:
        raise ValueError("Invitation introuvable")

    if invitation.statut != "en_attente":
        raise ValueError(f"Invitation déjà {invitation.statut}")

    if invitation.est_expiree:
        invitation.statut = "expiree"
        await session.commit()
        raise ValueError("Invitation expirée")

    # Générer un token d'inscription (valable 1 heure)
    token_inscription = secrets.token_urlsafe(32)

    # Marquer comme acceptée
    invitation.marquer_acceptee()
    await session.commit()
    await session.refresh(invitation)

    return invitation, token_inscription