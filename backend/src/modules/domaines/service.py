# -*- coding: utf-8 -*-
"""Service Domaines — Logique métier."""
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from src.modeles import Domaine, Utilisateur
from src.modules.domaines.schemas import DomaineCreate, DomaineUpdate


async def creer_domaine(
    session: AsyncSession,
    donnees: DomaineCreate,
    admin_id: UUID | None = None,
) -> Domaine:
    """Crée un nouveau domaine."""
    result = await session.execute(
        select(Domaine).where(Domaine.code == donnees.code)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Le code '{donnees.code}' est déjà utilisé",
        )
    
    domaine = Domaine(
        nom=donnees.nom,
        code=donnees.code,
        description=donnees.description,
        region=donnees.region,
        admin_id=admin_id,
    )
    session.add(domaine)
    await session.commit()
    await session.refresh(domaine)
    return domaine


async def obtenir_domaine(
    session: AsyncSession,
    domaine_id: UUID,
) -> Domaine:
    """Récupère un domaine par ID."""
    result = await session.execute(
        select(Domaine).where(Domaine.id == domaine_id)
    )
    domaine = result.scalar_one_or_none()
    if not domaine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domaine introuvable",
        )
    return domaine


async def lister_domaines(
    session: AsyncSession,
    page: int = 1,
    par_page: int = 20,
    est_actif: bool | None = None,
) -> tuple[list[Domaine], int]:
    """Liste les domaines avec pagination."""
    query = select(Domaine)
    if est_actif is not None:
        query = query.where(Domaine.est_actif == est_actif)
    
    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar() or 0
    
    query = query.offset((page - 1) * par_page).limit(par_page)
    result = await session.execute(query)
    domaines = list(result.scalars().all())
    
    return domaines, total


async def modifier_domaine(
    session: AsyncSession,
    domaine_id: UUID,
    donnees: DomaineUpdate,
) -> Domaine:
    """
    Modifie un domaine ET synchronise l'utilisateur admin.
    C'est ici que se fait la magie de la liaison bidirectionnelle.
    """
    domaine = await obtenir_domaine(session, domaine_id)
    
    # 1. Sauvegarder l'ancien admin AVANT toute modification
    ancien_admin_id = domaine.admin_id
    
    # 2. Récupérer le nouvel admin_id (peut être None si non fourni dans le payload)
    nouvel_admin_id = getattr(donnees, 'admin_id', None)
    
    # 3. Mettre à jour les champs du domaine (nom, description, region, admin_id, etc.)
    for champ, valeur in donnees.model_dump(exclude_unset=True).items():
        setattr(domaine, champ, valeur)
    
    # 4. SYNCHRONISATION BIDIRECTIONNELLE si l'admin a changé
    if ancien_admin_id != nouvel_admin_id:
        
        # A. Retirer l'ancien admin de son domaine (libérer l'ancien)
        if ancien_admin_id:
            ancien_admin = await session.get(Utilisateur, ancien_admin_id)
            if ancien_admin:
                ancien_admin.domaine_id = None
                session.add(ancien_admin)  # Marquer comme modifié dans la session
        
        # B. Assigner le nouvel admin à ce domaine
        if nouvel_admin_id:
            nouvel_admin = await session.get(Utilisateur, nouvel_admin_id)
            if nouvel_admin:
                nouvel_admin.domaine_id = domaine.id
                session.add(nouvel_admin)  # Marquer comme modifié dans la session
    
    # 5. Valider les modifications des DEUX tables (Domaine ET Utilisateur)
    await session.commit()
    await session.refresh(domaine)
    return domaine


async def supprimer_domaine(
    session: AsyncSession,
    domaine_id: UUID,
) -> None:
    """Supprime un domaine."""
    domaine = await obtenir_domaine(session, domaine_id)
    await session.delete(domaine)
    await session.commit()


async def suspendre_domaine(
    session: AsyncSession,
    domaine_id: UUID,
    motif: str,
) -> Domaine:
    """Suspend un domaine."""
    domaine = await obtenir_domaine(session, domaine_id)
    domaine.suspendre(motif)
    await session.commit()
    await session.refresh(domaine)
    return domaine


async def reactiver_domaine(
    session: AsyncSession,
    domaine_id: UUID,
) -> Domaine:
    """Réactive un domaine suspendu."""
    domaine = await obtenir_domaine(session, domaine_id)
    domaine.reactiver()
    await session.commit()
    await session.refresh(domaine)
    return domaine