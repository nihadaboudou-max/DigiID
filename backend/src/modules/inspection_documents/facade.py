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
    adapter_passeport,
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
    TypeDocument.PASSEPORT: adapter_passeport,
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


def _extraire_champ(donnees: Dict[str, Any], *cles: str) -> Optional[str]:
    """Renvoie la 1re valeur non vide parmi les clés données (sinon None)."""
    for cle in cles:
        valeur = donnees.get(cle)
        if valeur not in (None, "", [], {}):
            return str(valeur)
    return None


async def _enregistrer_historique(
    session: AsyncSession,
    utilisateur: Utilisateur,
    resultat: Dict[str, Any],
    nom_fichier: str,
    type_mime: str,
    taille_octets: int,
    face: str,
) -> None:
    """Journalise le scan dans la table centrale `inspection_documents`.

    C'est cette table que lit l'historique du frontend : sans cet écrit, les
    documents scannés via l'interface unique n'apparaîtraient pas.
    """
    from src.modeles.inspection_document import InspectionDocument

    donnees: Dict[str, Any] = resultat.get("donnees") or {}
    statut = str(resultat.get("statut") or "en_attente")

    confiance = 0.0
    for cle in ("taux_confiance_ocr", "taux_confiance_moyen", "confiance"):
        try:
            if donnees.get(cle) is not None:
                confiance = float(donnees[cle])
                break
        except (TypeError, ValueError):
            continue

    document = InspectionDocument(
        utilisateur_id=utilisateur.id,
        type_document=str(resultat.get("type_document") or "inconnu"),
        face=face,
        nom_fichier=nom_fichier,
        type_mime=type_mime,
        taille_octets=taille_octets,
        nom_famille=_extraire_champ(donnees, "nom_famille", "nom", "titulaire_nom"),
        prenoms=_extraire_champ(donnees, "prenoms", "prenom", "titulaire_prenoms"),
        date_naissance=_extraire_champ(donnees, "date_naissance"),
        date_expiration=_extraire_champ(donnees, "date_expiration"),
        nationalite=_extraire_champ(donnees, "nationalite"),
        numero_document=_extraire_champ(
            donnees,
            "numero_document",
            "numero_immatriculation",
            "numero_police",
            "numero_chassis",
            "numero_carte",
        ),
        texte_brut=(resultat.get("texte_brut") or None),
        donnees_specifiques=donnees,
        statut=statut,
        est_valide=(statut == "approuve"),
        taux_confiance_ocr=confiance,
    )
    session.add(document)
    await session.commit()


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

    # 4. Délégation : l'adaptateur lit le fichier (position 0).
    resultat = await adaptateur(
        session,
        utilisateur,
        fichier,
        face=face,
        contexte=contexte,
        enrolement_id=enrolement_id,
        utilisateur_cible_id=utilisateur_cible_id,
    )

    # 5. Historique unifié : on journalise le scan dans la table centrale.
    try:
        await _enregistrer_historique(
            session=session,
            utilisateur=utilisateur,
            resultat=resultat,
            nom_fichier=fichier.filename or "document",
            type_mime=fichier.content_type or "image/jpeg",
            taille_octets=len(contenu),
            face=face,
        )
    except Exception as e:  # pragma: no cover - ne doit jamais casser l'upload
        journal.warning(f"Façade : échec enregistrement historique ({e})")

    return resultat
