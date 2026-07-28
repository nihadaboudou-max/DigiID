# -*- coding: utf-8 -*-
"""
Routes API du module de vérification visuelle.
Préfixe : /api/v1/utilisateur/verification
Gère l'upload, le statut, l'historique, la suppression/restauration
et la comparaison biométrique avec les documents d'identité.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import (
    obtenir_agent_utilisateur,
    obtenir_ip_client,
    utilisateur_courant,
)
from src.modules.scoring import declencher_recalcul_score
from src.modules.verification_visuelle import service
from src.modules.verification_visuelle.schemas import (
    ListeVerificationVisuelle,
    RestaurationVerification,
    SuppressionVerification,
    VerificationVisuelleDetail,
)
from src.noyau import journal as journal_module
from src.noyau.journal import enregistrer_evenement_audit

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
    """Traite l'upload d'une photo et lance la vérification biométrique."""
    verification = await service.traiter_upload_photo(
        session=session,
        utilisateur=utilisateur,
        fichier=fichier,
        adresse_ip=adresse_ip,
        user_agent=user_agent,
    )
    
    await enregistrer_evenement_audit(
        session=session,
        type_evenement="verification_visuelle_upload",
        description=f"Upload photo visage — statut: {verification.statut} score_liveness: {verification.score_liveness}",
        utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
    )
    
    # Upload photo = signal positif → recalcul du score
    try:
        await declencher_recalcul_score(
            session=session,
            utilisateur=utilisateur,
            raison="upload_photo_visage",
            adresse_ip=adresse_ip,
        )
    except Exception as e:
        journal_module.warning(f"Recalcul score ignoré (upload_photo) : {e}")
    
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
    response_model=VerificationVisuelleDetail | None,
    summary="Obtenir le statut de la dernière vérification visuelle",
)
async def statut_verification(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Retourne la dernière vérification visuelle de l'utilisateur."""
    resultat = await service.obtenir_statut_verification(
        session=session,
        utilisateur=utilisateur,
    )
    if resultat is None:
        return Response(status_code=204)
    return resultat


@routeur_verification.get(
    "/historique",
    response_model=ListeVerificationVisuelle,
    summary="Lister l'historique des uploads de photo de vérification",
)
async def historique_verification(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    limite: int = 20,
):
    """Liste les vérifications visuelles de l'utilisateur."""
    return await service.obtenir_historique_verification(
        session=session,
        utilisateur=utilisateur,
        limite=limite,
    )


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
    await enregistrer_evenement_audit(
        session=session,
        type_evenement="verification_visuelle_suppression",
        description=f"Suppression vérification visuelle {verification_id}",
        utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
    )
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


# ✅ NOUVEAU : Route pour comparer la photo de profil avec un document
@routeur_verification.post(
    "/comparer-photo-profil",
    summary="Comparer la photo de profil avec la photo d'un document",
)
async def comparer_photo_profil(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    document_id: str = "",
):
    """
    Compare l'empreinte faciale de l'utilisateur (photo de profil)
    avec l'embedding de la dernière vérification visuelle.
    Retourne le score de confiance et le verdict.
    Seuil de validation : 0.6
    """
    resultat = await service.comparer_photo_profil_document(
        session=session,
        utilisateur=utilisateur,
        document_id=document_id,
    )
    return resultat