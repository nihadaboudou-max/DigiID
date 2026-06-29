# -*- coding: utf-8 -*-
"""Service métier pour le module ONG — avec cloisonnement."""
from uuid import UUID
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from src.modeles import Utilisateur
from src.modeles.ong import BeneficiaireONG, ProgrammeONG, MissionTerrain


# ─── Fonctions utilitaires de cloisonnement ──────────────────────────

def _est_super_admin(utilisateur: Utilisateur) -> bool:
    """Vérifie si l'utilisateur est super admin."""
    return utilisateur.role in ["super_admin", "super_administrateur"]


def _appliquer_filtres_cloisonnement(
    query,
    utilisateur: Utilisateur,
    modele,
):
    """Applique les filtres de cloisonnement selon le rôle de l'utilisateur."""
    if _est_super_admin(utilisateur):
        return query  # Super admin voit tout

    conditions = []
    if utilisateur.domaine_id:
        conditions.append(modele.domaine_id == utilisateur.domaine_id)

    # Admin domaine voit tout son domaine
    if utilisateur.role not in ["admin_domaine"] and utilisateur.departement_id:
        conditions.append(modele.departement_id == utilisateur.departement_id)

    if conditions:
        query = query.where(and_(*conditions))

    return query


# =============================================================================
# BÉNÉFICIAIRES
# =============================================================================

async def creer_beneficiaire(
    session: AsyncSession,
    utilisateur: Utilisateur,
    data: dict,
) -> BeneficiaireONG:
    """Crée un nouveau bénéficiaire avec cloisonnement automatique."""
    beneficiaire = BeneficiaireONG(
        ong_id=utilisateur.id,
        domaine_id=utilisateur.domaine_id,
        departement_id=utilisateur.departement_id,
        **data
    )
    session.add(beneficiaire)
    await session.commit()
    await session.refresh(beneficiaire)
    return beneficiaire


async def obtenir_beneficiaires(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> list[BeneficiaireONG]:
    """Liste les bénéficiaires avec cloisonnement."""
    query = select(BeneficiaireONG).order_by(BeneficiaireONG.date_inscription.desc())

    # --- Cloisonnement (NOUVEAU) ---
    query = _appliquer_filtres_cloisonnement(query, utilisateur, BeneficiaireONG)

    # Si ce n'est pas un super admin, on filtre aussi par ong_id
    if not _est_super_admin(utilisateur):
        query = query.where(BeneficiaireONG.ong_id == utilisateur.id)

    result = await session.execute(query)
    return list(result.scalars().all())


async def compter_beneficiaires(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> int:
    """Compte les bénéficiaires avec cloisonnement."""
    query = select(func.count(BeneficiaireONG.id))

    # --- Cloisonnement (NOUVEAU) ---
    query = _appliquer_filtres_cloisonnement(query, utilisateur, BeneficiaireONG)

    if not _est_super_admin(utilisateur):
        query = query.where(BeneficiaireONG.ong_id == utilisateur.id)

    result = await session.execute(query)
    return result.scalar() or 0


# =============================================================================
# PROGRAMMES
# =============================================================================

async def creer_programme(
    session: AsyncSession,
    utilisateur: Utilisateur,
    data: dict,
) -> ProgrammeONG:
    """Crée un nouveau programme avec cloisonnement automatique."""
    programme = ProgrammeONG(
        ong_id=utilisateur.id,
        domaine_id=utilisateur.domaine_id,
        departement_id=utilisateur.departement_id,
        **data
    )
    session.add(programme)
    await session.commit()
    await session.refresh(programme)
    return programme


async def obtenir_programmes(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> list[ProgrammeONG]:
    """Liste les programmes avec cloisonnement."""
    query = select(ProgrammeONG).order_by(ProgrammeONG.date_debut.desc())

    # --- Cloisonnement (NOUVEAU) ---
    query = _appliquer_filtres_cloisonnement(query, utilisateur, ProgrammeONG)

    if not _est_super_admin(utilisateur):
        query = query.where(ProgrammeONG.ong_id == utilisateur.id)

    result = await session.execute(query)
    return list(result.scalars().all())


# =============================================================================
# MISSIONS TERRAIN
# =============================================================================

async def creer_mission(
    session: AsyncSession,
    utilisateur: Utilisateur,
    data: dict,
) -> MissionTerrain:
    """Crée une nouvelle mission avec cloisonnement automatique."""
    mission = MissionTerrain(
        ong_id=utilisateur.id,
        domaine_id=utilisateur.domaine_id,
        departement_id=utilisateur.departement_id,
        **data
    )
    session.add(mission)
    await session.commit()
    await session.refresh(mission)
    return mission


async def obtenir_missions(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> list[MissionTerrain]:
    """Liste les missions avec cloisonnement."""
    query = select(MissionTerrain).order_by(MissionTerrain.date_depart.desc())

    # --- Cloisonnement (NOUVEAU) ---
    query = _appliquer_filtres_cloisonnement(query, utilisateur, MissionTerrain)

    if not _est_super_admin(utilisateur):
        query = query.where(MissionTerrain.ong_id == utilisateur.id)

    result = await session.execute(query)
    return list(result.scalars().all())