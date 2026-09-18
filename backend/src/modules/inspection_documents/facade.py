# -*- coding: utf-8 -*-
"""Façade UNIQUE d'extraction de documents.

Un seul point d'entrée pour les 6 documents supportés :
  1. lit le fichier une fois (et le rend rejouable via seek(0)),
  2. détecte automatiquement le type si non fourni (classifieur existant),
  3. délègue à l'adaptateur dédié au type,
  4. renvoie TOUJOURS la même réponse unifiée.

Chaque document garde SON extracteur, SON schéma et SA table : la façade
ne fait que l'aiguillage + l'harmonisation du format de réponse.
"""
from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modules.inspection_documents.adaptateurs import (
    adapter_assurance,
    adapter_carte_grise,
    adapter_carte_sejour,
    adapter_cni,
    adapter_consulaire,
    adapter_permis,
)
from src.modules.inspection_documents.adaptateurs.commun import reponse_unifiee
from src.modules.inspection_documents.classification.document_classifier import classifier_document
from src.modules.inspection_documents.schemas import TypeDocument
from src.noyau import journal

# Table d'aiguillage : type → adaptateur.
ADAPTATEURS = {
    TypeDocument.CNI_BIOMETRIQUE: adapter_cni,
    TypeDocument.CNI_PAPIER: adapter_cni,
    TypeDocument.PERMIS_CONDUIRE: adapter_permis,
    TypeDocument.CARTE_ASSURANCE: adapter_assurance,
    TypeDocument.CARTE_GRISE: adapter_carte_grise,
    TypeDocument.CARTE_SEJOUR: adapter_carte_sejour,
    TypeDocument.CARTE_CONSULAIRE: adapter_consulaire,
}


def _detecter_type(contenu: bytes) -> TypeDocument:
    """Détecte le type de document avec le classifieur existant (aucun nouvel OCR)."""
    try:
        from src.modules.inspection_documents.extraction.ocr_engine import analyser_document

        resultat = analyser_document(contenu)
        texte_brut = resultat.get("texte_brut") or ""
        mrz_lignes = resultat.get("mrz_lignes") or (None, None, None)
    except Exception as e:  # pragma: no cover - dépend de Tesseract
        journal.warning(f"Façade : OCR de classification échoué ({e})")
        texte_brut, mrz_lignes = "", (None, None, None)

    return classifier_document(texte_brut, mrz_lignes)


async def traiter(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier: UploadFile,
    type_document: Optional[TypeDocument] = None,
    face: str = "recto",
    contexte: str = "citoyen",
    enrolement_id: Optional[UUID] = None,
    utilisateur_cible_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    """Traite un document et renvoie la réponse unifiée (dict)."""
    # 1. Lire le contenu UNE seule fois, puis rendre le flux rejouable.
    contenu = await fichier.read()
    try:
        await fichier.seek(0)
    except Exception:  # pragma: no cover - certains pseudo-fichiers ne supportent pas seek
        journal.warning("Façade : impossible de remettre le curseur du fichier à zéro.")

    # 2. Résoudre le type (auto-détection si absent).
    if type_document is None or type_document == TypeDocument.INCONNU:
        type_detecte = _detecter_type(contenu)
        type_final = type_detecte if type_detecte != TypeDocument.INCONNU else (type_document or TypeDocument.INCONNU)
        journal.info(f"Façade : type auto-détecté = {type_final.value}")
    else:
        type_final = type_document

    # 3. Aiguillage vers l'adaptateur.
    adaptateur = ADAPTATEURS.get(type_final)
    if adaptateur is None:
        return reponse_unifiee(
            type_final.value if hasattr(type_final, "value") else str(type_final),
            statut="rejete",
            message="Type de document non supporté par l'interface unifiée "
                    "(documents pris en charge : CNI, permis, assurance, carte grise, "
                    "carte de séjour, consulaire).",
        )

    # 4. Délégation : l'adaptateur lit le fichier (position 0) et renvoie la réponse unifiée.
    return await adaptateur(
        session,
        utilisateur,
        fichier,
        face=face,
        contexte=contexte,
        enrolement_id=enrolement_id,
        utilisateur_cible_id=utilisateur_cible_id,
    )
