# -*- coding: utf-8 -*-
"""
Classificateur intelligent de documents d'identité.
Détecte le type de document (CNI, passeport, permis, assurance, etc.)
en utilisant une approche multi-niveaux.
"""
import re
import unicodedata
from typing import Optional
from src.modules.inspection_documents.schemas import TypeDocument
from src.modules.inspection_documents.classification.patterns_documents import PATTERNS_CLASSIFICATION
from src.noyau.journal import journal


# Marqueurs FORTS d'une assurance. On les teste en PRIORITÉ ABSOLUE : une
# attestation d'assurance reprend les caractéristiques du véhicule
# (« 1ère mise en circulation », « puissance fiscale », n° de châssis/VIN,
# immatriculation) et serait sinon confondue avec une carte grise.
MARQUEURS_ASSURANCE = (
    "ASSURANCE",
    "ASSUREUR",
    "CARTE VERTE",
    "RESPONSABILITE CIVILE",
    "TOUS RISQUES",
    "SINISTRE",
    "PRIME D'ASSURANCE",
)

# Marqueur EXPLICITE d'une carte grise (titre "certificat d'immatriculation"),
# tolérant aux variantes d'apostrophe/espaces produites par l'OCR.
MOTIF_CARTE_GRISE = re.compile(
    r"(CARTE\s*GRISE|CERTIFICAT\s*D['`\u2019]?\s*IMMATRICULATION)"
)


def _normaliser_texte(texte: str) -> str:
    """Majuscules + suppression des accents (matching robuste aux erreurs OCR)."""
    texte = unicodedata.normalize("NFKD", texte or "")
    texte = "".join(c for c in texte if not unicodedata.combining(c))
    return texte.upper()


def classifier_document(texte_brut: str, mrz_lignes: tuple) -> TypeDocument:
    """
    Classifie le type de document en analysant le texte OCR et la MRZ.
    """
    if not texte_brut and not any(mrz_lignes):
        journal.warning("Classification impossible : pas de texte ni de MRZ")
        return TypeDocument.INCONNU
    
    texte_upper = texte_brut.upper() if texte_brut else ""
    texte_norm = _normaliser_texte(texte_brut)

    # ── NIVEAU 0 : Détection explicite prioritaire ──
    # 0.a) ASSURANCE EN PREMIER. C'est le point clé : une carte grise et une
    #      attestation d'assurance partagent des champs véhicule. Dès qu'un
    #      marqueur d'assurance est présent, on tranche pour l'assurance.
    if any(marqueur in texte_norm for marqueur in MARQUEURS_ASSURANCE):
        journal.info("Document classifié comme CARTE_ASSURANCE (marqueur d'assurance prioritaire)")
        return TypeDocument.CARTE_ASSURANCE

    # 0.b) CARTE GRISE uniquement sur un titre explicite ("CARTE GRISE" ou
    #      "CERTIFICAT D'IMMATRICULATION"), jamais sur un simple champ véhicule.
    if MOTIF_CARTE_GRISE.search(texte_norm):
        journal.info("Document classifié comme CARTE_GRISE (titre explicite)")
        return TypeDocument.CARTE_GRISE

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