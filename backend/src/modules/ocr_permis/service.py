# -*- coding: utf-8 -*-
"""
Service OCR Permis — orchestration du scan et de la validation
des Permis de Conduire.
"""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modules.ocr_permis.extraction_permis import extraire_donnees_permis
from src.modules.ocr_permis.schemas import (
    DonneesPermisExtraites,
    ListeVerificationsPermis,
    ReponseUploadPermis,
    ResultatOCRPermis,
    VerificationPermisDetail,
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


def _compter_champs_extraits(donnees: DonneesPermisExtraites) -> int:
    """Compte le nombre de champs non-nuls extraits."""
    champs = [
        donnees.nom_famille, donnees.prenoms, donnees.numero_permis,
        donnees.date_naissance, donnees.categories,
    ]
    return sum(1 for c in champs if c is not None and c != [])


# =============================================================================
# Service principal
# =============================================================================
async def traiter_upload_permis(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier: UploadFile,
    face: str = "recto",
) -> ReponseUploadPermis:
    """
    Traite l'upload d'une image de permis de conduire.
    """
    contenu = await _lire_image(fichier)
    nom_fichier = fichier.filename or f"permis_{face}.jpg"
    
    # 1. Analyse OCR (à implémenter avec le moteur commun)
    # Pour l'instant, on simule une extraction basique
    texte_brut = ""  # À remplacer par l'appel à ocr_engine.analyser_image()
    confiance = 0.0
    mrz_lignes = (None, None, None)
    
    # 2. Extraction des données
    donnees = extraire_donnees_permis(
        texte_brut=texte_brut,
        confiance=confiance,
        mrz_lignes=mrz_lignes,
    )
    
    nb_champs = _compter_champs_extraits(donnees)
    succes = nb_champs >= 3  # Au moins 3 champs pour considérer comme succès
    
    # 3. Construction de la réponse
    resultat_ocr = ResultatOCRPermis(
        succes=succes,
        donnees=donnees,
        erreurs=[] if succes else ["Extraction insuffisante"],
        champs_extraits=nb_champs,
    )
    
    message = (
        "Permis scanné avec succès." if succes
        else "L'OCR n'a pas pu extraire suffisamment de données."
    )
    
    # TODO: Enregistrement en base de données (à implémenter avec le modèle DocumentIdentite)
    
    return ReponseUploadPermis(
        id=UUID("00000000-0000-0000-0000-000000000000"),  # Placeholder
        statut="approuve" if succes else "rejete",
        resultat_ocr=resultat_ocr,
        message=message,
    )


async def obtenir_historique_permis(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 20,
) -> ListeVerificationsPermis:
    """Liste l'historique des vérifications de permis."""
    # TODO: Implémenter avec le modèle VerificationPermis
    return ListeVerificationsPermis(historique=[], total=0)