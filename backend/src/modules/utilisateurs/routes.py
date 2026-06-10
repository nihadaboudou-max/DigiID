# -*- coding: utf-8 -*-
"""
Routes API de l'espace utilisateur (rôle 'utilisateur').

Préfixe : /api/v1/utilisateur

Phase 1 — endpoints de base. Les modules profil, score et chatbot
viendront dans les phases suivantes.
"""
from typing import Annotated

from fastapi import APIRouter, Depends

from src.config.constantes import PREFIXE_API_UTILISATEUR
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.schemas.authentification import UtilisateurReponse
from src.modules.authentification.routes import _construire_utilisateur_reponse


routeur_utilisateur = APIRouter(
    prefix=PREFIXE_API_UTILISATEUR,
    tags=["Espace Utilisateur"],
    dependencies=[Depends(utilisateur_courant)],
)


@routeur_utilisateur.get(
    "/tableau-de-bord",
    summary="Tableau de bord utilisateur",
)
async def tableau_de_bord(
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Page d'accueil après connexion — résumé du compte."""
    return {
        "message": f"Bonjour, voici votre tableau de bord DigiID.",
        "utilisateur": _construire_utilisateur_reponse(utilisateur),
        "score_actuel": utilisateur.score_actuel,
        "modules_disponibles": [
            "profil", "score", "chatbot", "consentements", "parametres",
        ],
    }
