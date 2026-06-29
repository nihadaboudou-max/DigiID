# -*- coding: utf-8 -*-
"""Routes API pour les équipes."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.authentification.dependances import utilisateur_courant
from src.modeles.utilisateur import Utilisateur
from src.base_donnees.session import obtenir_session
from src.modules.equipes.schemas import (
    EquipeCreate, EquipeUpdate, EquipeResponse, EquipeListResponse,
    EquipeMembreAdd,
)
from src.modules.equipes.service import (
    creer_equipe, lister_equipes, modifier_equipe, supprimer_equipe,
    ajouter_membre, retirer_membre,
)
from src.modules.equipes.dependances import obtenir_equipe_ou_404
from src.noyau.permissions import require_permission

routeur_equipes = APIRouter(prefix="/api/v1/equipes", tags=["Équipes"])


@routeur_equipes.post(
    "",
    response_model=EquipeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une équipe",
)
@require_permission("equipe.ecrire")
async def creer(
    donnees: EquipeCreate,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Crée une nouvelle équipe dans un département."""
    equipe = await creer_equipe(session, donnees)
    return equipe


@routeur_equipes.get(
    "",
    response_model=EquipeListResponse,
    summary="Lister les équipes",
)
@require_permission("equipe.lire")
async def lister(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    departement_id: UUID | None = Query(None, description="Filtrer par département"),
    est_actif: bool | None = Query(None, description="Filtrer par statut"),
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(obtenir_session),
):
    """Liste les équipes avec filtres."""
    equipes, total = await lister_equipes(session, departement_id, est_actif, page, par_page)
    return EquipeListResponse(
        equipes=equipes,
        total=total,
        page=page,
        par_page=par_page,
    )


@routeur_equipes.get(
    "/{equipe_id}",
    response_model=EquipeResponse,
    summary="Obtenir une équipe",
)
@require_permission("equipe.lire")
async def obtenir(
    equipe = Depends(obtenir_equipe_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
):
    """Récupère les détails d'une équipe."""
    return equipe


@routeur_equipes.patch(
    "/{equipe_id}",
    response_model=EquipeResponse,
    summary="Modifier une équipe",
)
@require_permission("equipe.ecrire")
async def modifier(
    donnees: EquipeUpdate,
    equipe = Depends(obtenir_equipe_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Modifie une équipe existante."""
    return await modifier_equipe(session, equipe, donnees)


@routeur_equipes.delete(
    "/{equipe_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer une équipe",
)
@require_permission("equipe.supprimer")
async def supprimer(
    equipe = Depends(obtenir_equipe_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Supprime une équipe."""
    await supprimer_equipe(session, equipe)


@routeur_equipes.post(
    "/{equipe_id}/membres",
    status_code=status.HTTP_201_CREATED,
    summary="Ajouter un membre à une équipe",
)
@require_permission("equipe.ecrire")
async def ajouter_membre_route(
    donnees: EquipeMembreAdd,
    equipe = Depends(obtenir_equipe_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Ajoute un utilisateur à une équipe."""
    try:
        await ajouter_membre(session, equipe.id, donnees.utilisateur_id)
        return {"message": "Membre ajouté avec succès"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@routeur_equipes.delete(
    "/{equipe_id}/membres/{utilisateur_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Retirer un membre d'une équipe",
)
@require_permission("equipe.ecrire")
async def retirer_membre_route(
    equipe_id: UUID,
    utilisateur_id: UUID,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Retire un utilisateur d'une équipe."""
    await retirer_membre(session, equipe_id, utilisateur_id)