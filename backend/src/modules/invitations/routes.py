# -*- coding: utf-8 -*-
"""Routes API pour les invitations."""
from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.src.noyau import journal
from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur, Domaine, Departement
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.invitations.dependances import obtenir_invitation_ou_404

from src.services.email import envoyer_email, template_invitation
from src.modeles import Domaine, Departement

from src.modules.invitations.schemas import (
    InvitationCreate,
    InvitationResponse,
    InvitationListResponse,
    InvitationValiderResponse,
    InvitationAcceptationSchema,
)
from src.modules.invitations.service import (
    creer_invitation,
    lister_invitations,
    annuler_invitation,
    valider_invitation,
    obtenir_invitation_par_token,
    accepter_invitation_service,
)
from src.noyau.permissions import require_permission

routeur_invitations = APIRouter(prefix="/api/v1/invitations", tags=["Invitations"])


# ============ CRUD INVITATIONS ============
# Modifie la fonction creer :
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
    request: Request = None,
):
    """Crée une nouvelle invitation par email."""
    try:
        invitation = await creer_invitation(session, donnees, utilisateur_courant.id)
        
        # Envoyer l'email d'invitation
        try:
            # Récupérer les infos pour le template
            domaine_nom = None
            departement_nom = None
            
            if invitation.domaine_id:
                domaine = await session.get(Domaine, invitation.domaine_id)
                if domaine:
                    domaine_nom = domaine.nom
            
            if invitation.departement_id:
                departement = await session.get(Departement, invitation.departement_id)
                if departement:
                    departement_nom = departement.nom
            
            # Construire le lien d'invitation
            base_url = request.base_url if request else "http://localhost:3000/"
            lien_invitation = f"{base_url}accepter-invitation/{invitation.token}"
            
            # Envoyer l'email
            sujet, contenu_html = template_invitation(
                lien_invitation=lien_invitation,
                role=invitation.role,
                domaine_nom=domaine_nom,
                departement_nom=departement_nom,
            )
            
            await envoyer_email(
                destinataire=invitation.email,
                sujet=sujet,
                contenu_html=contenu_html,
            )
        except Exception as e:
            # L'invitation est créée même si l'email échoue
            journal.warning(f"⚠️ Email non envoyé : {e}")
        
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
    invitation=Depends(obtenir_invitation_ou_404),
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
    invitation=Depends(obtenir_invitation_ou_404),
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
    "/{invitation_id}/renvoyer",
    response_model=InvitationResponse,
    summary="Renvoyer une invitation",
)
@require_permission("invitation.envoyer")
async def renvoyer(
    invitation=Depends(obtenir_invitation_ou_404),
    utilisateur_courant: Utilisateur = Depends(utilisateur_courant),
    session: AsyncSession = Depends(obtenir_session),
):
    """Renvoie une invitation en prolongeant sa date d'expiration."""
    import secrets
    from datetime import timedelta

    if invitation.statut != "en_attente":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible de renvoyer une invitation au statut '{invitation.statut}'",
        )

    invitation.token = secrets.token_urlsafe(48)
    invitation.date_expiration = datetime.utcnow() + timedelta(days=7)
    await session.commit()
    await session.refresh(invitation)
    return invitation


# ============ ACCEPTATION PUBLIQUE (sans auth) ============

@routeur_invitations.get(
    "/verifier/{token}",
    summary="Vérifier une invitation (public)",
)
async def verifier_invitation(
    token: str,
    session: AsyncSession = Depends(obtenir_session),
):
    """
    Vérifie qu'un token d'invitation est valide et retourne les infos.
    Endpoint PUBLIC — pas d'authentification requise.
    """
    invitation = await obtenir_invitation_par_token(session, token)
    if not invitation:
        raise HTTPException(404, "Invitation introuvable ou expirée")

    if invitation.statut != "en_attente":
        raise HTTPException(400, f"Invitation déjà {invitation.statut}")

    if invitation.date_expiration < datetime.utcnow():
        invitation.statut = "expiree"
        await session.commit()
        raise HTTPException(400, "Invitation expirée")

    # Récupérer les infos liées
    domaine_nom = None
    departement_nom = None

    if invitation.domaine_id:
        domaine = await session.get(Domaine, invitation.domaine_id)
        if domaine:
            domaine_nom = domaine.nom

    if invitation.departement_id:
        departement = await session.get(Departement, invitation.departement_id)
        if departement:
            departement_nom = departement.nom

    return {
        "email": invitation.email,
        "role": invitation.role,
        "domaine_nom": domaine_nom,
        "departement_nom": departement_nom,
        "date_expiration": invitation.date_expiration.isoformat(),
    }


@routeur_invitations.post(
    "/accepter/{token}",
    status_code=201,
    summary="Accepter une invitation (public)",
)
async def accepter_invitation(
    token: str,
    donnees: InvitationAcceptationSchema,
    session: AsyncSession = Depends(obtenir_session),
):
    """
    Accepte une invitation et crée le compte utilisateur.
    Endpoint PUBLIC — pas d'authentification requise.
    """
    invitation = await obtenir_invitation_par_token(session, token)
    if not invitation:
        raise HTTPException(404, "Invitation introuvable ou expirée")

    if invitation.statut != "en_attente":
        raise HTTPException(400, f"Invitation déjà {invitation.statut}")

    if invitation.date_expiration < datetime.utcnow():
        invitation.statut = "expiree"
        await session.commit()
        raise HTTPException(400, "Invitation expirée")

    # Vérifier que l'email n'est pas déjà utilisé
    result = await session.execute(
        select(Utilisateur).where(Utilisateur.email == invitation.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(400, "Un compte avec cet email existe déjà")

    # Créer le compte utilisateur
    utilisateur = await accepter_invitation_service(session, invitation, donnees)

    return {
        "message": "Compte créé avec succès",
        "email": utilisateur.email,
        "role": utilisateur.role,
    }