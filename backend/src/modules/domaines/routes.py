# -*- coding: utf-8 -*-
"""Routes API pour les domaines."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.authentification.dependances import utilisateur_courant
from src.modeles.utilisateur import Utilisateur
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
from src.noyau import dechiffrer_donnee
from src.noyau.permissions import require_permission


# =============================================================================
# Fonctions utilitaires
# =============================================================================

async def _enrichir_domaine(domaine: Domaine, session: AsyncSession) -> Domaine:
    """Ajoute admin_nom à un domaine."""
    if domaine.admin_id:
        utilisateur = await session.get(Utilisateur, domaine.admin_id)
        if utilisateur:
            prenom = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else ""
            nom = dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else ""
            domaine.admin_nom = f"{prenom} {nom}".strip() or "Admin"
    return domaine


async def _enrichir_domaines(domaines: list[Domaine], session: AsyncSession) -> list[Domaine]:
    """Enrichit une liste de domaines avec admin_nom."""
    for domaine in domaines:
        await _enrichir_domaine(domaine, session)
    return domaines


routeur_domaines = APIRouter(prefix="/api/v1/domaines", tags=["Domaines"])


@routeur_domaines.post(
    "",
    response_model=DomaineResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un domaine",
)
@require_permission("domaine.ecrire")
async def creer(
    donnees: DomaineCreate,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Crée un nouveau domaine organisationnel."""
    domaine = await creer_domaine(session, donnees, admin_id=donnees.admin_id)
    return await _enrichir_domaine(domaine, session)


@routeur_domaines.get(
    "",
    response_model=DomaineListResponse,
    summary="Lister les domaines",
)
@require_permission("domaine.lire")
async def lister(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    page: int = Query(1, ge=1, description="Numéro de page"),
    par_page: int = Query(20, ge=1, le=100, description="Éléments par page"),
    est_actif: bool | None = Query(None, description="Filtrer par statut actif"),
    session: AsyncSession = Depends(obtenir_session),
):
    """Liste tous les domaines avec pagination."""
    domaines, total = await lister_domaines(session, page, par_page, est_actif)
    domaines = await _enrichir_domaines(domaines, session)
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
async def obtenir(
    domaine: Domaine = Depends(obtenir_domaine_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Récupère les détails d'un domaine."""
    return await _enrichir_domaine(domaine, session)


@routeur_domaines.patch(
    "/{domaine_id}",
    response_model=DomaineResponse,
    summary="Modifier un domaine",
)
@require_permission("domaine.ecrire")
async def modifier(
    donnees: DomaineUpdate,
    domaine: Domaine = Depends(obtenir_domaine_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Modifie un domaine existant et synchronise l'admin."""
    # La synchronisation Utilisateur.domaine_id se fait DANS le service
    domaine_modifie = await modifier_domaine(session, domaine.id, donnees)
    return await _enrichir_domaine(domaine_modifie, session)


@routeur_domaines.delete(
    "/{domaine_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un domaine",
)
@require_permission("domaine.supprimer")
async def supprimer(
    domaine: Domaine = Depends(obtenir_domaine_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
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
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Suspend un domaine avec un motif."""
    domaine_suspendu = await suspendre_domaine(session, domaine.id, motif)
    return await _enrichir_domaine(domaine_suspendu, session)


@routeur_domaines.post(
    "/{domaine_id}/reactiver",
    response_model=DomaineResponse,
    summary="Réactiver un domaine",
)
@require_permission("domaine.ecrire")
async def reactiver(
    domaine: Domaine = Depends(obtenir_domaine_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Réactive un domaine suspendu."""
    domaine_reactif = await reactiver_domaine(session, domaine.id)
    return await _enrichir_domaine(domaine_reactif, session)