# -*- coding: utf-8 -*-
"""Service Départements — Logique métier."""
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from src.modeles import Departement, Utilisateur
from src.modules.departements.schemas import DepartementCreate, DepartementUpdate


async def creer_departement(
    session: AsyncSession,
    donnees: DepartementCreate,
) -> Departement:
    """Crée un nouveau département ET synchronise le chef assigné."""
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
    await session.flush()  # Pour obtenir l'ID du département
    
    # 🔄 SYNCHRONISATION : si un chef est assigné à la création
    chef_id = getattr(donnees, 'chef_id', None)
    if chef_id:
        chef = await session.get(Utilisateur, chef_id)
        if chef:
            chef.departement_id = departement.id
            chef.domaine_id = departement.domaine_id
            session.add(chef)
    
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
    """
    Modifie un département ET synchronise l'utilisateur chef.
    
    CORRECTION CRITIQUE : Quand on assigne un chef_id à un département,
    il faut aussi mettre à jour l'utilisateur concerné :
    - utilisateur.departement_id = departement.id
    - utilisateur.domaine_id = departement.domaine_id
    """
    departement = await obtenir_departement(session, departement_id)
    
    # 1️⃣ Sauvegarder l'ancien chef_id AVANT modification
    ancien_chef_id = departement.chef_id
    
    # 2️⃣ Mettre à jour les champs du département
    for champ, valeur in donnees.model_dump(exclude_unset=True).items():
        setattr(departement, champ, valeur)
    
    # 3️ SYNCHRONISATION BIDIRECTIONNELLE si le chef a changé
    nouveau_chef_id = getattr(donnees, 'chef_id', None)
    
    if ancien_chef_id != nouveau_chef_id:
        # A. Retirer l'ancien chef de son département
        if ancien_chef_id:
            ancien_chef = await session.get(Utilisateur, ancien_chef_id)
            if ancien_chef:
                ancien_chef.departement_id = None
                ancien_chef.domaine_id = None
                session.add(ancien_chef)  # Marquer comme modifié
        
        # B. Assigner le nouveau chef au département
        if nouveau_chef_id:
            nouveau_chef = await session.get(Utilisateur, nouveau_chef_id)
            if nouveau_chef:
                nouveau_chef.departement_id = departement_id
                nouveau_chef.domaine_id = departement.domaine_id
                session.add(nouveau_chef)  # Marquer comme modifié
    
    # 4️⃣ Commit des DEUX tables (Departement ET Utilisateur)
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