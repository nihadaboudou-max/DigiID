# -*- coding: utf-8 -*-
"""
Extraction des champs d'un Permis de Conduire.
Réutilise les fonctions communes de l'OCR CNI.
"""
import re
from typing import Optional

# Import des fonctions communes depuis le module CNI
from src.modules.ocr_cni.extraction_cni import (
    _nettoyer_texte,
    _extraire_valeur_label,
    _extraire_generique,
    PATTERN_DATE,
)
from src.modules.ocr_permis.schemas import DonneesPermisExtraites
from src.noyau.journal import journal


# =============================================================================
# PATTERNS SPÉCIFIQUES AU PERMIS DE CONDUIRE
# =============================================================================
PATTERNS_PERMIS: dict = {
    # ── PERMIS CÔTE D'IVOIRE ────────────────────────────
    "permis_cote_ivoire": {
        "indices_reconnaissance": [
            r"PERMIS\s*DE\s*CONDUIRE",
            r"R[EÉ]PUBLIQUE\s*DE\s*C[OÔ]TE\s*D[''` ]IVOIRE",
            r"MINIST[EÈ]RE\s*DE\s*L[''` ]INT[EÉ]RIEUR",
        ],
        "champs": {
            "nom": [r"NOM\s*[:\-]?\s*"],
            "prenoms": [r"PR[EÉ]NOM(?:S)?\s*[:\-]?\s*"],
            "date_naissance": [r"N[EÉ]\s*LE?\s*[:\-]?\s*", r"DATE\s*DE\s*NAISSANCE\s*"],
            "lieu_naissance": [r"[Ll][iée]u?\s*de?\s*naissance\s*"],
            "numero_permis": [r"N[°o]\s*PERMIS\s*[:\-]?\s*", r"NUM[EÉ]RO\s*[:\-]?\s*"],
            "date_premiere_delivrance": [r"PREMI[EÈ]RE\s*D[EÉ]LIVRANCE\s*[:\-]?\s*"],
            "date_delivrance": [r"D[EÉ]LIVR[EÉ]\s*LE?\s*[:\-]?\s*"],
            "date_expiration": [r"VALABLE\s*JUSQU[''` ]AU?\s*[:\-]?\s*", r"EXPIRATION\s*"],
            "autorite_delivrance": [r"AUTORIT[EÉ]\s*DE\s*D[EÉ]LIVRANCE\s*"],
            "categories": [r"CATEGORIE(?:S)?\s*[:\-]?\s*([A-Z,\s]+)"],
        },
    },
    
    # ── PERMIS SÉNÉGAL ──────────────────────────────────
    "permis_senegal": {
        "indices_reconnaissance": [
            r"R[EÉ]PUBLIQUE\s*DU\s*S[EÉ]N[EÉ]GAL",
            r"PERMIS\s*DE\s*CONDUIRE",
        ],
        "champs": {
            "nom": [r"NOM\s*"],
            "prenoms": [r"PR[EÉ]NOM(?:S)?\s*"],
            "date_naissance": [r"N[EÉ]\s*LE?\s*"],
            "numero_permis": [r"N[°o]\s*"],
            "date_delivrance": [r"D[EÉ]LIVR[EÉ]\s*LE?\s*"],
            "categories": [r"CATEGORIE(?:S)?\s*([A-Z,\s]+)"],
        },
    },
    
    # ── PERMIS BÉNIN ────────────────────────────────────
    "permis_benin": {
        "indices_reconnaissance": [
            r"R[EÉ]PUBLIQUE\s*DU\s*B[EÉ]NIN",
            r"PERMIS\s*DE\s*CONDUIRE",
        ],
        "champs": {
            "nom": [r"NOM\s*"],
            "prenoms": [r"PR[EÉ]NOM(?:S)?\s*"],
            "date_naissance": [r"N[EÉ]\s*LE?\s*"],
            "numero_permis": [r"N[°o]\s*"],
            "date_delivrance": [r"D[EÉ]LIVR[EÉ]\s*LE?\s*"],
        },
    },
}


# =============================================================================
# Fonctions d'extraction
# =============================================================================

def _detecter_pays_permis(texte: str) -> Optional[str]:
    """Détecte le pays émetteur du permis."""
    texte_upper = texte.upper()
    for pays, config in PATTERNS_PERMIS.items():
        for indice in config["indices_reconnaissance"]:
            if re.search(indice, texte_upper):
                journal.info(f"Permis détecté : {pays}")
                return pays
    return None


