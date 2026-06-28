# -*- coding: utf-8 -*-
"""Routes API pour les invitations."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.authentification.dependances import utilisateur_courant
from src.modeles.utilisateur import Utilisateur
from src.base_donnees.session import obtenir_session
from src.modules.invitations.schemas import (
    InvitationCreate, InvitationResponse, InvitationListResponse,
    InvitationValiderResponse,
)
from src.modules.invitations.service import (
    creer_invitation, lister_invitations, annuler_invitation,
    valider_invitation,
)
from src.modules.invitations.dependances import obtenir_invitation_ou_404
from src.noyau.permissions import require_permission

routeur_invitations = APIRouter(prefix="/api/v1/invitations", tags=["Invitations"])


@routeur_invitations.post(
    "",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une invitation",
)
@require_permission("invitation.envoyer")
async def creer(
    donnees: InvitationCreate,
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Crée une nouvelle invitation par email."""
    try:
        invitation = await creer_invitation(session, donnees, utilisateur_courant.id)
        return invitation
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@routeur_invitations.get(
    "",
    response_model=InvitationListResponse,
    summary="Lister les invitations",
)
@require_permission("invitation.lire")
async def lister(
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    domaine_id: UUID | None = Query(None, description="Filtrer par domaine"),
    statut: str | None = Query(None, description="Filtrer par statut"),
    page: int = Query(1, ge=1),
    par_page: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(obtenir_session),
):
    """Liste les invitations avec filtres."""
    # Super admin voit tout, admin_domaine voit seulement son domaine
    cree_par = None
    if utilisateur_courant.role != "super_administrateur":
        cree_par = utilisateur_courant.id

    invitations, total = await lister_invitations(
        session, cree_par, domaine_id, statut, page, par_page
    )
    return InvitationListResponse(
        invitations=invitations,
        total=total,
        page=page,
        par_page=par_page,
    )


@routeur_invitations.get(
    "/{invitation_id}",
    response_model=InvitationResponse,
    summary="Obtenir une invitation",
)
@require_permission("invitation.lire")
async def obtenir(
    invitation = Depends(obtenir_invitation_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
):
    """Récupère les détails d'une invitation."""
    return invitation


@routeur_invitations.delete(
    "/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Annuler une invitation",
)
@require_permission("invitation.envoyer")
async def annuler(
    invitation = Depends(obtenir_invitation_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Annule une invitation en attente."""
    try:
        await annuler_invitation(session, invitation)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@routeur_invitations.post(
    "/valider/{token}",
    response_model=InvitationValiderResponse,
    summary="Valider une invitation (endpoint public)",
)
async def valider(
    token: str,
    session: AsyncSession = Depends(obtenir_session),
):
    """
    Valide une invitation à partir du token reçu par email.
    Retourne un token d'inscription pour compléter l'inscription.
    
    ⚠️ Endpoint PUBLIC — pas d'authentification requise.
    """
    try:
        invitation, token_inscription = await valider_invitation(session, token)
        return InvitationValiderResponse(
            message="Invitation validée avec succès",
            invitation=invitation,
            token_inscription=token_inscription,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )