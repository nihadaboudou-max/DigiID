# -*- coding: utf-8 -*-
"""
Classificateur intelligent de documents d'identité.
Détecte le type de document (CNI, passeport, permis, assurance, etc.)
en utilisant une approche multi-niveaux.
"""
import re
from typing import Optional
from src.modules.inspection_documents.schemas import TypeDocument
from src.modules.inspection_documents.classification.patterns_documents import PATTERNS_CLASSIFICATION
from src.noyau.journal import journal


def classifier_document(texte_brut: str, mrz_lignes: tuple) -> TypeDocument:
    """
    Classifie le type de document en analysant le texte OCR et la MRZ.
    """
    if not texte_brut and not any(mrz_lignes):
        journal.warning("Classification impossible : pas de texte ni de MRZ")
        return TypeDocument.INCONNU
    
    texte_upper = texte_brut.upper() if texte_brut else ""
    
    # ── NIVEAU 0 : Détection explicite prioritaire (Assurance) ──
    # On vérifie ça AVANT tout pour éviter qu'un "CNI N°" dans une assurance ne la fasse classifier comme CNI
    if "CONTRAT D'ASSURANCE" in texte_upper or "ATTESTATION D'ASSURANCE" in texte_upper or "CARTE VERTE" in texte_upper:
        journal.info("Document classifié comme CARTE_ASSURANCE (motif explicite prioritaire)")
        return TypeDocument.CARTE_ASSURANCE

    # ── NIVEAU 1 : Détection par MRZ (la plus fiable) ──
    if mrz_lignes and mrz_lignes[0]:
        l1 = mrz_lignes[0].upper()
        
        if l1.startswith("P<") or l1.startswith("P "):
            journal.info(f"Document classifié comme PASSEPORT via MRZ (code: {l1[:2]})")
            return TypeDocument.PASSEPORT
        
        if l1.startswith("I<") or l1.startswith("ID"):
            journal.info(f"Document classifié comme CNI_BIOMETRIQUE via MRZ (code: {l1[:2]})")
            return TypeDocument.CNI_BIOMETRIQUE
        
        if l1.startswith("A<") or l1.startswith("AC"):
            journal.info(f"Document classifié comme CARTE_SEJOUR via MRZ (code: {l1[:2]})")
            return TypeDocument.CARTE_SEJOUR
    
    # ── NIVEAU 2 : Patterns regex sur le texte ──
    for type_str, patterns in PATTERNS_CLASSIFICATION.items():
        for pattern in patterns:
            if re.search(pattern, texte_upper, re.IGNORECASE):
                try:
                    type_doc = TypeDocument(type_str)
                    journal.info(f"Document classifié comme {type_doc.value} via pattern regex")
                    return type_doc
                except ValueError:
                    continue
    
    # ── NIVEAU 3 : Heuristiques supplémentaires ──
    if mrz_lignes and mrz_lignes[0]:
        journal.info("MRZ présente mais type non détecté → CNI_BIOMETRIQUE par défaut")
        return TypeDocument.CNI_BIOMETRIQUE
    
    # ── FALLBACK ──
    journal.warning("Type de document non détecté → INCONNU")
    return TypeDocument.INCONNU


def detecter_pays(texte_brut: str, mrz_lignes: tuple) -> Optional[str]:
    """
    Détecte le pays émetteur du document.
    """
    if mrz_lignes and mrz_lignes[0] and len(mrz_lignes[0]) >= 5:
        code_pays = mrz_lignes[0][2:5].strip("<")
        if code_pays and code_pays.isalpha():
            journal.info(f"Pays détecté via MRZ : {code_pays}")
            return code_pays
    
    return None