# -*- coding: utf-8 -*-
"""
Routes API du module documents d'identité.

Préfixe : /api/v1/utilisateur/documents-identite
Toutes les routes nécessitent une authentification utilisateur.
"""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import (
    admin_courant, utilisateur_courant, obtenir_ip_client,
)
from src.modules.documents_identite import service
from src.modules.documents_identite.schemas import (
    DocumentIdentiteCreation,
    DocumentIdentiteDetail,
    DocumentIdentiteModification,
    ListeDocumentsIdentite,
)

routeur_documents = APIRouter(
    prefix="/api/v1/utilisateur/documents-identite",
    tags=["Documents d'identité"],
)


@routeur_documents.get(
    "",
    response_model=ListeDocumentsIdentite,
    summary="Lister mes documents d'identité",
)
async def lister_mes_documents(
    requete: Request,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    type_document: Optional[str] = Query(
        None,
        regex="^(cni|passeport|permis|assurance|carte_sejour|carte_consulaire|carte_grise)$",
    ),
):
    """Retourne tous les documents d'identité actifs de l'utilisateur.

    ⚠️ Le filtre accepte désormais AUSSI les titres d'identité autres que la
    CNI (passeport, carte de séjour, carte consulaire) : ils sont marqués dans
    cette table au moment de leur scan.
    """
    return await service.lister_documents(
        session=session,
        utilisateur=utilisateur,
        type_document=type_document,
    )


@routeur_documents.post(
    "",
    response_model=DocumentIdentiteDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Ajouter un document d'identité",
)
async def ajouter_document(
    requete: Request,
    donnees: DocumentIdentiteCreation,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """
    Ajoute un nouveau document d'identité (CNI, Permis, Assurance).

    L'utilisateur peut fournir les champs qu'il souhaite.
    Si les données viennent de l'OCR, préciser source="ocr".
    """
    return await service.ajouter_document(
        session=session,
        utilisateur=utilisateur,
        donnees=donnees,
        adresse_ip=obtenir_ip_client(requete),
    )


@routeur_documents.get(
    "/{document_id}",
    response_model=DocumentIdentiteDetail,
    summary="Obtenir un document spécifique",
)
async def obtenir_document(
    requete: Request,
    document_id: str,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Retourne un document d'identité par son ID."""
    from uuid import UUID
    doc = await service.obtenir_document(
        session=session,
        document_id=UUID(document_id),
        utilisateur=utilisateur,
    )
    if not doc:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Document introuvable")
    return doc


@routeur_documents.patch(
    "/{document_id}",
    response_model=DocumentIdentiteDetail,
    summary="Modifier/corriger un document",
)
async def modifier_document(
    requete: Request,
    document_id: str,
    donnees: DocumentIdentiteModification,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """
    Modifie un ou plusieurs champs d'un document.

    Utile pour corriger les erreurs d'extraction OCR :
    l'utilisateur voit les données extraites et peut corriger
    chaque champ individuellement.
    """
    from uuid import UUID
    doc = await service.modifier_document(
        session=session,
        document_id=UUID(document_id),
        utilisateur=utilisateur,
        donnees=donnees,
        adresse_ip=obtenir_ip_client(requete),
    )
    if not doc:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Document introuvable")
    return doc


@routeur_documents.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un document",
)
async def supprimer_document(
    requete: Request,
    document_id: str,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """Supprime (soft-delete) un document d'identité."""
    from uuid import UUID
    supprime = await service.supprimer_document(
        session=session,
        document_id=UUID(document_id),
        utilisateur=utilisateur,
        adresse_ip=obtenir_ip_client(requete),
    )
    if not supprime:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Document introuvable")


@routeur_documents.post(
    "/{document_id}/verifier-coherence",
    summary="Vérifier la cohérence entre le profil et un document",
)
async def verifier_coherence_document(
    requete: Request,
    document_id: str,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """
    Compare les données du profil (nom/prénom chiffrés) avec
    les données du document d'identité.
    Retourne les incohérences détectées.
    """
    from uuid import UUID
    resultat = await service.verifier_coherence_profil_document(
        session=session,
        utilisateur=utilisateur,
        document_id=UUID(document_id),
    )
    return resultat


@routeur_documents.post(
    "/synchroniser-profil",
    summary="Synchroniser le statut de vérification d'identité",
)
async def synchroniser_profil(
    requete: Request,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    """
    Vérifie si toutes les conditions sont remplies pour marquer
    l'utilisateur comme vérifié (CNI + Visage + Document cohérent).
    Met à jour est_verifie_identite si OK.
    """
    resultat = await service.synchroniser_profil_document(
        session=session,
        utilisateur=utilisateur,
    )
    return resultat


# =============================================================================
# 僶. Champs RÉGLEMENTAIRES — réservés à l'administrateur système (S3)
# -----------------------------------------------------------------------------
# Le numéro de pièce et les dates de délivrance/expiration sont IMMUABLES côté
# utilisateur (voir `CHAMPS_NON_MODIFIABLES`). Seul un administrateur peut les
# corriger — avec un motif, tracé au journal — par exemple après une erreur de
# saisie ou un renouvellement de titre.
# =============================================================================

from datetime import date as _date

from pydantic import BaseModel, Field


class CorrectionReglementaire(BaseModel):
    """Correction d'un champ réglementaire par un administrateur."""

    numero_document: Optional[str] = Field(None, max_length=50)
    date_delivrance: Optional[_date] = None
    date_expiration: Optional[_date] = None
    motif: str = Field(..., min_length=3, max_length=255)


@routeur_documents.patch(
    "/{document_id}/reglementaire",
    response_model=DocumentIdentiteDetail,
    summary="Corriger un champ réglementaire (administrateur uniquement)",
)
async def corriger_champ_reglementaire(
    document_id: str,
    donnees: CorrectionReglementaire,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    administrateur: Annotated[Utilisateur, Depends(admin_courant)],
):
    """Met à jour le numéro de pièce ou les dates d'un document.

    Réservé aux administrateurs : l'utilisateur ne peut jamais modifier ces
    champs lui-même (immuabilité réglementaire). Le motif est journalisé.
    """
    from uuid import UUID
    doc = await service.modifier_champs_reglementaires_admin(
        session=session,
        document_id=UUID(document_id),
        numero_document=donnees.numero_document,
        date_delivrance=donnees.date_delivrance,
        date_expiration=donnees.date_expiration,
        motif=f"{donnees.motif} (par {administrateur.id})",
    )
    if not doc:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Document introuvable")
    return doc