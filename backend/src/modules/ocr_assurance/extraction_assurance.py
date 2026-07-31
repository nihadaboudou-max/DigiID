# -*- coding: utf-8 -*-
"""
Extraction des champs d'une Carte Verte / Attestation d'Assurance.
Réutilise les fonctions communes de l'OCR CNI.
"""
import re
from typing import Optional

# Import des fonctions communes depuis le module CNI
from src.modules.ocr_cni.extraction_cni import (
    _nettoyer_texte,
    _extraire_valeur_label,
    _extraire_generique,
)
from src.modules.ocr_assurance.schemas import DonneesAssuranceExtraites
from src.noyau.journal import journal


# =============================================================================
# PATTERNS SPÉCIFIQUES À L'ASSURANCE AUTOMOBILE
# =============================================================================
PATTERNS_ASSURANCE: dict = {
    # ── CARTE VERTE / ATTESTATION STANDARD (CEDEAO) ─────
    "assurance_ceaeo": {
        "indices_reconnaissance": [
            r"CARTE\s*VERTE",
            r"INTERNATIONAL\s*MOTOR\s*INSURANCE\s*CARD",
            r"CONSEIL\s*DES\s*BUREAUX",
            r"ATTESTATION\s*D[''` ]ASSURANCE",
        ],
        "champs": {
            "compagnie_assurance": [
                r"COMPAGNIE\s*[:\-]?\s*",
                r"ASSUREUR\s*[:\-]?\s*",
                r"SOCI[EÉ]T[EÉ]\s*[:\-]?\s*",
                r"INSURER\s*[:\-]?\s*",
            ],
            "numero_contrat": [
                r"N[°o]\s*CONTRAT\s*[:\-]?\s*",
                r"CONTRACT\s*N[°o]?\s*[:\-]?\s*",
                r"POLICE\s*N[°o]?\s*[:\-]?\s*",
                r"POLICY\s*N[°o]?\s*[:\-]?\s*",
            ],
            "numero_police": [
                r"N[°o]\s*POLICE\s*[:\-]?\s*",
                r"POLICY\s*N[°o]?\s*[:\-]?\s*",
            ],
            "immatriculation_vehicule": [
                r"IMMATRICULATION\s*[:\-]?\s*",
                r"REGISTRATION\s*N[°o]?\s*[:\-]?\s*",
                r"PLAQUE\s*[:\-]?\s*",
                r"LICENSE\s*PLATE\s*[:\-]?\s*",
            ],
            "marque_vehicule": [
                r"MARQUE\s*[:\-]?\s*",
                r"MAKE\s*[:\-]?\s*",
            ],
            "modele_vehicule": [
                r"MOD[EÈ]LE\s*[:\-]?\s*",
                r"MODEL\s*[:\-]?\s*",
            ],
            "annee_vehicule": [
                r"ANN[EÉ]E\s*[:\-]?\s*(\d{4})",
                r"YEAR\s*[:\-]?\s*(\d{4})",
            ],
            "nom_assure": [
                r"NOM\s*DE\s*L[''` ]ASSUR[EÉ]\s*[:\-]?\s*",
                r"NAME\s*OF\s*INSURED\s*[:\-]?\s*",
                r"ASSUR[EÉ]\s*[:\-]?\s*",
            ],
            "prenoms_assure": [
                r"PR[EÉ]NOM(?:S)?\s*DE\s*L[''` ]ASSUR[EÉ]\s*[:\-]?\s*",
            ],
            "type_couverture": [
                r"TYPE\s*DE\s*COUVERTURE\s*[:\-]?\s*",
                r"TYPE\s*OF\s*COVER\s*[:\-]?\s*",
                r"COUVERTURE\s*[:\-]?\s*",
            ],
            "date_effet": [
                r"DATE\s*D[''` ]EFFET\s*[:\-]?\s*",
                r"START\s*DATE\s*[:\-]?\s*",
                r"VALABLE\s*DU\s*[:\-]?\s*",
            ],
            "date_expiration": [
                r"DATE\s*D[''` ]EXPIRATION\s*[:\-]?\s*",
                r"EXPIRY\s*DATE\s*[:\-]?\s*",
                r"VALABLE\s*JUSQU[''` ]AU?\s*[:\-]?\s*",
                r"EXPIRE\s*LE?\s*[:\-]?\s*",
            ],
            "pays_couverture": [
                r"PAYS\s*DE\s*COUVERTURE\s*[:\-]?\s*",
                r"COUNTRIES\s*OF\s*COVER\s*[:\-]?\s*",
            ],
        },
    },

    # ── ASSURANCE BÉNIN / CEDEAO ────────────────────────
    "assurance_benin": {
        "indices_reconnaissance": [
            r"R[EÉ]PUBLIQUE\s*DU\s*B[EÉ]NIN",
            r"CARTE\s*VERTE.*B[EÉ]NIN",
            r"NSIA\s*B[EÉ]NIN",
            r"UGAN\s*B[EÉ]NIN",
            r"SUNU\s*ASSURANCES",
        ],
        "champs": {
            "compagnie_assurance": [r"COMPAGNIE\s*[:\-]?\s*", r"ASSUREUR\s*[:\-]?\s*"],
            "numero_contrat": [r"N[°o]\s*CONTRAT\s*[:\-]?\s*"],
            "immatriculation_vehicule": [r"IMMATRICULATION\s*[:\-]?\s*", r"PLAQUE\s*[:\-]?\s*"],
            "marque_vehicule": [r"MARQUE\s*[:\-]?\s*"],
            "modele_vehicule": [r"MOD[EÈ]LE\s*[:\-]?\s*"],
            "date_expiration": [r"VALABLE\s*JUSQU[''` ]AU?\s*"],
        },
    },

    # ─ ASSURANCE CÔTE D'IVOIRE ─────────────────────────
    "assurance_cote_ivoire": {
        "indices_reconnaissance": [
            r"R[EÉ]PUBLIQUE\s*DE\s*C[OÔ]TE\s*D[''` ]IVOIRE",
            r"CARTE\s*VERTE.*C[OÔ]TE\s*D[''` ]IVOIRE",
            r"NSIA\s*C[OÔ]TE\s*D[''` ]IVOIRE",
            r"SAHAM\s*ASSURANCES",
            r"VISTA\s*ASSURANCES",
        ],
        "champs": {
            "compagnie_assurance": [r"COMPAGNIE\s*[:\-]?\s*"],
            "numero_contrat": [r"N[°o]\s*CONTRAT\s*[:\-]?\s*"],
            "immatriculation_vehicule": [r"IMMATRICULATION\s*[:\-]?\s*"],
            "marque_vehicule": [r"MARQUE\s*[:\-]?\s*"],
            "date_expiration": [r"VALABLE\s*JUSQU[''` ]AU?\s*"],
        },
    },

    # ── ASSURANCE SÉNÉGAL ──────────────────────────────
    "assurance_senegal": {
        "indices_reconnaissance": [
            r"R[EÉ]PUBLIQUE\s*DU\s*S[EÉ]N[EÉ]GAL",
            r"CARTE\s*VERTE.*S[EÉ]N[EÉ]GAL",
            r"NSIA\s*S[EÉ]N[EÉ]GAL",
            r"UGAN\s*S[EÉ]N[EÉ]GAL",
        ],
        "champs": {
            "compagnie_assurance": [r"COMPAGNIE\s*[:\-]?\s*"],
            "numero_contrat": [r"N[°o]\s*CONTRAT\s*[:\-]?\s*"],
            "immatriculation_vehicule": [r"IMMATRICULATION\s*[:\-]?\s*"],
            "marque_vehicule": [r"MARQUE\s*[:\-]?\s*"],
            "date_expiration": [r"VALABLE\s*JUSQU[''` ]AU?\s*"],
        },
    },
}


# =============================================================================
# Fonctions d'extraction
# =============================================================================

def _detecter_type_assurance(texte: str) -> Optional[str]:
    """Détecte le type/pays de l'assurance."""
    texte_upper = texte.upper()
    for type_assurance, config in PATTERNS_ASSURANCE.items():
        for indice in config["indices_reconnaissance"]:
            if re.search(indice, texte_upper):
                journal.info(f"Assurance détectée : {type_assurance}")
                return type_assurance
    return None


def _extraire_annee_vehicule(texte: str) -> Optional[str]:
    """Extrait l'année du véhicule."""
    match = re.search(r"ANN[EÉ]E\s*[:\-]?\s*(\d{4})", texte, re.IGNORECASE)
    if not match:
        match = re.search(r"YEAR\s*[:\-]?\s*(\d{4})", texte, re.IGNORECASE)
    if match:
        return match.group(1)
    return None


def extraire_donnees_assurance(
    texte_brut: str,
    confiance: float = 0.0,
) -> DonneesAssuranceExtraites:
    """
    Extrait les champs d'une carte verte / attestation d'assurance.
    """
    if not texte_brut:
        return DonneesAssuranceExtraites(texte_brut="", taux_confiance_moyen=confiance)

    texte = _nettoyer_texte(texte_brut)
    
    # 1. Détection du type d'assurance
    type_assurance = _detecter_type_assurance(texte)
    
    # 2. Initialisation
    compagnie = None
    numero_contrat = None
    numero_police = None
    immatriculation = None
    marque = None
    modele = None
    annee = None
    nom_assure = None
    prenoms_assure = None
    type_couverture = None
    date_effet = None
    date_expiration = None
    pays_couverture = None
    
    # 3. Extraction par patterns spécifiques
    if type_assurance and type_assurance in PATTERNS_ASSURANCE:
        champs = PATTERNS_ASSURANCE[type_assurance]["champs"]
        compagnie = _extraire_valeur_label(texte, champs.get("compagnie_assurance", []), "compagnie")
        numero_contrat = _extraire_valeur_label(texte, champs.get("numero_contrat", []), "numero_contrat")
        numero_police = _extraire_valeur_label(texte, champs.get("numero_police", []), "numero_police")
        immatriculation = _extraire_valeur_label(texte, champs.get("immatriculation_vehicule", []), "immatriculation")
        marque = _extraire_valeur_label(texte, champs.get("marque_vehicule", []), "marque")
        modele = _extraire_valeur_label(texte, champs.get("modele_vehicule", []), "modele")
        annee = _extraire_annee_vehicule(texte)
        nom_assure = _extraire_valeur_label(texte, champs.get("nom_assure", []), "nom_assure")
        prenoms_assure = _extraire_valeur_label(texte, champs.get("prenoms_assure", []), "prenoms_assure")
        type_couverture = _extraire_valeur_label(texte, champs.get("type_couverture", []), "type_couverture")
        date_effet = _extraire_valeur_label(texte, champs.get("date_effet", []), "date_effet")
        date_expiration = _extraire_valeur_label(texte, champs.get("date_expiration", []), "date_expiration")
        pays_couverture = _extraire_valeur_label(texte, champs.get("pays_couverture", []), "pays_couverture")
    
    # 4. Fallback générique
    if not all([compagnie, numero_contrat, immatriculation]):
        journal.info("Extraction spécifique assurance infructueuse, tentative générique...")
        generique = _extraire_generique(texte)
        compagnie = compagnie or generique.get("compagnie_assurance")
        numero_contrat = numero_contrat or generique.get("numero_contrat")
        immatriculation = immatriculation or generique.get("immatriculation")
        date_expiration = date_expiration or generique.get("date_expiration")
    
    # 5. Construction du résultat
    donnees = DonneesAssuranceExtraites(
        compagnie_assurance=compagnie,
        numero_contrat=numero_contrat,
        numero_police=numero_police,
        immatriculation_vehicule=immatriculation,
        marque_vehicule=marque,
        modele_vehicule=modele,
        annee_vehicule=annee,
        nom_assure=nom_assure,
        prenoms_assure=prenoms_assure,
        type_couverture=type_couverture,
        date_effet=date_effet,
        date_expiration=date_expiration,
        pays_couverture=pays_couverture,
        texte_brut=texte_brut[:5000],
        taux_confiance_moyen=confiance,
    )
    
    journal.info(
        f"Extraction assurance : type={type_assurance or 'inconnu'}, "
        f"compagnie={compagnie}, immatriculation={immatriculation}"
    )
    return donnees