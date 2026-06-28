# -*- coding: utf-8 -*-
"""Routes API pour les départements."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles.departement import Departement
from src.base_donnees.session import obtenir_session
from src.modules.departements.schemas import (
    DepartementCreate, DepartementUpdate, DepartementResponse, DepartementListResponse
)
from src.modules.departements.service import (
    creer_departement, lister_departements,
    modifier_departement, supprimer_departement
)
from src.modules.departements.dependances import obtenir_departement_ou_404
from src.noyau.permissions import require_permission

routeur_departements = APIRouter(prefix="/departements", tags=["Départements"])


@routeur_departements.post(
    "",
    response_model=DepartementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un département",
)
@require_permission("departement.ecrire")
async def creer(
    donnees: DepartementCreate,
    session: AsyncSession = Depends(obtenir_session),
):
    """Crée un nouveau département dans un domaine."""
    return await creer_departement(session, donnees)


@routeur_departements.get(
    "",
    response_model=DepartementListResponse,
    summary="Lister les départements",
)
@require_permission("departement.lire")
async def lister(
    domaine_id: UUID | None = Query(None, description="Filtrer par domaine"),
    type_departement: str | None = Query(None, description="Filtrer par type"),
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(obtenir_session),
):
    """Liste les départements avec filtres."""
    departements, total = await lister_departements(
        session, domaine_id, type_departement, page, par_page
    )
    return DepartementListResponse(
        departements=departements,
        total=total,
        page=page,
        par_page=par_page,
    )


@routeur_departements.get(
    "/{departement_id}",
    response_model=DepartementResponse,
    summary="Obtenir un département",
)
@require_permission("departement.lire")
async def obtenir(departement: Departement = Depends(obtenir_departement_ou_404)):
    """Récupère les détails d'un département."""
    return departement


@routeur_departements.patch(
    "/{departement_id}",
    response_model=DepartementResponse,
    summary="Modifier un département",
)
@require_permission("departement.ecrire")
async def modifier(
    donnees: DepartementUpdate,
    departement: Departement = Depends(obtenir_departement_ou_404),
    session: AsyncSession = Depends(obtenir_session),
):
    """Modifie un département existant."""
    return await modifier_departement(session, departement.id, donnees)


@routeur_departements.delete(
    "/{departement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un département",
)
@require_permission("departement.supprimer")
async def supprimer(
    departement: Departement = Depends(obtenir_departement_ou_404),
    session: AsyncSession = Depends(obtenir_session),
):
    """Supprime un département."""
    await supprimer_departement(session, departement.id)