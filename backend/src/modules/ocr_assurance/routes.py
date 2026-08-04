# -*- coding: utf-8 -*-
"""Routes API pour le module OCR Assurance Automobile."""
from typing import Annotated

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.ocr_assurance import service
from src.modules.ocr_assurance.schemas import (
    AssuranceModification,
    ListeVerificationsAssurance,
    ReponseUploadAssurance,
    VerificationAssuranceDetail,
)

routeur_assurance = APIRouter(
    prefix="/api/v1/utilisateur/assurance",
    tags=["OCR Assurance Automobile"],
)


@routeur_assurance.post(
    "/upload",
    response_model=ReponseUploadAssurance,
    status_code=status.HTTP_201_CREATED,
    summary="Uploader une carte verte / attestation d'assurance",
)
async def uploader_assurance(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    fichier: UploadFile = File(..., description="Image de la carte verte ou attestation"),
):
    """Upload et analyse OCR d'un document d'assurance automobile."""
    return await service.traiter_upload_assurance(
        session=session,
        utilisateur=utilisateur,
        fichier=fichier,
    )


@routeur_assurance.patch(
    "/{assurance_id}",
    response_model=VerificationAssuranceDetail,
    summary="Corriger les champs non sensibles d'une assurance",
)
async def modifier_assurance(
    assurance_id: str,
    donnees: AssuranceModification,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """
    Corrige UNIQUEMENT les champs non sensibles (marque / modèle du véhicule).
    L'identité et les données officielles restent verrouillées.
    """
    resultat = await service.modifier_assurance(
        session=session,
        utilisateur=utilisateur,
        assurance_id=UUID(assurance_id),
        donnees=donnees,
    )
    if not resultat:
        raise HTTPException(status_code=404, detail="Document d'assurance introuvable")
    return resultat


@routeur_assurance.get(
    "/historique",
    response_model=ListeVerificationsAssurance,
    summary="Historique des vérifications d'assurance",
)
async def historique_assurance(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    limite: int = 20,
):
    """Liste l'historique des assurances scannées."""
    return await service.obtenir_historique_assurance(
        session=session,
        utilisateur=utilisateur,
        limite=limite,
    )