# -*- coding: utf-8 -*-
"""
Routes API du module OCR CNI — Scan et authentification de la CNI.

Prefixe : /api/v1/utilisateur/verification-cni

Endpoints :
  POST   /upload                  Uploader une face (recto/verso) de la CNI
  GET    /synthese                Synthèse de la dernière vérification complète
  GET    /                        Historique des vérifications CNI
  DELETE /{id}                    Supprimer une vérification (corbeille)
  PATCH  /{id}/restaurer          Restaurer une vérification
"""
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.ocr_cni import service
from src.modules.ocr_cni.schemas import (
    ListeVerificationsCNI,
    ReponseUploadCNI,
    ResultatOCRCNI,
    SyntheseVerificationCNI,
    SuppressionCNI,
    RestaurationCNI,
    UploadCNIRequete,
)


routeur_ocr_cni = APIRouter(
    prefix="/api/v1/utilisateur/verification-cni",
    tags=["OCR CNI — Scan de Carte d'Identité"],
)


@routeur_ocr_cni.post(
    "/upload",
    response_model=ReponseUploadCNI,
    status_code=status.HTTP_201_CREATED,
    summary="Uploader une face de CNI pour OCR et authentification",
    description=(
        "Upload une photo du recto ou du verso de la Carte Nationale d'Identité. "
        "L'image est analysée par OCR (Tesseract) pour extraire automatiquement "
        "tous les champs : nom, prénom, numéro de carte, dates, MRZ, etc. "
        "Les données sont ensuite validées (format, checksum MRZ, cohérence)."
    ),
)
async def uploader_cni(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    fichier: UploadFile = File(..., description="Photo de la CNI (JPG, PNG, WEBP)"),
    face: str = Form(
        default="recto",
        description="Face de la carte : 'recto' ou 'verso'",
        pattern="^(recto|verso)$",
    ),
):
    """Upload une face de CNI et lance l'analyse OCR complète."""
    resultat = await service.traiter_upload_cni(
        session=session,
        utilisateur=utilisateur,
        fichier=fichier,
        face=face,
    )

    return ReponseUploadCNI(
        id=resultat["id"],
        face=resultat["face"],
        statut=resultat["statut"],
        resultat_ocr=ResultatOCRCNI(
            succes=resultat["resultat_ocr"]["succes"],
            donnees=resultat["resultat_ocr"]["donnees"],
            erreurs=resultat["resultat_ocr"]["erreurs"],
            champs_extraits=resultat["resultat_ocr"]["champs_extraits"],
            temps_analyse_ms=resultat["resultat_ocr"]["temps_analyse_ms"],
        ),
        message=resultat["message"],
    )


@routeur_ocr_cni.get(
    "/synthese",
    response_model=SyntheseVerificationCNI,
    summary="Synthèse de la dernière vérification CNI complète",
    description=(
        "Retourne la synthèse combinée des dernières analyses recto et verso. "
        "Effectue une validation croisée entre les deux faces et retourne "
        "le statut global de la vérification d'identité."
    ),
)
async def synthese_verification(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Obtient la synthèse de la dernière vérification complète (recto+verso)."""
    return await service.obtenir_synthese_verification(
        session=session,
        utilisateur=utilisateur,
    )


@routeur_ocr_cni.get(
    "",
    response_model=ListeVerificationsCNI,
    summary="Historique des vérifications CNI",
)
async def lister_verifications(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    limite: int = Query(default=20, ge=1, le=100, description="Nombre max de résultats"),
):
    """Liste l'historique des scans CNI effectués par l'utilisateur."""
    return await service.obtenir_verifications(
        session=session,
        utilisateur=utilisateur,
        limite=limite,
    )


@routeur_ocr_cni.delete(
    "/{verification_id}",
    response_model=SuppressionCNI,
    summary="Supprimer une vérification CNI (corbeille)",
)
async def supprimer_verification(
    verification_id: str,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Déplace une vérification CNI dans la corbeille (soft-delete)."""
    import uuid
    try:
        uid = uuid.UUID(verification_id)
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="ID de vérification invalide.")

    return await service.supprimer_verification(
        session=session,
        utilisateur=utilisateur,
        verification_id=uid,
    )


@routeur_ocr_cni.patch(
    "/{verification_id}/restaurer",
    response_model=RestaurationCNI,
    summary="Restaurer une vérification CNI depuis la corbeille",
)
async def restaurer_verification(
    verification_id: str,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Restaure une vérification CNI depuis la corbeille."""
    import uuid
    try:
        uid = uuid.UUID(verification_id)
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="ID de vérification invalide.")

    return await service.restaurer_verification(
        session=session,
        utilisateur=utilisateur,
        verification_id=uid,
    )
