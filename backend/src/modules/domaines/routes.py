# -*- coding: utf-8 -*-
"""Routes API pour les domaines."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles.domaine import Domaine
from src.base_donnees.session import obtenir_session
from src.modules.domaines.schemas import (
    DomaineCreate, DomaineUpdate, DomaineResponse, DomaineListResponse
)
from src.modules.domaines.service import (
    creer_domaine, obtenir_domaine, lister_domaines,
    modifier_domaine, supprimer_domaine, suspendre_domaine, reactiver_domaine
)
from src.modules.domaines.dependances import obtenir_domaine_ou_404
from src.noyau.permissions import require_permission

routeur_domaines = APIRouter(prefix="/domaines", tags=["Domaines"])


@routeur_domaines.post(
    "",
    response_model=DomaineResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un domaine",
)
@require_permission("domaine.ecrire")
async def creer(
    donnees: DomaineCreate,
    session: AsyncSession = Depends(obtenir_session),
):
    """Crée un nouveau domaine organisationnel."""
    return await creer_domaine(session, donnees)


@routeur_domaines.get(
    "",
    response_model=DomaineListResponse,
    summary="Lister les domaines",
)
@require_permission("domaine.lire")
async def lister(
    page: int = Query(1, ge=1, description="Numéro de page"),
    par_page: int = Query(20, ge=1, le=100, description="Éléments par page"),
    est_actif: bool | None = Query(None, description="Filtrer par statut actif"),
    session: AsyncSession = Depends(obtenir_session),
):
    """Liste tous les domaines avec pagination."""
    domaines, total = await lister_domaines(session, page, par_page, est_actif)
    return DomaineListResponse(
        domaines=domaines,
        total=total,
        page=page,
        par_page=par_page,
    )


@routeur_domaines.get(
    "/{domaine_id}",
    response_model=DomaineResponse,
    summary="Obtenir un domaine",
)
@require_permission("domaine.lire")
async def obtenir(domaine: Domaine = Depends(obtenir_domaine_ou_404)):
    """Récupère les détails d'un domaine."""
    return domaine


@routeur_domaines.patch(
    "/{domaine_id}",
    response_model=DomaineResponse,
    summary="Modifier un domaine",
)
@require_permission("domaine.ecrire")
async def modifier(
    donnees: DomaineUpdate,
    domaine: Domaine = Depends(obtenir_domaine_ou_404),
    session: AsyncSession = Depends(obtenir_session),
):
    """Modifie un domaine existant."""
    return await modifier_domaine(session, domaine.id, donnees)


@routeur_domaines.delete(
    "/{domaine_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un domaine",
)
@require_permission("domaine.supprimer")
async def supprimer(
    domaine: Domaine = Depends(obtenir_domaine_ou_404),
    session: AsyncSession = Depends(obtenir_session),
):
    """Supprime un domaine."""
    await supprimer_domaine(session, domaine.id)


@routeur_domaines.post(
    "/{domaine_id}/suspendre",
    response_model=DomaineResponse,
    summary="Suspendre un domaine",
)
@require_permission("domaine.ecrire")
async def suspendre(
    motif: str = Query(..., min_length=10, description="Motif de suspension"),
    domaine: Domaine = Depends(obtenir_domaine_ou_404),
    session: AsyncSession = Depends(obtenir_session),
):
    """Suspend un domaine avec un motif."""
    return await suspendre_domaine(session, domaine.id, motif)


@routeur_domaines.post(
    "/{domaine_id}/reactiver",
    response_model=DomaineResponse,
    summary="Réactiver un domaine",
)
@require_permission("domaine.ecrire")
async def reactiver(
    domaine: Domaine = Depends(obtenir_domaine_ou_404),
    session: AsyncSession = Depends(obtenir_session),
):
    """Réactive un domaine suspendu."""
    return await reactiver_domaine(session, domaine.id)