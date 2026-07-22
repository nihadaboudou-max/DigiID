# -*- coding: utf-8 -*-
"""Routes API pour les invitations."""
from datetime import datetime, timezone, timedelta
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import hashlib

from src.noyau import journal
from src.noyau import dechiffrer_donnee
from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur, Domaine, Departement
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.invitations.dependances import obtenir_invitation_ou_404

# ✅ CORRECTION : Utiliser le nouveau service de notification
from src.noyau.notification import (
    envoyer_email_invitation,
    envoyer_email_renvoyer_invitation,
)

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


# =============================================================================
# FONCTIONS UTILITAIRES
# =============================================================================

def hasher_email(email: str) -> str:
    """
    Hash un email pour permettre les recherches tout en protégeant la vie privée.
    Utilise SHA256 de l'email en minuscules et sans espaces.
    """
    return hashlib.sha256(email.lower().strip().encode()).hexdigest()


def _obtenir_nom_invitant(utilisateur: Utilisateur) -> str | None:
    """Extrait le nom complet d'un utilisateur en déchiffrant ses données."""
    try:
        prenom = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else ""
        nom = dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else ""
        nom_complet = f"{prenom} {nom}".strip()
        return nom_complet or None
    except Exception as e:
        journal.warning(f"[INVITATION] Erreur déchiffrement nom: {e}")
        return None


def _obtenir_lien_invitation(request: Request, token: str) -> str:
    """Construit le lien d'invitation complet."""
    base_url = str(request.base_url).rstrip("/")
    return f"{base_url}/accepter-invitation/{token}"


def _maintenant_utc() -> datetime:
    """Retourne l'heure actuelle en UTC avec timezone-aware."""
    return datetime.now(timezone.utc)


def _normaliser_datetime(dt: datetime) -> datetime:
    """
    Normalise un datetime pour qu'il soit timezone-aware (UTC).
    Si le datetime est naive, on lui ajoute UTC.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _est_expire(date_expiration: datetime) -> bool:
    """
    Vérifie si une date d'expiration est dépassée.
    Gère les cas aware/naive sans erreur de comparaison.
    """
    maintenant = _maintenant_utc()
    date_norm = _normaliser_datetime(date_expiration)
    return date_norm < maintenant


# =============================================================================
# CRUD INVITATIONS
# =============================================================================

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
        
        # ✅ CORRECTION : Envoyer l'email avec le nouveau service
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
            
            # Récupérer le nom de l'invitant
            nom_invitant = _obtenir_nom_invitant(utilisateur_courant)
            
            # Message personnalisé
            message_personnalise = None
            if hasattr(donnees, 'message') and donnees.message:
                message_personnalise = donnees.message
            
            # ✅ Envoyer l'email d'invitation (synchrone, pas async)
            succes = envoyer_email_invitation(
                destinataire=invitation.email,
                role=invitation.role,
                token=invitation.token,
                nom_invitant=nom_invitant,
                nom_domaine=domaine_nom,
                message_personnalise=message_personnalise,
            )
            
            if succes:
                journal.info(f"[INVITATION] ✅ Email envoyé à {invitation.email}")
            else:
                journal.warning(
                    f"[INVITATION] ⚠️ Email non envoyé (mode mock ou erreur) → {invitation.email}"
                )
            
        except Exception as e:
            # L'invitation est créée même si l'email échoue
            journal.error(f"[INVITATION] ❌ Erreur envoi email: {e}")
        
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
        # Super admin et administrateur (legacy) voient tout,
    # admin_domaine et autres voient seulement leurs propres invitations
    cree_par = None
    if utilisateur_courant.role not in ("super_administrateur", "administrateur", "super_admin"):
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
    request: Request = None,
):
    """Renvoie une invitation en prolongeant sa date d'expiration."""
    import secrets

    if invitation.statut != "en_attente":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible de renvoyer une invitation au statut '{invitation.statut}'",
        )

    # Générer un nouveau token
    invitation.token = secrets.token_urlsafe(48)
    # ✅ CORRECTION : Utiliser datetime.now(timezone.utc) au lieu de utcnow()
    invitation.date_expiration = _maintenant_utc() + timedelta(days=7)
    await session.commit()
    await session.refresh(invitation)
    
    # ✅ CORRECTION : Renvoyer l'email avec le nouveau service
    try:
        nom_invitant = _obtenir_nom_invitant(utilisateur_courant)
        
        # ✅ Envoyer l'email de rappel (synchrone)
        succes = envoyer_email_renvoyer_invitation(
            destinataire=invitation.email,
            role=invitation.role,
            token=invitation.token,
            nom_invitant=nom_invitant,
        )
        
        if succes:
            journal.info(f"[INVITATION] ✅ Email de rappel envoyé à {invitation.email}")
        else:
            journal.warning(
                f"[INVITATION] ⚠️ Email de rappel non envoyé → {invitation.email}"
            )
    except Exception as e:
        journal.error(f"[INVITATION] ❌ Erreur envoi rappel: {e}")
    
    return invitation


# =============================================================================
# ACCEPTATION PUBLIQUE (sans auth)
# =============================================================================

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

    # ✅ CORRECTION : Utiliser la fonction _est_expire qui gère aware/naive
    if _est_expire(invitation.date_expiration):
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

    # ✅ CORRECTION : Utiliser la fonction _est_expire qui gère aware/naive
    if _est_expire(invitation.date_expiration):
        invitation.statut = "expiree"
        await session.commit()
        raise HTTPException(400, "Invitation expirée")

    # ✅ CORRECTION : Utiliser email_hash au lieu de email
    # Le modèle Utilisateur n'a pas de champ 'email' direct
    # Il utilise email_hash (hashé, indexé) et email_chiffre (chiffré)
    email_hash = hasher_email(invitation.email)
    result = await session.execute(
        select(Utilisateur).where(Utilisateur.email_hash == email_hash)
    )
    if result.scalar_one_or_none():
        raise HTTPException(400, "Un compte avec cet email existe déjà")

    # Créer le compte utilisateur
    utilisateur = await accepter_invitation_service(session, invitation, donnees)

    return {
        "message": "Compte créé avec succès",
        # ✅ CORRECTION : Utiliser invitation.email, pas utilisateur.email
        "email": invitation.email,
        "role": utilisateur.role,
    }