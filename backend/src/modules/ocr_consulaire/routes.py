# -*- coding: utf-8 -*-
"""Routes API pour le module OCR Consulaire."""
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.ocr_consulaire import service
from src.modules.ocr_consulaire.schemas import (
    ListeVerificationsConsulaire,
    ReponseUploadConsulaire,
)

routeur_consulaire = APIRouter(
    prefix="/api/v1/utilisateur/consulaire",
    tags=["OCR Consulaire"],
)


@routeur_consulaire.post(
    "/upload",
    response_model=ReponseUploadConsulaire,
    status_code=status.HTTP_201_CREATED,
    summary="Uploader une carte d'immatriculation consulaire",
)
async def uploader_consulaire(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    fichier: UploadFile = File(..., description="Image de la carte consulaire"),
):
    """Upload et analyse OCR d'une carte d'immatriculation consulaire."""
    return await service.traiter_upload_consulaire(
        session=session, utilisateur=utilisateur, fichier=fichier,
    )


@routeur_consulaire.get(
    "/historique",
    response_model=ListeVerificationsConsulaire,
    summary="Historique des cartes consulaires scannées",
)
async def historique_consulaire(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    limite: int = 20,
):
    """Liste l'historique des cartes consulaires scannées."""
    return await service.obtenir_historique_consulaire(
        session=session, utilisateur=utilisateur, limite=limite,
    )
