# -*- coding: utf-8 -*-
"""
Routes de monitoring — santé du système.

Préfixe : /api/v1

L'endpoint /sante est public (utilisé par Docker, load balancers, etc.).
Il vérifie en profondeur que tous les services dont dépend l'API
sont effectivement opérationnels.
"""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session_optionnelle
from src.config import parametres


routeur_monitoring = APIRouter(
    prefix="/api/v1",
    tags=["Monitoring"],
)


@routeur_monitoring.get(
    "/sante-leger",
    summary="Vérification de santé légère (sans DB)",
    status_code=status.HTTP_200_OK,
)
async def sante_leger(requete: Request):
    """
    Health check léger : répond immédiatement sans dépendance externe.
    Utilisé par Docker HEALTHCHECK et Render pour vérifier
    que le processus est vivant, avant que la DB ne soit prête.

    Retourne aussi l'état d'initialisation de l'application.
    """
    init_terminee = getattr(requete.app.state, "initialisation_terminee", False)
    return {
        "statut": "ok",
        "initialisation": "terminee" if init_terminee else "en_cours",
        "application": parametres.nom_application,
        "version": parametres.version_api,
        "environnement": parametres.environnement,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@routeur_monitoring.get(
    "/sante",
    summary="Vérification de santé complète",
    status_code=status.HTTP_200_OK,
)
async def sante(
    requete: Request,
    session: Annotated[AsyncSession | None, Depends(obtenir_session_optionnelle)],
):
    """
    Health check complet : vérifie la DB si disponible,
    sinon retourne un statut dégradé.

    S'adapte au cas où la DB n'est pas encore prête
    (initialisation en arrière-plan sur Render Free).
    """
    init_terminee = getattr(requete.app.state, "initialisation_terminee", False)
    statut_global = "ok"
    details = {
        "initialisation": "terminee" if init_terminee else "en_cours",
    }

    # Vérification base de données (optionnelle)
    if session is not None:
        try:
            resultat = await session.execute(text("SELECT 1"))
            resultat.scalar()
            details["base_donnees"] = "ok"
        except Exception as erreur:
            details["base_donnees"] = f"erreur : {erreur}"
            statut_global = "degrade"
    else:
        details["base_donnees"] = "non_verifiee"

    return {
        "statut": statut_global,
        "date_verification": datetime.now(timezone.utc).isoformat(),
        "version": parametres.version_api,
        "environnement": parametres.environnement,
        "details": details,
    }


@routeur_monitoring.get(
    "/version",
    summary="Version courante de l'API",
)
async def version():
    """Retourne la version de l'API exposée."""
    return {
        "application": parametres.nom_application,
        "version_api": parametres.version_api,
        "environnement": parametres.environnement,
    }
