# -*- coding: utf-8 -*-
"""Façade UNIQUE d'extraction de documents."""
from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError  # ✅ AJOUT : Pour gérer les doublons proprement

from src.modeles import Utilisateur
from src.modeles.base_document import table_pour_type
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
from src.noyau.exceptions import ErreurValidation # ✅ AJOUT : Pour ne pas avaler les rejets métier

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
    """Détecte le type de document avec le classifieur existant."""
    try:
        from src.modules.inspection_documents.extraction.ocr_engine import analyser_document
        resultat = analyser_document(contenu)
        texte_brut = resultat.get("texte_brut") or ""
        mrz_lignes = resultat.get("mrz_lignes") or (None, None, None)
    except Exception as e:
        journal.warning(f"Façade : OCR de classification échoué ({e})")
        texte_brut, mrz_lignes = "", (None, None, None)

    return classifier_document(texte_brut, mrz_lignes)


def _extraire_champ(donnees: Dict[str, Any], *cles: str) -> Optional[str]:
    """Renvoie la 1re valeur non vide parmi les clés données."""
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
    """Journalise le scan dans la table centrale `inspection_documents`."""
    from src.modeles.inspection_document import InspectionDocument

    donnees: Dict[str, Any] = resultat.get("donnees") or {}
    statut = str(resultat.get("statut") or "en_attente")
    type_document = str(resultat.get("type_document") or "inconnu")

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
        type_document=type_document,
        face=face,
        nom_fichier=nom_fichier,
        type_mime=type_mime,
        taille_octets=taille_octets,
        table_cible=table_pour_type(type_document),
        document_id=str(resultat.get("identifiant") or "") or None,
        nom_famille=_extraire_champ(donnees, "nom_famille", "nom", "titulaire_nom"),
        prenoms=_extraire_champ(donnees, "prenoms", "prenom", "titulaire_prenoms"),
        date_naissance=_extraire_champ(donnees, "date_naissance"),
        date_delivrance=_extraire_champ(donnees, "date_delivrance"),
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
        statut=statut,
        est_valide=(statut == "approuve"),
        taux_confiance_ocr=confiance,
    )
    
    # ✅ CORRECTION : Gestion propre des doublons (IntegrityError)
    try:
        session.add(document)
        await session.commit()
    except IntegrityError:
        # Le document existe déjà (même numéro + même type). 
        # On annule l'insertion mais on ne fait PAS planter tout le système.
        await session.rollback()
        journal.info(f"Historique déjà présent pour {document.numero_document} ({type_document}), insertion ignorée.")
    except Exception as e:
        # Pour toute autre erreur DB, on rollback et on log, mais on ne bloque pas l'OCR
        await session.rollback()
        journal.error(f"Échec inattendu enregistrement historique : {e}")


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
    except Exception:
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
            message="Type de document non supporté.",
        )

    # 4. Délégation : l'adaptateur lit le fichier.
    # ⚠️ SI l'adaptateur lève une ErreurValidation (ex: document expiré), 
    # elle doit remonter directement à FastAPI pour bloquer la requête (code 400).
    resultat = await adaptateur(
        session,
        utilisateur,
        fichier,
        face=face,
        contexte=contexte,
        enrolement_id=enrolement_id,
        utilisateur_cible_id=utilisateur_cible_id,
    )

    # 5. Historique unifié : on journalise le scan.
    # On le fait même en cas de rejet pour garder une trace, mais sans faire planter si doublon.
    await _enregistrer_historique(
        session=session,
        utilisateur=utilisateur,
        resultat=resultat,
        nom_fichier=fichier.filename or "document",
        type_mime=fichier.content_type or "image/jpeg",
        taille_octets=len(contenu),
        face=face,
    )

    return resultat