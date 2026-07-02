# -*- coding: utf-8 -*-
"""
Routes API pour l'OCR CNI — upload, vérification, synthèse.
"""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.ocr_cni import service
from src.modules.ocr_cni.schemas import (
    ListeVerificationsCNI,
    SuppressionCNI,
    RestaurationCNI,
    SyntheseVerificationCNI,
)
# ✅ CORRECTION : import direct depuis service (évite le cycle via __init__.py)
from src.modules.scoring.service import declencher_recalcul_score
from src.noyau import journal

routeur_ocr_cni = APIRouter(
    prefix="/api/v1/utilisateur/verification-cni",
    tags=["OCR CNI"],
)


@routeur_ocr_cni.post(
    "/upload",
    summary="Uploader et analyser une face de CNI",
)
async def upload_cni(
    fichier: UploadFile = File(...),
    face: str = "recto",
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)] = None,
    session: Annotated[AsyncSession, Depends(obtenir_session)] = None,
):
    """
    Upload une image de CNI (recto ou verso) et lance l'analyse OCR.
    Retourne les données extraites et le résultat de validation.
    """
    if face not in ("recto", "verso"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le paramètre 'face' doit être 'recto' ou 'verso'.",
        )

    try:
        resultat = await service.traiter_upload_cni(
            session=session,
            utilisateur=utilisateur,
            fichier=fichier,
            face=face,
        )

        # Déclencher un recalcul du score après upload CNI validé
        if resultat.get("validation") and resultat["validation"].est_valide:
            try:
                await declencher_recalcul_score(
                    session=session,
                    utilisateur=utilisateur,
                    raison="upload_cni_valide",
                )
            except Exception as e:
                journal.warning(f"Échec recalcul score après upload CNI : {e}")

        return resultat

    except Exception as e:
        journal.exception(f"Erreur upload CNI : {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors du traitement : {str(e)}",
        )


@routeur_ocr_cni.get(
    "/synthese",
    response_model=SyntheseVerificationCNI,
    summary="Synthèse des vérifications CNI",
)
async def synthese_verification(
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)] = None,
    session: Annotated[AsyncSession, Depends(obtenir_session)] = None,
):
    """
    Retourne la synthèse des dernières vérifications CNI (recto + verso)
    avec validation croisée.
    """
    return await service.obtenir_synthese_verification(
        session=session,
        utilisateur=utilisateur,
    )


@routeur_ocr_cni.get(
    "/historique",
    response_model=ListeVerificationsCNI,
    summary="Historique des vérifications CNI",
)
async def historique_verifications(
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)] = None,
    session: Annotated[AsyncSession, Depends(obtenir_session)] = None,
    limite: int = 20,
):
    """Retourne l'historique des vérifications CNI de l'utilisateur."""
    return await service.obtenir_verifications(
        session=session,
        utilisateur=utilisateur,
        limite=limite,
    )


@routeur_ocr_cni.delete(
    "/{verification_id}",
    response_model=SuppressionCNI,
    summary="Supprimer une vérification CNI",
)
async def supprimer_verification(
    verification_id: UUID,
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)] = None,
    session: Annotated[AsyncSession, Depends(obtenir_session)] = None,
):
    """Supprime (soft-delete) une vérification CNI."""
    return await service.supprimer_verification(
        session=session,
        utilisateur=utilisateur,
        verification_id=verification_id,
    )


@routeur_ocr_cni.post(
    "/{verification_id}/restaurer",
    response_model=RestaurationCNI,
    summary="Restaurer une vérification CNI",
)
async def restaurer_verification(
    verification_id: UUID,
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)] = None,
    session: Annotated[AsyncSession, Depends(obtenir_session)] = None,
):
    """Restaure une vérification CNI depuis la corbeille."""
    return await service.restaurer_verification(
        session=session,
        utilisateur=utilisateur,
        verification_id=verification_id,
    )