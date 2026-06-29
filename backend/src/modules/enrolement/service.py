# -*- coding: utf-8 -*-
"""Service métier pour l'enrôlement citoyen — avec cloisonnement."""
from uuid import UUID
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from src.modeles.enrolement import Enrolement
from src.modeles import Utilisateur


# ─── Fonctions utilitaires de cloisonnement ──────────────────────────

def _est_super_admin(utilisateur: Utilisateur) -> bool:
    """Vérifie si l'utilisateur est super admin."""
    return utilisateur.role in ["super_admin", "super_administrateur"]


def _appliquer_filtres_cloisonnement(query, utilisateur: Utilisateur, modele):
    """Applique les filtres de cloisonnement selon le rôle."""
    if _est_super_admin(utilisateur):
        return query

    conditions = []
    if utilisateur.domaine_id:
        conditions.append(modele.domaine_id == utilisateur.domaine_id)
    if utilisateur.role not in ["admin_domaine"] and utilisateur.departement_id:
        conditions.append(modele.departement_id == utilisateur.departement_id)

    if conditions:
        query = query.where(and_(*conditions))
    return query


async def creer_enrolement(
    session: AsyncSession,
    utilisateur: Utilisateur,
    data: dict,
) -> Enrolement:
    """Crée un nouvel enrôlement avec cloisonnement automatique."""
    enrolement = Enrolement(
        agent_id=utilisateur.id,
        domaine_id=utilisateur.domaine_id,
        departement_id=utilisateur.departement_id,
        **data
    )
    session.add(enrolement)
    await session.commit()
    await session.refresh(enrolement)
    return enrolement


async def obtenir_enrolements(
    session: AsyncSession,
    utilisateur: Utilisateur,
    statut: str | None = None,
) -> list[Enrolement]:
    """Liste les enrôlements avec cloisonnement."""
    query = select(Enrolement)

    # --- Cloisonnement (NOUVEAU) ---
    query = _appliquer_filtres_cloisonnement(query, utilisateur, Enrolement)

    # Si pas super admin, on filtre aussi par agent_id
    if not _est_super_admin(utilisateur):
        query = query.where(Enrolement.agent_id == utilisateur.id)

    if statut and statut != "tous":
        query = query.where(Enrolement.statut == statut)

    query = query.order_by(Enrolement.date_enrolement.desc())
    result = await session.execute(query)
    return list(result.scalars().all())


async def obtenir_enrolement(
    session: AsyncSession,
    enrolement_id: UUID,
) -> Enrolement | None:
    """Récupère un enrôlement par son ID."""
    result = await session.execute(
        select(Enrolement).where(Enrolement.id == enrolement_id)
    )
    return result.scalar_one_or_none()


async def mettre_a_jour_enrolement(
    session: AsyncSession,
    enrolement_id: UUID,
    data: dict,
) -> Enrolement | None:
    """Met à jour un enrôlement."""
    enrolement = await obtenir_enrolement(session, enrolement_id)
    if not enrolement:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(enrolement, key, value)
    await session.commit()
    await session.refresh(enrolement)
    return enrolement