# -*- coding: utf-8 -*-
"""
Routes API du module scoring.

Préfixe : /api/v1/utilisateur/score
"""
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import (
    utilisateur_courant, obtenir_ip_client,
)
from src.modules.scoring import service
from src.modules.scoring.schemas import (
    ScoreDetail, ListeHistoriqueScore,
)


routeur_scoring = APIRouter(
    prefix="/api/v1/utilisateur/score",
    tags=["Score DigiID"],
)


@routeur_scoring.get(
    "",
    response_model=ScoreDetail,
    summary="Récupérer mon score actuel avec ses facteurs explicatifs",
)
async def consulter_mon_score(
    requete: Request,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """
    Retourne le score actuel. S'il n'a jamais été calculé, il est calculé
    automatiquement et stocké.
    """
    return await service.obtenir_score_actuel(
        session=session,
        utilisateur=utilisateur,
        adresse_ip=obtenir_ip_client(requete),
    )


@routeur_scoring.post(
    "/recalculer",
    response_model=ScoreDetail,
    summary="Forcer un recalcul immédiat du score",
)
async def recalculer_mon_score(
    requete: Request,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """
    Force un nouveau calcul même si le précédent date de moins de 30 jours.
    Utile après une modification de profil ou d'autorisation.
    """
    return await service.calculer_et_enregistrer_score(
        session=session,
        utilisateur=utilisateur,
        adresse_ip=obtenir_ip_client(requete),
        forcer_recalcul=True,
    )


@routeur_scoring.get(
    "/historique",
    response_model=ListeHistoriqueScore,
    summary="Historique des calculs de score",
)
async def historique_mon_score(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    limite: int = Query(24, ge=1, le=100),
):
    """Retourne les `limite` derniers calculs de score (par défaut 24)."""
    return await service.lister_historique(
        session=session,
        utilisateur=utilisateur,
        limite=limite,
    )
