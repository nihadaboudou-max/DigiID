# -*- coding: utf-8 -*-
"""
Routes API pour le module d'inspection de documents.
Endpoints universels pour tous les types de documents.
"""
from typing import Annotated, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.inspection_documents import facade, service
from src.modules.inspection_documents.schemas import (
    ListeVerifications,
    ReponseDocumentUnifie,
    ReponseSuppression,
    ReponseRestauration,
    SyntheseVerification,
    TypeDocument,
)
from src.noyau import journal
from src.noyau.exceptions import ErreurValidation

routeur_inspection = APIRouter(
    prefix="/api/v1/inspection-documents",
    tags=["Inspection Documents"],
)


@routeur_inspection.post(
    "/upload",
    response_model=ReponseDocumentUnifie,
    summary="Uploader et analyser un document (interface unique)",
)
async def upload_document(
    fichier: UploadFile = File(..., description="Image du document (JPG, PNG, WEBP)"),
    type_document: Optional[TypeDocument] = Form(
        None,
        description="Type de document (auto-détecté si non fourni)"
    ),
    face: str = Form("recto", description="Face du document : recto, verso ou unique"),
    contexte: str = Form("citoyen", description="Contexte : citoyen (auto-service) ou agent"),
    enrolement_id: Optional[UUID] = Form(
        None, description="Enrôlement cible (contexte agent uniquement)"
    ),
    utilisateur_cible_id: Optional[UUID] = Form(
        None,
        description="UUID de l'utilisateur cible (uniquement pour les agents terrain)"
    ),
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)] = None,
    session: Annotated[AsyncSession, Depends(obtenir_session)] = None,
):
    """
    Interface UNIQUE d'extraction : une seule route, une seule réponse,
    quel que soit le document (CNI, permis, assurance, carte grise,
    carte de séjour, consulaire).

    Le type est auto-détecté s'il n'est pas fourni. La réponse est toujours
    au format `ReponseDocumentUnifie`.
    """
    if face not in ("recto", "verso", "unique"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le paramètre 'face' doit être 'recto', 'verso' ou 'unique'.",
        )

    try:
        resultat = await facade.traiter(
            session=session,
            utilisateur=utilisateur,
            fichier=fichier,
            type_document=type_document,
            face=face,
            contexte=contexte,
            enrolement_id=enrolement_id,
            utilisateur_cible_id=utilisateur_cible_id,
        )

        # Recalcul du score de confiance si le document est approuvé
        if resultat.get("statut") == "approuve":
            try:
                from src.modules.scoring.service import declencher_recalcul_score
                await declencher_recalcul_score(
                    session=session,
                    utilisateur=utilisateur,
                    raison="upload_document_valide",
                )
            except Exception as e:
                journal.warning(f"Échec recalcul score : {e}")

        return resultat

    except ErreurValidation as e:
        journal.warning(f"Validation échouée : {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message_utilisateur or str(e),
        )
    except Exception as e:
        journal.exception(f"Erreur upload document : {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors du traitement : {str(e)}",
        )


@routeur_inspection.get(
    "/synthese",
    response_model=SyntheseVerification,
    summary="Synthèse des vérifications de documents",
)
async def synthese_verification(
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)] = None,
    session: Annotated[AsyncSession, Depends(obtenir_session)] = None,
):
    """Retourne la synthèse des dernières vérifications de documents."""
    return await service.obtenir_synthese_verification(
        session=session,
        utilisateur=utilisateur,
    )


@routeur_inspection.get(
    "/historique",
    response_model=ListeVerifications,
    summary="Historique des vérifications de documents",
)
async def historique_verifications(
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)] = None,
    session: Annotated[AsyncSession, Depends(obtenir_session)] = None,
    limite: int = 20,
):
    """Retourne l'historique des vérifications de documents de l'utilisateur."""
    return await service.obtenir_historique(
        session=session,
        utilisateur=utilisateur,
        limite=limite,
    )


@routeur_inspection.delete(
    "/{verification_id}",
    response_model=ReponseSuppression,
    summary="Supprimer une vérification de document",
)
async def supprimer_verification(
    verification_id: UUID,
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)] = None,
    session: Annotated[AsyncSession, Depends(obtenir_session)] = None,
):
    """Supprime (soft-delete) une vérification de document."""
    return await service.supprimer_verification(
        session=session,
        utilisateur=utilisateur,
        verification_id=verification_id,
    )


@routeur_inspection.post(
    "/{verification_id}/restaurer",
    response_model=ReponseRestauration,
    summary="Restaurer une vérification de document",
)
async def restaurer_verification(
    verification_id: UUID,
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)] = None,
    session: Annotated[AsyncSession, Depends(obtenir_session)] = None,
):
    """Restaure une vérification de document depuis la corbeille."""
    return await service.restaurer_verification(
        session=session,
        utilisateur=utilisateur,
        verification_id=verification_id,
    )