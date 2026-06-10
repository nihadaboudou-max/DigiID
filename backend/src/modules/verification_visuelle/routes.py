# -*- coding: utf-8 -*-
"""Routes API du module de vérification visuelle."""
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant, obtenir_ip_client, obtenir_agent_utilisateur
from src.modules.verification_visuelle import service
from src.modules.verification_visuelle.schemas import (
    ListeVerificationVisuelle,
    SuppressionVerification,
    RestaurationVerification,
    VerificationVisuelleDetail,
)


routeur_verification = APIRouter(
    prefix="/api/v1/utilisateur/verification",
    tags=["Vérification Visuelle"],
)


@routeur_verification.post(
    "",
    response_model=VerificationVisuelleDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Uploader une photo pour vérification visuelle du visage",
)
async def uploader_photo(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    adresse_ip: Annotated[str, Depends(obtenir_ip_client)],
    user_agent: Annotated[str, Depends(obtenir_agent_utilisateur)],
    fichier: UploadFile = File(..., description="Photo du visage au format JPG ou PNG"),
):
    verification = await service.traiter_upload_photo(
        session=session,
        utilisateur=utilisateur,
        fichier=fichier,
        adresse_ip=adresse_ip,
        user_agent=user_agent,
        )
    return VerificationVisuelleDetail(
        id=verification.id,
        statut=verification.statut,
        raison=verification.raison,
        score_liveness=verification.score_liveness,
        score_similarite=verification.score_similarite,
        date_upload=verification.cree_le,
        date_verification=verification.date_verification,
        est_supprime=verification.est_supprime,
        date_suppression=verification.date_suppression,
        details=verification.details,
    )


@routeur_verification.get(
    "/statut",
    response_model=VerificationVisuelleDetail,
    summary="Obtenir le statut de la dernière vérification visuelle",
)
async def statut_verification(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    return await service.obtenir_statut_verification(session=session, utilisateur=utilisateur)


@routeur_verification.get(
    "/historique",
    response_model=ListeVerificationVisuelle,
    summary="Lister l'historique des uploads de photo de vérification",
)
async def historique_verification(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    return await service.obtenir_historique_verification(session=session, utilisateur=utilisateur)


@routeur_verification.delete(
    "/{verification_id}",
    response_model=SuppressionVerification,
    summary="Supprimer une vérification visuelle (corbeille)",
)
async def supprimer_verification(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    verification_id: str,
):
    """Déplace une vérification dans la corbeille (soft-delete)."""
    return await service.supprimer_verification(
        session=session,
        utilisateur=utilisateur,
        verification_id=verification_id,
    )


@routeur_verification.patch(
    "/{verification_id}/restaurer",
    response_model=RestaurationVerification,
    summary="Restaurer une vérification depuis la corbeille",
)
async def restaurer_verification(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    verification_id: str,
):
    """Restaure une vérification depuis la corbeille."""
    return await service.restaurer_verification(
        session=session,
        utilisateur=utilisateur,
        verification_id=verification_id,
    )
