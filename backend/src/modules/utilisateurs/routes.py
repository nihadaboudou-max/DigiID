# -*- coding: utf-8 -*-
"""
Routes API de l'espace utilisateur (rôle 'utilisateur').

Préfixe : /api/v1/utilisateur

Phase 1 — endpoints de base. Les modules profil, score et chatbot
viendront dans les phases suivantes.
"""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.config.constantes import PREFIXE_API_UTILISATEUR
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.noyau import chiffrer_donnee, journal
from src.noyau.exceptions import ErreurConflit
from src.noyau.telephone import (
    hasher_telephone,
    masquer_telephone,
    normaliser_telephone,
)
from src.schemas.authentification import UtilisateurReponse
from src.modules.authentification.routes import _construire_utilisateur_reponse


routeur_utilisateur = APIRouter(
    prefix=PREFIXE_API_UTILISATEUR,
    tags=["Espace Utilisateur"],
    dependencies=[Depends(utilisateur_courant)],
)


# =============================================================================
# Schema pour modification nom/prénom
# =============================================================================
class ModificationIdentite(BaseModel):
    """Données pour modifier le nom et/ou le prénom."""
    nom: Optional[str] = Field(None, min_length=1, max_length=100, description="Nom de famille")
    prenom: Optional[str] = Field(None, min_length=1, max_length=100, description="Prénom")


class ModificationTelephone(BaseModel):
    """Ajout / modification du numéro — format international Bénin (+229)."""

    telephone: str = Field(
        ...,
        min_length=8,
        max_length=20,
        description="Numéro béninois : +229 01 XX XX XX XX",
    )
    canal: str = Field("sms", pattern="^(sms|appel)$")


# =============================================================================
# Routes existantes
# =============================================================================
@routeur_utilisateur.get(
    "/tableau-de-bord",
    summary="Tableau de bord utilisateur",
)
async def tableau_de_bord(
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Page d'accueil après connexion — résumé du compte."""
    return {
        "message": "Bonjour, voici votre tableau de bord DigiID.",
        "utilisateur": _construire_utilisateur_reponse(utilisateur),
        "score_actuel": utilisateur.score_actuel,
        "modules_disponibles": [
            "profil", "score", "chatbot", "consentements", "parametres",
        ],
    }


# =============================================================================
# ✅ NOUVEAU : Modification du nom et/ou du prénom
# =============================================================================
@routeur_utilisateur.patch(
    "/identite",
    summary="Modifier le nom et/ou le prénom",
)
async def modifier_identite(
    donnees: ModificationIdentite,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """
    Permet de modifier le nom de famille et/ou le prénom.
    Les données sont chiffrées avant stockage.
    """
    modifications = []

    if donnees.nom is not None:
        ancien_nom = utilisateur.nom_chiffre
        utilisateur.nom_chiffre = chiffrer_donnee(donnees.nom.upper().strip())
        modifications.append("nom")
        journal.info(f"Nom modifié pour utilisateur {utilisateur.id}")

    if donnees.prenom is not None:
        ancien_prenom = utilisateur.prenom_chiffre
        utilisateur.prenom_chiffre = chiffrer_donnee(donnees.prenom.capitalize().strip())
        modifications.append("prenom")
        journal.info(f"Prénom modifié pour utilisateur {utilisateur.id}")

    if not modifications:
        return {
            "message": "Aucune modification fournie.",
            "modifications": [],
        }

        from datetime import datetime, timezone
    utilisateur.modifie_le = datetime.now(timezone.utc)
    await session.commit()

    return {
        "message": f"Identité mise à jour : {', '.join(modifications)}",
        "modifications": modifications,
        "utilisateur": _construire_utilisateur_reponse(utilisateur),
    }


# =============================================================================
# TÉLÉPHONE — complétion du profil + OTP (contrainte S3)
# -----------------------------------------------------------------------------
# Un compte créé sans numéro doit pouvoir l'ajouter — et le modifier — depuis son
# profil. Le numéro est validé (+229), rendu unique, puis **prouvé par OTP** :
# c'est ce code qui marque le numéro comme vérifié.
# =============================================================================
@routeur_utilisateur.put(
    "/telephone",
    summary="Ajouter / modifier mon numéro (+229) et envoyer un OTP",
)
async def modifier_telephone(
    donnees: ModificationTelephone,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Enregistre le numéro normalisé puis envoie un code OTP par SMS/appel.

    - Format international Bénin obligatoire (``+229XXXXXXXXXX``) ;
    - Unicité stricte : un numéro = un seul compte ;
    - ``est_telephone_verifie`` repasse à ``False`` jusqu'à validation de l'OTP.
    """
    from datetime import datetime, timezone

    from sqlalchemy import select

    numero = normaliser_telephone(donnees.telephone)  # lève si mal formé
    empreinte = hasher_telephone(numero)

    if utilisateur.telephone_hash != empreinte:
        autre = await session.execute(
            select(Utilisateur.id).where(
                Utilisateur.telephone_hash == empreinte,
                Utilisateur.est_supprime == False,
            )
        )
        if autre.first() is not None:
            raise ErreurConflit(
                f"Numéro déjà associé à un compte ({empreinte[:8]}…)",
                message_utilisateur=(
                    "Ce numéro est déjà associé à un autre compte."
                ),
            )

    utilisateur.telephone_chiffre = chiffrer_donnee(numero)
    utilisateur.telephone_hash = empreinte
    utilisateur.est_telephone_verifie = False
    utilisateur.modifie_le = datetime.now(timezone.utc)
    await session.commit()

    journal.info(
        f"Numéro mis à jour (à vérifier) : utilisateur={utilisateur.id}"
    )

    # OTP envoyé sur le numéro fraîchement enregistré.
    from src.modules.authentification import verification_code

    envoi = await verification_code.renvoyer_code(
        session=session,
        utilisateur=utilisateur,
        email=None,
        telephone=numero,
        canal=donnees.canal,
        type_verification="inscription",
    )

    return {
        "succes": True,
        "telephone": masquer_telephone(numero),
        "est_telephone_verifie": False,
        "message": "Code envoyé. Validez-le pour vérifier votre numéro.",
        "destination_masquee": envoi.get("destination_masquee"),
        "duree_validite_minutes": envoi.get("duree_validite_minutes"),
        "code_dev": envoi.get("code"),
    }
