# -*- coding: utf-8 -*-
"""Routes API du module de détection de fraude."""
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant, obtenir_ip_client
from src.modules.detection_fraude import service
from src.modules.detection_fraude.schemas import (
    ActionFraudeRequete,
    ListeIncidentsFraude,
    ScoreRisque,
)


routeur_fraude = APIRouter(
    prefix="/api/v1/utilisateur/fraude",
    tags=["Détection Fraude"],
)


@routeur_fraude.post(
    "/evaluer",
    response_model=ScoreRisque,
    summary="Évaluer le risque d'une action sensible",
)
async def evaluer_action(
    action: ActionFraudeRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    adresse_ip: Annotated[str, Depends(obtenir_ip_client)],
):
    return await service.evaluer_risque_action(
        session=session,
        utilisateur=utilisateur,
        action=action,
        adresse_ip=adresse_ip,
    )


@routeur_fraude.get(
    "/score",
    response_model=ScoreRisque,
    summary="Récupérer le dernier score de risque de fraude",
)
async def score_risque(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    return await service.obtenir_score_risque_actuel(session=session, utilisateur=utilisateur)


@routeur_fraude.get(
    "/incidents",
    response_model=ListeIncidentsFraude,
    summary="Lister les incidents de fraude détectés",
)
async def incidents_fraude(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    return await service.lister_incidents(session=session, utilisateur=utilisateur)
