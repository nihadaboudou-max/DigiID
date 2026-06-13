# -*- coding: utf-8 -*-
"""
Routes API de verification d'identite.

Prefixe : /api/v1/verification

Endpoints :
  POST   /envoyer-email       Envoie un code de verification par email
  POST   /envoyer-sms         Envoie un code de verification par SMS
  POST   /envoyer-appel       Passe un appel vocal avec le code
  POST   /verifier            Verifie le code recu
"""
from typing import Annotated

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.config import parametres
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.verification import service
from src.noyau.exceptions import ErreurValidation
from src.noyau import dechiffrer_donnee


routeur_verification = APIRouter(
    prefix="/api/v1/verification",
    tags=["Verification"],
)


# =============================================================================
# Schemas
# =============================================================================

class EnvoiEmailRequete(BaseModel):
    """Demande d'envoi d'un code de verification par email."""
    nouvel_email: EmailStr | None = Field(
        default=None,
        description="Si fourni, on verifie ce nouvel email (changement). Sinon l'email actuel.",
    )


class EnvoiSmsRequete(BaseModel):
    """Demande d'envoi d'un code de verification par SMS ou appel."""
    canal: str = Field(default="sms", description="sms ou appel")


class VerificationRequete(BaseModel):
    """Verification d'un code recu."""
    code: str = Field(..., min_length=6, max_length=6, description="Code a 6 chiffres")
    type_verification: str = Field(
        default="inscription",
        description="inscription, changement_email, changement_telephone",
    )


class ReponseEnvoi(BaseModel):
    """Reponse apres envoi d'un code."""
    message: str = "Code envoye."
    destination_masquee: str
    code_dev: str | None = Field(
        default=None,
        description="Code de verification visible uniquement en mode developpement",
    )


class ReponseVerification(BaseModel):
    """Reponse apres verification."""
    succes: bool
    message: str


# =============================================================================
# Routes
# =============================================================================

@routeur_verification.post(
    "/envoyer-email",
    response_model=ReponseEnvoi,
    summary="Envoie un code de verification par email",
)
async def envoyer_code_email(
    donnees: EnvoiEmailRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Envoie un code a 6 chiffres sur l'email de l'utilisateur."""

    email_destination = donnees.nouvel_email or dechiffrer_donnee(utilisateur.email_chiffre)
    code = await service.envoyer_code_email(
        session, utilisateur,
        nouveau_email=donnees.nouvel_email,
    )
    # Masquer l'email pour la reponse
    local, domaine = email_destination.split("@", 1)
    masque = local[:2] + "***@" + domaine

    # ⚠️ TEMPORAIRE : Retourner le code meme en production car
    # l'envoi d'email n'est pas encore branche (SendGrid/SMTP à configurer).
    # Le code est aussi visible dans les logs Render : chercher [CODE DEV]
    code_dev = code

    return ReponseEnvoi(destination_masquee=masque, code_dev=code_dev)


@routeur_verification.post(
    "/envoyer-sms",
    response_model=ReponseEnvoi,
    summary="Envoie un code de verification par SMS",
)
async def envoyer_code_sms(
    donnees: EnvoiSmsRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Envoie un code a 6 chiffres par SMS."""
    telephone = dechiffrer_donnee(utilisateur.telephone_chiffre)
    if not telephone:
        raise ErreurValidation("Ajoute d'abord un numero de telephone dans ton profil.")

    code = await service.envoyer_code_telephone(session, utilisateur, canal="sms")
    masque = telephone[:4] + "******"
    code_dev = code if parametres.est_developpement else None
    return ReponseEnvoi(destination_masquee=masque, code_dev=code_dev)


@routeur_verification.post(
    "/envoyer-appel",
    response_model=ReponseEnvoi,
    summary="Passe un appel vocal avec le code de verification",
)
async def envoyer_code_appel(
    donnees: EnvoiSmsRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Passe un appel telephonique pour lire le code de verification."""
    telephone = dechiffrer_donnee(utilisateur.telephone_chiffre)
    if not telephone:
        raise ErreurValidation("Ajoute d'abord un numero de telephone dans ton profil.")

    code = await service.envoyer_code_telephone(session, utilisateur, canal="appel")
    masque = telephone[:4] + "******"
    code_dev = code if parametres.est_developpement else None
    return ReponseEnvoi(destination_masquee=masque, code_dev=code_dev)


@routeur_verification.post(
    "/verifier",
    response_model=ReponseVerification,
    summary="Verifie un code recu",
)
async def verifier_code(
    donnees: VerificationRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Valide le code a 6 chiffres recu par email, SMS ou appel."""
    succes = await service.verifier_code(
        session,
        utilisateur_id=utilisateur.id,
        code=donnees.code,
        type_verification=donnees.type_verification,
    )
    if succes:
        return ReponseVerification(succes=True, message="Code valide ! Identite confirmee.")
    return ReponseVerification(succes=False, message="Code invalide ou expire. Demande un nouveau code.")
