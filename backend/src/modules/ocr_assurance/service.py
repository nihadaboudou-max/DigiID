# -*- coding: utf-8 -*-
"""
Service OCR Assurance — orchestration du scan et de la validation
des Cartes Vertes et Attestations d'Assurance.
"""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modeles.assurance_auto import AssuranceAuto
from src.modules.ocr_assurance.extraction_assurance import extraire_donnees_assurance
from src.modules.ocr_assurance.schemas import (
    DonneesAssuranceExtraites,
    ListeVerificationsAssurance,
    ReponseUploadAssurance,
    ResultatOCRAssurance,
    VerificationAssuranceDetail,
)
from src.noyau import journal
from src.noyau.exceptions import ErreurValidation


# =============================================================================
# Constantes
# =============================================================================
TAILLE_MAX_IMAGE = 15 * 1024 * 1024  # 15 Mo
TYPES_MIME_AUTORISES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


# =============================================================================
# Fonctions internes
# =============================================================================
async def _lire_image(fichier: UploadFile) -> bytes:
    """Lit et valide le fichier image uploadé."""
    if fichier.content_type not in TYPES_MIME_AUTORISES:
        raise ErreurValidation(
            f"Type MIME refusé : {fichier.content_type}",
            message_utilisateur="Format d'image non supporté. Utilise JPG, PNG ou WEBP.",
        )
    contenu = await fichier.read()
    if not contenu:
        raise ErreurValidation("Fichier vide reçu.", message_utilisateur="Le fichier est vide.")
    if len(contenu) > TAILLE_MAX_IMAGE:
        raise ErreurValidation(
            f"Image trop volumineuse : {len(contenu)} octets",
            message_utilisateur=f"L'image dépasse {TAILLE_MAX_IMAGE // 1024 // 1024} Mo.",
        )
    return contenu


def _compter_champs_extraits(donnees: DonneesAssuranceExtraites) -> int:
    """Compte le nombre de champs non-nuls extraits."""
    champs = [
        donnees.compagnie_assurance,
        donnees.numero_contrat,
        donnees.immatriculation_vehicule,
        donnees.date_expiration,
    ]
    return sum(1 for c in champs if c is not None)


# =============================================================================
# Service principal
# =============================================================================
async def traiter_upload_assurance(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier: UploadFile,
) -> ReponseUploadAssurance:
    """
    Traite l'upload d'une image de carte verte / attestation d'assurance.
    """
    contenu = await _lire_image(fichier)
    nom_fichier = fichier.filename or "assurance.jpg"
    
    # 1. Analyse OCR
    texte_brut = ""  # À remplacer par : ocr_engine.analyser_image(contenu)
    confiance = 0.0
    
    # 2. Extraction des données
    donnees = extraire_donnees_assurance(
        texte_brut=texte_brut,
        confiance=confiance,
    )
    
    nb_champs = _compter_champs_extraits(donnees)
    succes = nb_champs >= 2  # Au moins 2 champs critiques (compagnie + immat ou contrat)
    
    # Validation stricte des champs obligatoires
    if not succes or not donnees.immatriculation_vehicule or not donnees.numero_contrat:
        return ReponseUploadAssurance(
            id=UUID("00000000-0000-0000-0000-000000000000"),
            statut="rejete",
            resultat_ocr=ResultatOCRAssurance(
                succes=False,
                donnees=donnees,
                erreurs=["Extraction insuffisante des champs critiques (immatriculation, contrat)"],
                champs_extraits=nb_champs,
            ),
            message="L'OCR n'a pas pu extraire l'immatriculation ou le numéro de contrat.",
        )
    
    # 3. Sauvegarde en base de données
    nouvelle_assurance = AssuranceAuto(
        utilisateur_id=utilisateur.id,
        compagnie_assurance=donnees.compagnie_assurance or "Inconnue",
        numero_contrat=donnees.numero_contrat,
        immatriculation=donnees.immatriculation_vehicule.upper(),
        marque_vehicule=donnees.marque_vehicule,
        modele_vehicule=donnees.modele_vehicule,
        date_effet=donnees.date_effet,
        date_expiration=donnees.date_expiration,
        est_active=True,
    )
    
    session.add(nouvelle_assurance)
    await session.commit()
    await session.refresh(nouvelle_assurance)
    
    journal.info(f"Assurance enregistrée : {nouvelle_assurance.numero_contrat} pour user {utilisateur.id}")
    
    # 4. Construction de la réponse
    resultat_ocr = ResultatOCRAssurance(
        succes=True,
        donnees=donnees,
        erreurs=[],
        champs_extraits=nb_champs,
    )
    
    return ReponseUploadAssurance(
        id=nouvelle_assurance.id,  # ✅ VRAI UUID de la base
        statut="approuve",
        resultat_ocr=resultat_ocr,
        message="Assurance enregistrée avec succès.",
    )


async def obtenir_historique_assurance(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 20,
) -> ListeVerificationsAssurance:
    """Liste l'historique des vérifications d'assurance."""
    # ✅ REQUÊTE RÉELLE vers la base de données
    resultat = await session.execute(
        select(AssuranceAuto)
        .where(AssuranceAuto.utilisateur_id == utilisateur.id)
        .order_by(desc(AssuranceAuto.cree_le))
        .limit(limite)
    )
    enregistrements = resultat.scalars().all()
    
    historique = [
        VerificationAssuranceDetail(
            id=assurance.id,
            utilisateur_id=assurance.utilisateur_id,
            statut="approuve" if assurance.est_active else "expiree",
            nom_fichier=f"assurance_{assurance.immatriculation}.jpg",
            compagnie_assurance=assurance.compagnie_assurance,
            numero_contrat=assurance.numero_contrat,
            immatriculation_vehicule=assurance.immatriculation,
            marque_vehicule=assurance.marque_vehicule,
            date_expiration=assurance.date_expiration.isoformat() if assurance.date_expiration else None,
            taux_confiance_ocr=None,
            cree_le=assurance.cree_le,
            est_supprime=False,
        )
        for assurance in enregistrements
    ]
    
    return ListeVerificationsAssurance(historique=historique, total=len(historique))