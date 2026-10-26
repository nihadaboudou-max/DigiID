# -*- coding: utf-8 -*-
"""Routes API pour le module OCR CIP (Certificat d'Identification Personnelle)."""
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.ocr_cip import service
from src.modules.ocr_cip.schemas import ListeVerificationsCIP, ReponseUploadCIP

routeur_cip = APIRouter(
    prefix="/api/v1/utilisateur/cip",
    tags=["OCR CIP"],
)


@routeur_cip.post(
    "/upload",
    response_model=ReponseUploadCIP,
    status_code=status.HTTP_201_CREATED,
    summary="Uploader un Certificat d'Identification Personnelle (CIP)",
)
async def uploader_cip(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    fichier: UploadFile = File(..., description="Image du CIP"),
):
    """Upload et analyse OCR d'un CIP (NPI, QR, visage)."""
    return await service.traiter_upload_cip(
        session=session, utilisateur=utilisateur, fichier=fichier,
    )


@routeur_cip.get(
    "/historique",
    response_model=ListeVerificationsCIP,
    summary="Historique des CIP scannés",
)
async def historique_cip(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    limite: int = 20,
):
    """Liste l'historique des CIP scannés."""
    return await service.obtenir_historique_cip(
        session=session, utilisateur=utilisateur, limite=limite,
    )
