# -*- coding: utf-8 -*-
"""Service Départements — Logique métier."""
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Departement
from src.modules.departements.schemas import DepartementCreate, DepartementUpdate


async def creer_departement(
    session: AsyncSession,
    donnees: DepartementCreate,
) -> Departement:
    """Crée un nouveau département."""
    # Vérifier unicité type+dans domaine
    result = await session.execute(
        select(Departement).where(
            Departement.domaine_id == donnees.domaine_id,
            Departement.type_departement == donnees.type_departement,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Un département '{donnees.type_departement}' existe déjà dans ce domaine",
        )

    departement = Departement(**donnees.model_dump())
    session.add(departement)
    await session.commit()
    await session.refresh(departement)
    return departement


async def obtenir_departement(
    session: AsyncSession,
    departement_id: UUID,
) -> Departement:
    """Récupère un département par ID."""
    result = await session.execute(
        select(Departement).where(Departement.id == departement_id)
    )
    departement = result.scalar_one_or_none()
    if not departement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Département introuvable",
        )
    return departement


async def lister_departements(
    session: AsyncSession,
    domaine_id: UUID | None = None,
    type_departement: str | None = None,
    page: int = 1,
    par_page: int = 20,
) -> tuple[list[Departement], int]:
    """Liste les départements avec filtres."""
    query = select(Departement)
    
    if domaine_id:
        query = query.where(Departement.domaine_id == domaine_id)
    if type_departement:
        query = query.where(Departement.type_departement == type_departement)
    
    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar() or 0
    
    query = query.offset((page - 1) * par_page).limit(par_page)
    result = await session.execute(query)
    departements = list(result.scalars().all())
    
    return departements, total


async def modifier_departement(
    session: AsyncSession,
    departement_id: UUID,
    donnees: DepartementUpdate,
) -> Departement:
    """Modifie un département."""
    departement = await obtenir_departement(session, departement_id)
    
    for champ, valeur in donnees.model_dump(exclude_unset=True).items():
        setattr(departement, champ, valeur)
    
    await session.commit()
    await session.refresh(departement)
    return departement


async def supprimer_departement(
    session: AsyncSession,
    departement_id: UUID,
) -> None:
    """Supprime un département."""
    departement = await obtenir_departement(session, departement_id)
    await session.delete(departement)
    await session.commit()