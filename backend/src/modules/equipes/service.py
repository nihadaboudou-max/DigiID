# -*- coding: utf-8 -*-
"""Service métier pour les équipes."""
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles.equipe import Equipe
from src.modeles.equipe_membre import equipe_membres
from src.modules.equipes.schemas import EquipeCreate, EquipeUpdate


async def creer_equipe(
    session: AsyncSession,
    donnees: EquipeCreate,
) -> Equipe:
    """Crée une nouvelle équipe."""
    equipe = Equipe(
        nom=donnees.nom,
        description=donnees.description,
        departement_id=donnees.departement_id,
        chef_id=donnees.chef_id,
    )
    session.add(equipe)
    await session.commit()
    await session.refresh(equipe)
    return equipe


async def lister_equipes(
    session: AsyncSession,
    departement_id: UUID | None = None,
    est_actif: bool | None = None,
    page: int = 1,
    par_page: int = 20,
) -> tuple[list[Equipe], int]:
    """Liste les équipes avec filtres."""
    conditions = []
    if departement_id:
        conditions.append(Equipe.departement_id == departement_id)
    if est_actif is not None:
        conditions.append(Equipe.est_actif == est_actif)

    # Compter le total
    stmt_count = select(func.count(Equipe.id))
    if conditions:
        stmt_count = stmt_count.where(and_(*conditions))
    total = (await session.execute(stmt_count)).scalar() or 0

    # Récupérer les équipes paginées
    stmt = (
        select(Equipe)
        .order_by(Equipe.date_creation.desc())
        .offset((page - 1) * par_page)
        .limit(par_page)
    )
    if conditions:
        stmt = stmt.where(and_(*conditions))

    result = await session.execute(stmt)
    equipes = list(result.scalars().all())

    return equipes, total


async def obtenir_equipe_par_id(
    session: AsyncSession,
    equipe_id: UUID,
) -> Equipe | None:
    """Récupère une équipe par son ID."""
    stmt = select(Equipe).where(Equipe.id == equipe_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def modifier_equipe(
    session: AsyncSession,
    equipe: Equipe,
    donnees: EquipeUpdate,
) -> Equipe:
    """Modifie une équipe existante."""
    if donnees.nom is not None:
        equipe.nom = donnees.nom
    if donnees.description is not None:
        equipe.description = donnees.description
    if donnees.chef_id is not None:
        equipe.chef_id = donnees.chef_id
    if donnees.est_actif is not None:
        equipe.est_actif = donnees.est_actif

    await session.commit()
    await session.refresh(equipe)
    return equipe


async def supprimer_equipe(
    session: AsyncSession,
    equipe: Equipe,
) -> None:
    """Supprime une équipe."""
    await session.delete(equipe)
    await session.commit()


async def ajouter_membre(
    session: AsyncSession,
    equipe_id: UUID,
    utilisateur_id: UUID,
) -> None:
    """Ajoute un membre à une équipe."""
    # Vérifier si le membre existe déjà
    stmt = select(equipe_membres).where(
        and_(
            equipe_membres.c.equipe_id == equipe_id,
            equipe_membres.c.utilisateur_id == utilisateur_id,
        )
    )
    result = await session.execute(stmt)
    if result.first():
        raise ValueError("L'utilisateur est déjà membre de cette équipe")

    # Ajouter le membre
    await session.execute(
        equipe_membres.insert().values(
            equipe_id=equipe_id,
            utilisateur_id=utilisateur_id,
        )
    )
    await session.commit()


async def retirer_membre(
    session: AsyncSession,
    equipe_id: UUID,
    utilisateur_id: UUID,
) -> None:
    """Retire un membre d'une équipe."""
    await session.execute(
        equipe_membres.delete().where(
            and_(
                equipe_membres.c.equipe_id == equipe_id,
                equipe_membres.c.utilisateur_id == utilisateur_id,
            )
        )
    )
    await session.commit()