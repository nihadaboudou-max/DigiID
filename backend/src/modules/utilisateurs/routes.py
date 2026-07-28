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