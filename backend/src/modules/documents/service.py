# -*- coding: utf-8 -*-
"""
Service Documents — upload, listing, suppression.
"""
from typing import Optional
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Document, Utilisateur
from src.modules.documents.extraction import extraire_texte_depuis_upload
from src.modules.documents.schemas import DocumentDetail, ListeDocuments
from src.modules.gamification import service_badges, service_tracking
from src.noyau import journal
from src.noyau.exceptions import ErreurRessourceIntrouvable


async def uploader_document(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier: UploadFile,
) -> Document:
    """
    Upload un fichier et stocke son texte extrait pour usage par le chatbot.
    """
    # Extraire le texte (vérifie aussi le type MIME et la taille)
    contenu_texte, type_mime, taille = await extraire_texte_depuis_upload(fichier)

    # Construire un petit résumé (premiers 500 caractères)
    resume = contenu_texte[:2000]
    if len(contenu_texte) > 2000:
        resume = resume.rsplit(" ", 1)[0] + "..."  # Coupe au dernier mot complet

    # Enregistrer en base
    document = Document(
        utilisateur_id=utilisateur.id,
        nom_fichier=fichier.filename or "sans_nom",
        type_mime=type_mime,
        taille_octets=taille,
        contenu_texte=contenu_texte,
        resume=resume,
    )
    session.add(document)
    await session.commit()
    await session.refresh(document)

    await service_tracking.tracker_action(session, utilisateur, "document_upload")
    await service_badges.verifier_et_debloquer_badges(session, utilisateur)
    await session.commit()

    journal.info(
        f"Document uploadé : utilisateur={utilisateur.id} "
        f"nom='{document.nom_fichier}' taille={taille}"
    )
    return document


async def lister_documents(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> ListeDocuments:
    """Liste tous les documents de l'utilisateur."""
    resultat = await session.execute(
        select(Document)
        .where(Document.utilisateur_id == utilisateur.id)
        .order_by(desc(Document.cree_le))
    )
    documents = resultat.scalars().all()

    taille_totale = sum(d.taille_octets for d in documents)
    return ListeDocuments(
        documents=[DocumentDetail.model_validate(d) for d in documents],
        total=len(documents),
        taille_totale_octets=taille_totale,
    )


async def supprimer_document(
    session: AsyncSession,
    utilisateur: Utilisateur,
    document_id: UUID,
) -> None:
    """Supprime un document — uniquement si son propriétaire est l'appelant."""
    resultat = await session.execute(
        select(Document).where(
            Document.id == document_id,
            Document.utilisateur_id == utilisateur.id,  # Sécurité : on filtre par owner
        )
    )
    document = resultat.scalar_one_or_none()
    if document is None:
        raise ErreurRessourceIntrouvable(
            f"Document {document_id} introuvable pour utilisateur {utilisateur.id}",
            message_utilisateur="Document introuvable ou tu n'as pas le droit de le supprimer.",
        )

    await session.delete(document)
    await session.commit()
    journal.info(f"Document supprimé : id={document_id} utilisateur={utilisateur.id}")


async def obtenir_textes_documents(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 5,
) -> list[tuple[str, str]]:
    """
    Récupère le contenu textuel des N documents les plus récents de l'utilisateur.
    Utilisé par le chatbot pour construire son contexte de réponse.

    Retour :
        Liste de tuples (nom_fichier, contenu_texte)
    """
    resultat = await session.execute(
        select(Document)
        .where(Document.utilisateur_id == utilisateur.id)
        .order_by(desc(Document.cree_le))
        .limit(limite)
    )
    return [(d.nom_fichier, d.contenu_texte) for d in resultat.scalars().all()]
