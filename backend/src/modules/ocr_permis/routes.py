# -*- coding: utf-8 -*-
"""Routes API pour le module OCR Permis de Conduire."""
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.ocr_permis import service
from src.modules.ocr_permis.schemas import (
    ListeVerificationsPermis,
    ReponseUploadPermis,
)

routeur_permis = APIRouter(
    prefix="/api/v1/utilisateur/permis",
    tags=["OCR Permis de Conduire"],
)


@routeur_permis.post(
    "/upload",
    response_model=ReponseUploadPermis,
    status_code=status.HTTP_201_CREATED,
    summary="Uploader un permis de conduire pour extraction OCR",
)
async def uploader_permis(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    fichier: UploadFile = File(..., description="Image du permis de conduire"),
    face: str = "recto",
):
    """Upload et analyse OCR d'un permis de conduire."""
    return await service.traiter_upload_permis(
        session=session,
        utilisateur=utilisateur,
        fichier=fichier,
        face=face,
    )


@routeur_permis.get(
    "/historique",
    response_model=ListeVerificationsPermis,
    summary="Historique des vérifications de permis",
)
async def historique_permis(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    limite: int = 20,
):
    """Liste l'historique des permis scannés."""
    return await service.obtenir_historique_permis(
        session=session,
        utilisateur=utilisateur,
        limite=limite,
    )