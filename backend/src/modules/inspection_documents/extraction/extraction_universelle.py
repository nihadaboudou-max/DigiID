# -*- coding: utf-8 -*-
"""
Point d'entrée unique pour l'extraction universelle de documents.
Classifie le document, puis applique la stratégie d'extraction adaptée.
"""
from typing import Dict, Optional
from src.modules.inspection_documents.schemas import TypeDocument, DonneesDocumentExtraites
from src.modules.inspection_documents.extraction.ocr_engine import analyser_document
from src.modules.inspection_documents.extraction.mrz_parser import parser_mrz_complet
from src.modules.inspection_documents.extraction.nlp_extractor import (
    extraire_permis_conduire, extraire_carte_assurance, extraire_par_labels
)
from src.modules.inspection_documents.extraction.fusion_engine import fusionner_donnees
from src.noyau.journal import journal

# Patterns de classification
PATTERNS_CLASSIFICATION = {
    TypeDocument.PASSEPORT: [r"PASSEPORT", r"PASSPORT", r"P<"],
    TypeDocument.CNI_BIOMETRIQUE: [r"CARTE\s*NATIONALE\s*D[''`]IDENTIT[EÉ]", r"CNI", r"I<"],
    TypeDocument.PERMIS_CONDUIRE: [r"PERMIS\s*DE\s*CONDUIRE", r"DRIVING\s*LICENCE", r"CAT[ÉE]GORIE"],
    TypeDocument.CARTE_ASSURANCE: [r"CARTE\s*VERTE", r"ATTESTATION\s*D[''`]ASSURANCE", r"POLICE\s*N[°O]"],
}

# Patterns d'extraction par labels (Fallback générique)
PATTERNS_LABELS = {
    "nom_famille": [r"NOM\s*[:\-]?\s*", r"SURNAME\s*[:\-]?\s*"],
    "prenoms": [r"PR[ÉE]NOM(?:S)?\s*[:\-]?\s*", r"GIVEN\s*NAMES?\s*[:\-]?\s*"],
    "date_naissance": [r"N[ÉE]\s*LE?\s*[:\-]?\s*", r"DATE\s*(?:DE)?\s*NAISSANCE\s*[:\-]?\s*"],
    "sexe": [r"SEXE\s*[:\-]?\s*", r"SEX\s*[:\-]?\s*"],
}

def classifier_document(texte: str, mrz_lignes: tuple) -> TypeDocument:
    """Détermine le type de document avant l'extraction."""
    texte_upper = texte.upper()
    
    # 1. Si MRZ présente, c'est facile
    if mrz_lignes and mrz_lignes[0]:
        if mrz_lignes[0].startswith("P<") or mrz_lignes[0].startswith("P "):
            return TypeDocument.PASSEPORT
        if "ID" in mrz_lignes[0] or mrz_lignes[0].startswith("I<"):
            return TypeDocument.CNI_BIOMETRIQUE
            
    # 2. Détection par mots-clés
    for type_doc, patterns in PATTERNS_CLASSIFICATION.items():
        for pattern in patterns:
            if __import__('re').search(pattern, texte_upper):
                return type_doc
                
    return TypeDocument.INCONNU

def extraire_donnees_universelles(donnees_image: bytes) -> DonneesDocumentExtraites:
    """Pipeline complet : Analyse -> Classification -> Extraction -> Fusion."""
    
    # 1. Analyse OCR & MRZ
    resultat_ocr = analyser_document(donnees_image)
    texte = resultat_ocr["texte_brut"]
    mrz_lignes = resultat_ocr["mrz_lignes"]
    
    # 2. Classification
    type_document = classifier_document(texte, mrz_lignes)
    journal.info(f"Document classifié comme : {type_document}")
    
    # 3. Parsing MRZ (si présente)
    donnees_mrz = {}
    if mrz_lignes and mrz_lignes[0] and mrz_lignes[1]:
        donnees_mrz = parser_mrz_complet(mrz_lignes[0], mrz_lignes[1], mrz_lignes[2] if len(mrz_lignes) > 2 else None)
        
    # 4. Extraction NLP/Regex selon le type
    donnees_nlp = {}
    if type_document == TypeDocument.PERMIS_CONDUIRE:
        donnees_nlp = extraire_permis_conduire(texte)
    elif type_document == TypeDocument.CARTE_ASSURANCE:
        donnees_nlp = extraire_carte_assurance(texte)
    else:
        # Fallback générique pour CNI Papier ou Inconnu
        donnees_nlp = extraire_par_labels(texte, PATTERNS_LABELS)
        
    # Ajouter les données techniques au dictionnaire NLP
    donnees_nlp["texte_brut"] = texte
    donnees_nlp["confiance"] = resultat_ocr["confiance_moyenne"]
    donnees_nlp["mrz_ligne_1"] = mrz_lignes[0] if mrz_lignes else None
    donnees_nlp["mrz_ligne_2"] = mrz_lignes[1] if mrz_lignes and len(mrz_lignes) > 1 else None
    donnees_nlp["mrz_ligne_3"] = mrz_lignes[2] if mrz_lignes and len(mrz_lignes) > 2 else None
    
    # 5. Fusion intelligente
    return fusionner_donnees(donnees_nlp, donnees_mrz, type_document)