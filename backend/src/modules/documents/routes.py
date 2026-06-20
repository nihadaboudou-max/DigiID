# -*- coding: utf-8 -*-
"""Routes API du module documents."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.noyau.journal import enregistrer_evenement_audit
from src.modules.documents import service
from src.modules.documents.schemas import DocumentDetail, ListeDocuments


routeur_documents = APIRouter(
    prefix="/api/v1/utilisateur/documents",
    tags=["Documents pour chatbot"],
)


@routeur_documents.post(
    "",
    response_model=DocumentDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Uploader un document (PDF, TXT, MD) pour enrichir le chatbot",
)
async def uploader(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    fichier: UploadFile = File(..., description="Fichier à uploader (max 5 Mo)"),
):
    """Upload un fichier. Le texte est extrait et stocké pour usage par ton chatbot."""
    document = await service.uploader_document(session, utilisateur, fichier)
    await enregistrer_evenement_audit(
        session=session,
        type_evenement="document_upload",
        description=f"Upload document {fichier.filename} ({fichier.content_type})",
        utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
    )
    return DocumentDetail.model_validate(document)


@routeur_documents.get(
    "",
    response_model=ListeDocuments,
    summary="Lister mes documents uploadés",
)
async def lister(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    return await service.lister_documents(session, utilisateur)


@routeur_documents.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un document",
)
async def supprimer(
    document_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    doc = await service.obtenir_document(session, utilisateur, document_id)
    await service.supprimer_document(session, utilisateur, document_id)
    await enregistrer_evenement_audit(
        session=session,
        type_evenement="document_suppression",
        description=f"Suppression document {doc.nom_original if doc else document_id}",
        utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
    )