def _extraire_categories(texte: str) -> list[str]:
    """Extrait les catégories de permis (A, B, C, etc.)."""
    categories = []
    # Pattern générique pour trouver les catégories
    match = re.search(r"CATEGORIE(?:S)?\s*[:\-]?\s*([A-Z,\s]+)", texte, re.IGNORECASE)
    if match:
        cats_str = match.group(1)
        categories = [c.strip() for c in cats_str.split(",") if c.strip()]
    
    # Fallback : chercher des lettres isolées A, B, C, D, E, F, G
    if not categories:
        for cat in ["A", "B", "C", "D", "E", "F", "G"]:
            if re.search(rf"\b{cat}\b", texte):
                categories.append(cat)
    
    return categories


def extraire_donnees_permis(
    texte_brut: str,
    confiance: float = 0.0,
    mrz_lignes: tuple = (None, None, None),
) -> DonneesPermisExtraites:
    """
    Extrait les champs d'un permis de conduire depuis le texte OCR.
    """
    if not texte_brut:
        return DonneesPermisExtraites(texte_brut="", taux_confiance_moyen=confiance)

    texte = _nettoyer_texte(texte_brut)
    
    # 1. Détection du pays
    pays = _detecter_pays_permis(texte)
    
    # 2. Initialisation des variables
    nom = None
    prenoms = None
    date_naissance = None
    lieu_naissance = None
    numero_permis = None
    date_premiere_delivrance = None
    date_delivrance = None
    date_expiration = None
    autorite = None
    categories = []
    
    # 3. Extraction par patterns spécifiques
    if pays and pays in PATTERNS_PERMIS:
        champs = PATTERNS_PERMIS[pays]["champs"]
        nom = _extraire_valeur_label(texte, champs.get("nom", []), "nom")
        prenoms = _extraire_valeur_label(texte, champs.get("prenoms", []), "prenoms")
        date_naissance = _extraire_valeur_label(texte, champs.get("date_naissance", []), "date_naissance")
        lieu_naissance = _extraire_valeur_label(texte, champs.get("lieu_naissance", []), "lieu_naissance")
        numero_permis = _extraire_valeur_label(texte, champs.get("numero_permis", []), "numero")
        date_premiere_delivrance = _extraire_valeur_label(texte, champs.get("date_premiere_delivrance", []), "date_delivrance")
        date_delivrance = _extraire_valeur_label(texte, champs.get("date_delivrance", []), "date_delivrance")
        date_expiration = _extraire_valeur_label(texte, champs.get("date_expiration", []), "date_expiration")
        autorite = _extraire_valeur_label(texte, champs.get("autorite_delivrance", []), "autorite")
        categories = _extraire_categories(texte)
    
    # 4. Fallback générique si extraction spécifique échoue
    if not all([nom, prenoms, numero_permis]):
        journal.info("Extraction spécifique permis infructueuse, tentative générique...")
        generique = _extraire_generique(texte)
        nom = nom or generique.get("nom_famille")
        prenoms = prenoms or generique.get("prenoms")
        numero_permis = numero_permis or generique.get("numero_cni")  # Réutilise le pattern numéro
        date_naissance = date_naissance or generique.get("date_naissance")
    
    # 5. Construction du résultat
    donnees = DonneesPermisExtraites(
        nom_famille=nom,
        prenoms=prenoms,
        date_naissance=date_naissance,
        lieu_naissance=lieu_naissance,
        numero_permis=numero_permis,
        categories=categories,
        date_premiere_delivrance=date_premiere_delivrance,
        date_delivrance=date_delivrance,
        date_expiration=date_expiration,
        autorite_delivrance=autorite,
        pays_emetteur=pays,
        mrz_ligne_1=mrz_lignes[0] if len(mrz_lignes) > 0 else None,
        mrz_ligne_2=mrz_lignes[1] if len(mrz_lignes) > 1 else None,
        texte_brut=texte_brut[:5000],
        taux_confiance_moyen=confiance,
    )
    
    journal.info(f"Extraction permis : pays={pays or 'inconnu'}, numéro={numero_permis}, catégories={categories}")
    return donnees