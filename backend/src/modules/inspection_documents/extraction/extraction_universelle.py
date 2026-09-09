# -*- coding: utf-8 -*-
"""
Point d'entrée unique pour l'extraction universelle de documents.
Classifie le document, puis applique la stratégie d'extraction adaptée.
"""
import re
from typing import Dict, Optional
from src.modules.inspection_documents.schemas import TypeDocument, DonneesDocumentExtraites
from src.modules.inspection_documents.extraction.ocr_engine import analyser_document
from src.modules.inspection_documents.extraction.mrz_parser import parser_mrz_complet
from src.modules.inspection_documents.extraction.nlp_extractor import (
    extraire_permis_conduire, extraire_carte_assurance, extraire_par_labels
)
from src.modules.inspection_documents.extraction.fusion_engine import fusionner_donnees
from src.modules.inspection_documents.classification.document_classifier import classifier_document
from src.modules.inspection_documents.classification.patterns_documents import PATTERNS_GENERIQUES
from src.noyau.journal import journal


def classifier_document_universel(texte: str, mrz_lignes: tuple) -> TypeDocument:
    """Délègue au classificateur robuste (MRZ > regex > heuristique)."""
    return classifier_document(texte, mrz_lignes)

def extraire_donnees_universelles(donnees_image: bytes) -> DonneesDocumentExtraites:
    """Pipeline complet : Analyse -> Classification -> Extraction -> Fusion."""
    
    # 1. Analyse OCR & MRZ
    resultat_ocr = analyser_document(donnees_image)
    texte = resultat_ocr["texte_brut"]
    mrz_lignes = resultat_ocr["mrz_lignes"]
    
        # 2. Classification
    type_document = classifier_document_universel(texte, mrz_lignes)
    journal.info(f"Document classifié comme : {type_document}")
    
    # 3. Parsing MRZ (si présente)
    donnees_mrz = {}
    if mrz_lignes and mrz_lignes[0] and mrz_lignes[1]:
        donnees_mrz = parser_mrz_complet(mrz_lignes[0], mrz_lignes[1], mrz_lignes[2] if len(mrz_lignes) > 2 else None)
        
        # 4. Extraction : identité commune (tous types) + spécifique selon le type
    donnees_nlp = extraire_par_labels(texte, PATTERNS_GENERIQUES)

    if not donnees_nlp.get("numero_document") and not donnees_mrz.get("numero_document"):
        m_num = re.search(
            r"(?:N[°O]|NUM[ÉE]RO)\s*(?:D['`]?IDENTIT[ÉE]|CNI|PASSEPORT|PERMIS)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\s\-]{5,19})",
            texte, re.IGNORECASE)
        if m_num:
            numero = re.sub(r"[^A-Z0-9]", "", m_num.group(1).upper())
            if 5 <= len(numero) <= 20:
                donnees_nlp["numero_document"] = numero

    if type_document == TypeDocument.PERMIS_CONDUIRE:
        extraits = extraire_permis_conduire(texte)
    elif type_document == TypeDocument.CARTE_ASSURANCE:
        extraits = extraire_carte_assurance(texte)
    else:
        extraits = {}

    champs_communs = {"numero_document", "date_expiration", "date_delivrance",
                      "nom_famille", "prenoms", "date_naissance", "sexe"}
    donnees_specifiques = {}
    for cle, valeur in (extraits or {}).items():
        if not valeur:
            continue
        if cle in champs_communs:
            donnees_nlp.setdefault(cle, valeur)
        else:
            donnees_specifiques[cle] = valeur

    # Ajouter les données techniques au dictionnaire NLP
    donnees_nlp["donnees_specifiques"] = donnees_specifiques
    donnees_nlp["texte_brut"] = texte
    donnees_nlp["confiance"] = resultat_ocr["confiance_moyenne"]
    donnees_nlp["mrz_ligne_1"] = mrz_lignes[0] if mrz_lignes else None
    donnees_nlp["mrz_ligne_2"] = mrz_lignes[1] if mrz_lignes and len(mrz_lignes) > 1 else None
    donnees_nlp["mrz_ligne_3"] = mrz_lignes[2] if mrz_lignes and len(mrz_lignes) > 2 else None

    # 5. Fusion intelligente (MRZ prioritaire)
    return fusionner_donnees(donnees_nlp, donnees_mrz, type_document)