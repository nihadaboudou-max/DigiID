# -*- coding: utf-8 -*-
"""Routes API pour le module OCR Passeport."""
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.ocr_passeport import service
from src.modules.ocr_passeport.schemas import (
    ListeVerificationsPasseport,
    ReponseUploadPasseport,
)

routeur_passeport = APIRouter(
    prefix="/api/v1/utilisateur/passeport",
    tags=["OCR Passeport"],
)


@routeur_passeport.post(
    "/upload",
    response_model=ReponseUploadPasseport,
    status_code=status.HTTP_201_CREATED,
    summary="Uploader un passeport",
)
async def uploader_passeport(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    fichier: UploadFile = File(..., description="Image de la page d'identité du passeport"),
):
    """Upload et analyse OCR d'un passeport (MRZ TD3)."""
    return await service.traiter_upload_passeport(
        session=session, utilisateur=utilisateur, fichier=fichier,
    )


@routeur_passeport.get(
    "/historique",
    response_model=ListeVerificationsPasseport,
    summary="Historique des passeports scannés",
)
async def historique_passeport(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    limite: int = 20,
):
    """Liste l'historique des passeports scannés."""
    return await service.obtenir_historique_passeport(
        session=session, utilisateur=utilisateur, limite=limite,
    )
