# -*- coding: utf-8 -*-
"""Routes API pour le module OCR Carte Grise."""
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.ocr_carte_grise import service
from src.modules.ocr_carte_grise.schemas import (
    ListeVerificationsCarteGrise,
    ReponseUploadCarteGrise,
)

routeur_carte_grise = APIRouter(
    prefix="/api/v1/utilisateur/carte-grise",
    tags=["OCR Carte Grise"],
)


@routeur_carte_grise.post(
    "/upload",
    response_model=ReponseUploadCarteGrise,
    status_code=status.HTTP_201_CREATED,
    summary="Uploader une carte grise (certificat d'immatriculation)",
)
async def uploader_carte_grise(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    fichier: UploadFile = File(..., description="Image de la carte grise"),
):
    """Upload et analyse OCR d'une carte grise."""
    return await service.traiter_upload_carte_grise(
        session=session, utilisateur=utilisateur, fichier=fichier,
    )


@routeur_carte_grise.get(
    "/historique",
    response_model=ListeVerificationsCarteGrise,
    summary="Historique des cartes grises scannées",
)
async def historique_carte_grise(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    limite: int = 20,
):
    """Liste l'historique des cartes grises scannées."""
    return await service.obtenir_historique_carte_grise(
        session=session, utilisateur=utilisateur, limite=limite,
    )
