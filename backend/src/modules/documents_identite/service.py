# -*- coding: utf-8 -*-
"""
Service Documents d'Identité — logique métier.

Fonctionnalités :
  - Ajouter un document (CNI, Permis, Assurance)
  - Lister les documents de l'utilisateur
  - Modifier/corriger les champs d'un document
  - Supprimer (soft-delete) un document
  - Déclencher recalcul du score après modification
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import DocumentIdentite, Utilisateur
from src.modules.documents_identite.schemas import (
    DocumentIdentiteCreation,
    DocumentIdentiteDetail,
    DocumentIdentiteModification,
    ListeDocumentsIdentite,
)
from src.noyau import journal
from src.modules.scoring import declencher_recalcul_score


def _document_vers_detail(doc: DocumentIdentite) -> DocumentIdentiteDetail:
    """Convertit un objet ORM en schéma Pydantic."""
    return DocumentIdentiteDetail(
        id=doc.id,
        utilisateur_id=doc.utilisateur_id,
        type_document=doc.type_document,
        est_actif=doc.est_actif,
        source=doc.source,
        a_ete_corrige=doc.a_ete_corrige,
        verification_id=doc.verification_id,
        numero_document=doc.numero_document,
        nom_complet=doc.nom_complet,
        date_naissance=doc.date_naissance,
        lieu_naissance=doc.lieu_naissance,
        nationalite=doc.nationalite,
        sexe=doc.sexe,
        adresse=doc.adresse,
        date_delivrance=doc.date_delivrance,
        date_expiration=doc.date_expiration,
        pays_emetteur=doc.pays_emetteur,
        autorite_delivrance=doc.autorite_delivrance,
        profession=doc.profession,
        taille_cm=doc.taille_cm,
        categories_permis=doc.categories_permis,
        centre_examen=doc.centre_examen,
        numero_permis=doc.numero_permis,
        compagnie_assurance=doc.compagnie_assurance,
        type_couverture=doc.type_couverture,
        numero_contrat=doc.numero_contrat,
        immatriculation_vehicule=doc.immatriculation_vehicule,
        marque_vehicule=doc.marque_vehicule,
        modele_vehicule=doc.modele_vehicule,
        annee_vehicule=doc.annee_vehicule,
        cree_le=doc.cree_le,
        modifie_le=doc.modifie_le,
    )


async def ajouter_document(
    session: AsyncSession,
    utilisateur: Utilisateur,
    donnees: DocumentIdentiteCreation,
    adresse_ip: Optional[str] = None,
) -> DocumentIdentiteDetail:
    """
    Ajoute un nouveau document d'identité pour l'utilisateur.

    Si c'est la première création (source=manuel), on crée directement.
    Si source=ocr, l'OCR a déjà extrait les données.
    """
    doc = DocumentIdentite(
        utilisateur_id=utilisateur.id,
        type_document=donnees.type_document,
        source=donnees.source or "manuel",
        # Copier tous les champs fournis
        numero_document=donnees.numero_document,
        nom_complet=donnees.nom_complet,
        date_naissance=donnees.date_naissance,
        lieu_naissance=donnees.lieu_naissance,
        nationalite=donnees.nationalite,
        sexe=donnees.sexe,
        adresse=donnees.adresse,
        date_delivrance=donnees.date_delivrance,
        date_expiration=donnees.date_expiration,
        pays_emetteur=donnees.pays_emetteur,
        autorite_delivrance=donnees.autorite_delivrance,
        profession=donnees.profession,
        taille_cm=donnees.taille_cm,
        categories_permis=donnees.categories_permis,
        centre_examen=donnees.centre_examen,
        numero_permis=donnees.numero_permis,
        compagnie_assurance=donnees.compagnie_assurance,
        type_couverture=donnees.type_couverture,
        numero_contrat=donnees.numero_contrat,
        immatriculation_vehicule=donnees.immatriculation_vehicule,
        marque_vehicule=donnees.marque_vehicule,
        modele_vehicule=donnees.modele_vehicule,
        annee_vehicule=donnees.annee_vehicule,
    )
    session.add(doc)
    await session.commit()
    await session.refresh(doc)

    journal.info(
        f"Document ajouté : {doc.type_document} pour {utilisateur.id}"
    )

    # Recalcul score temps réel
    await declencher_recalcul_score(
        session, utilisateur, "document_identite_ajout", adresse_ip,
    )

    return _document_vers_detail(doc)


async def lister_documents(
    session: AsyncSession,
    utilisateur: Utilisateur,
    type_document: Optional[str] = None,
) -> ListeDocumentsIdentite:
    """
    Liste tous les documents actifs de l'utilisateur.

    Optionnellement filtré par type_document (cni, permis, assurance).
    """
    query = select(DocumentIdentite).where(
        DocumentIdentite.utilisateur_id == utilisateur.id,
        DocumentIdentite.est_actif.is_(True),
    )
    if type_document:
        query = query.where(DocumentIdentite.type_document == type_document)

    query = query.order_by(DocumentIdentite.type_document, DocumentIdentite.modifie_le.desc())
    resultat = await session.execute(query)
    docs = resultat.scalars().all()

    return ListeDocumentsIdentite(
        documents=[_document_vers_detail(d) for d in docs],
        total=len(docs),
    )


async def obtenir_document(
    session: AsyncSession,
    document_id: UUID,
    utilisateur: Utilisateur,
) -> Optional[DocumentIdentiteDetail]:
    """Récupère un document par son ID (vérifie le propriétaire)."""
    resultat = await session.execute(
        select(DocumentIdentite).where(
            DocumentIdentite.id == document_id,
            DocumentIdentite.utilisateur_id == utilisateur.id,
        )
    )
    doc = resultat.scalar_one_or_none()
    return _document_vers_detail(doc) if doc else None


async def modifier_document(
    session: AsyncSession,
    document_id: UUID,
    utilisateur: Utilisateur,
    donnees: DocumentIdentiteModification,
    adresse_ip: Optional[str] = None,
) -> Optional[DocumentIdentiteDetail]:
    """
    Modifie un document existant.

    Seuls les champs fournis sont mis à jour.
    Si l'utilisateur modifie un champ qui était extrait par OCR,
    on marque a_ete_corrige=True.
    """
    resultat = await session.execute(
        select(DocumentIdentite).where(
            DocumentIdentite.id == document_id,
            DocumentIdentite.utilisateur_id == utilisateur.id,
        )
    )
    doc = resultat.scalar_one_or_none()
    if not doc:
        return None

    # Appliquer les modifications non-nulles
    modifications = donnees.model_dump(exclude_none=True)
    if not modifications:
        return _document_vers_detail(doc)

    for champ, valeur in modifications.items():
        setattr(doc, champ, valeur)

    # Si l'utilisateur a modifié un champ OCR, marquer
    if doc.source == "ocr" and not doc.a_ete_corrige:
        doc.a_ete_corrige = True

    doc.modifie_le = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(doc)

    journal.info(
        f"Document modifié : {doc.type_document} de {utilisateur.id} "
        f"champs={list(modifications.keys())}"
    )

    # Recalcul score
    await declencher_recalcul_score(
        session, utilisateur, "document_identite_modification", adresse_ip,
    )

    return _document_vers_detail(doc)


async def supprimer_document(
    session: AsyncSession,
    document_id: UUID,
    utilisateur: Utilisateur,
    adresse_ip: Optional[str] = None,
) -> bool:
    """
    Supprime (soft-delete) un document.
    Retourne True si supprimé, False si introuvable.
    """
    resultat = await session.execute(
        select(DocumentIdentite).where(
            DocumentIdentite.id == document_id,
            DocumentIdentite.utilisateur_id == utilisateur.id,
        )
    )
    doc = resultat.scalar_one_or_none()
    if not doc:
        return False

    doc.est_actif = False
    await session.commit()

    journal.info(f"Document supprimé : {doc.type_document} de {utilisateur.id}")

    await declencher_recalcul_score(
        session, utilisateur, "document_identite_suppression", adresse_ip,
    )

    return True
