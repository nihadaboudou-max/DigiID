# -*- coding: utf-8 -*-
"""
Classificateur intelligent de documents d'identité.
Détecte le type de document (CNI, passeport, permis, assurance, etc.)
en utilisant une approche multi-niveaux :
1. Détection MRZ (la plus fiable)
2. Patterns regex (fallback)
3. Heuristiques supplémentaires
"""
import re
from typing import Optional
from src.modules.inspection_documents.schemas import TypeDocument
from src.modules.inspection_documents.classification.patterns_documents import PATTERNS_CLASSIFICATION
from src.noyau.journal import journal


def classifier_document(texte_brut: str, mrz_lignes: tuple) -> TypeDocument:
    """
    Classifie le type de document en analysant le texte OCR et la MRZ.
    
    Stratégie :
    1. Si MRZ présente → détection par le code type (P<, I<, A<, etc.)
    2. Sinon → patterns regex sur le texte
    3. Fallback → INCONNU
    
    Args:
        texte_brut: Texte complet extrait par OCR
        mrz_lignes: Tuple des lignes MRZ (l1, l2, l3)
    
    Returns:
        TypeDocument détecté
    """
    if not texte_brut and not any(mrz_lignes):
        journal.warning("Classification impossible : pas de texte ni de MRZ")
        return TypeDocument.INCONNU
    
    texte_upper = texte_brut.upper() if texte_brut else ""
    
    # ── NIVEAU 1 : Détection par MRZ (la plus fiable) ──
    if mrz_lignes and mrz_lignes[0]:
        l1 = mrz_lignes[0].upper()
        
        # Passeport (commence par P< ou P )
        if l1.startswith("P<") or l1.startswith("P "):
            journal.info(f"Document classifié comme PASSEPORT via MRZ (code: {l1[:2]})")
            return TypeDocument.PASSEPORT
        
        # Carte d'identité (commence par I< ou ID)
        if l1.startswith("I<") or l1.startswith("ID"):
            journal.info(f"Document classifié comme CNI_BIOMETRIQUE via MRZ (code: {l1[:2]})")
            return TypeDocument.CNI_BIOMETRIQUE
        
        # Carte de séjour (commence par A< ou AC)
        if l1.startswith("A<") or l1.startswith("AC"):
            journal.info(f"Document classifié comme CARTE_SEJOUR via MRZ (code: {l1[:2]})")
            return TypeDocument.CARTE_SEJOUR
    
    # ── NIVEAU 2 : Patterns regex sur le texte ──
    for type_str, patterns in PATTERNS_CLASSIFICATION.items():
        for pattern in patterns:
            if re.search(pattern, texte_upper, re.IGNORECASE):
                # Convertir string en enum
                try:
                    type_doc = TypeDocument(type_str)
                    journal.info(f"Document classifié comme {type_doc.value} via pattern regex")
                    return type_doc
                except ValueError:
                    journal.warning(f"Type de document inconnu : {type_str}")
                    continue
    
    # ── NIVEAU 3 : Heuristiques supplémentaires ──
    # Si on a une MRZ mais qu'on n'a pas réussi à la classifier
    if mrz_lignes and mrz_lignes[0]:
        journal.info("MRZ présente mais type non détecté → CNI_BIOMETRIQUE par défaut")
        return TypeDocument.CNI_BIOMETRIQUE
    
    # ── FALLBACK ──
    journal.warning("Type de document non détecté → INCONNU")
    return TypeDocument.INCONNU


def detecter_pays(texte_brut: str, mrz_lignes: tuple) -> Optional[str]:
    """
    Détecte le pays émetteur du document.
    
    Priorité :
    1. Code pays dans la MRZ (positions 2-4 de la ligne 1)
    2. Patterns regex dans le texte
    
    Args:
        texte_brut: Texte complet extrait par OCR
        mrz_lignes: Tuple des lignes MRZ
    
    Returns:
        Code pays ICAO (ex: "SEN", "CIV") ou None
    """
    # ── NIVEAU 1 : MRZ ──
    if mrz_lignes and mrz_lignes[0] and len(mrz_lignes[0]) >= 5:
        code_pays = mrz_lignes[0][2:5].strip("<")
        if code_pays and code_pays.isalpha():
            journal.info(f"Pays détecté via MRZ : {code_pays}")
            return code_pays
    
    # ── NIVEAU 2 : Patterns texte ──
    # (À implémenter selon les besoins spécifiques)
    
    return None