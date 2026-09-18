# -*- coding: utf-8 -*-
"""Routes API pour le module OCR Carte de Séjour."""
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.ocr_carte_sejour import service
from src.modules.ocr_carte_sejour.schemas import (
    ListeVerificationsCarteSejour,
    ReponseUploadCarteSejour,
)

routeur_carte_sejour = APIRouter(
    prefix="/api/v1/utilisateur/carte-sejour",
    tags=["OCR Carte de Séjour"],
)


@routeur_carte_sejour.post(
    "/upload",
    response_model=ReponseUploadCarteSejour,
    status_code=status.HTTP_201_CREATED,
    summary="Uploader une carte / titre de séjour",
)
async def uploader_carte_sejour(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    fichier: UploadFile = File(..., description="Image de la carte de séjour"),
):
    """Upload et analyse OCR d'une carte / titre de séjour."""
    return await service.traiter_upload_carte_sejour(
        session=session, utilisateur=utilisateur, fichier=fichier,
    )


@routeur_carte_sejour.get(
    "/historique",
    response_model=ListeVerificationsCarteSejour,
    summary="Historique des cartes de séjour scannées",
)
async def historique_carte_sejour(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    limite: int = 20,
):
    """Liste l'historique des cartes de séjour scannées."""
    return await service.obtenir_historique_carte_sejour(
        session=session, utilisateur=utilisateur, limite=limite,
    )
