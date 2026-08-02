# -*- coding: utf-8 -*-
"""
Extraction des champs d'un Permis de Conduire.
Version ROBUSTE pour gérer le bruit OCR.
"""
import re
from typing import Optional
from src.modules.ocr_permis.schemas import DonneesPermisExtraites
from src.noyau.journal import journal

def _nettoyer_texte(texte: str) -> str:
    """Nettoie le texte OCR en supprimant les caractères parasites."""
    # Conserve uniquement les caractères utiles
    texte = texte.upper()
    # Supprime les caractères spéciaux parasites (garde lettres, chiffres, espaces, ponctuation basique)
    texte = re.sub(r'[^A-ZÀ-Ÿ0-9\s.:,\-/]', ' ', texte)
    # Remplace les multiples espaces par un seul
    texte = re.sub(r'\s+', ' ', texte)
    return texte.strip()

def extraire_donnees_permis(
    texte_brut: str,
    confiance: float = 0.0,
    mrz_lignes: tuple = (None, None, None),
) -> DonneesPermisExtraites:
    """
    Extrait les champs d'un permis de conduire (version robuste au bruit OCR).
    """
    if not texte_brut:
        return DonneesPermisExtraites(texte_brut="", taux_confiance_moyen=confiance)

    texte = _nettoyer_texte(texte_brut)
    journal.info(f"Texte nettoyé: {texte[:200]}...")
    
    # Initialisation
    nom_famille = None
    prenoms = None
    date_naissance = None
    lieu_naissance = None
    numero_permis = None
    categories = []
    date_delivrance = None
    date_expiration = None
    autorite_delivrance = None
    pays_emetteur = None
    
    # === DÉTECTION DU PAYS ===
    if "BENIN" in texte:
        pays_emetteur = "Bénin"
    elif "SENEGAL" in texte or "SENEGAL" in texte:
        pays_emetteur = "Sénégal"
    elif "COTE" in texte and "IVOIRE" in texte:
        pays_emetteur = "Côte d'Ivoire"
    
    # === EXTRACTION NOM (Pattern flexible) ===
    # Cherche "1. NOM/SURNAME : ABOUDOU TRAORE" ou variations
    match_nom = re.search(r'1\s*\.?\s*NOM\s*/?\s*SURNAME?\s*:?\s*([A-ZÀ-Ÿ]+(?:\s+[A-ZÀ-Ÿ]+)+)', texte)
    if match_nom:
        nom_famille = match_nom.group(1).strip()
        journal.info(f"Nom trouvé: {nom_famille}")
    
    # === EXTRACTION PRÉNOMS ===
    # Cherche "2. PRÉNOM(S)/GIVEN NAME : Nihad"
    match_prenoms = re.search(r'2\s*\.?\s*PRENOM\s*\(?S\)?\s*/?\s*(?:GIVEN\s*NAME)?\s*:?\s*([A-ZÀ-Ÿ]+(?:\s+[A-ZÀ-Ÿ]+)*)', texte)
    if match_prenoms:
        prenoms = match_prenoms.group(1).strip()
        journal.info(f"Prénoms trouvés: {prenoms}")
    
    # === EXTRACTION DATE ET LIEU DE NAISSANCE ===
    # Cherche "3. NAISSANCE/DATE & PLACE OF BIRTH : 12.10.2002 À PARAKOU"
    match_naissance = re.search(
        r'3\s*\.?\s*(?:NAISSANCE\s*/?\s*DATE\s*&?\s*PLACE\s*(?:OF\s*)?BIRTH|DATE\s*ET\s*LIEU\s*DE\s*NAISS(?:ANCE)?)\s*:?\s*'
        r'(\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4})\s*(?:À|A)?\s*([A-ZÀ-Ÿ]+(?:\s+[A-ZÀ-Ÿ]+)*)?',
        texte
    )
    if match_naissance:
        date_naissance = match_naissance.group(1).strip()
        lieu_naissance = match_naissance.group(2).strip() if match_naissance.group(2) else None
        journal.info(f"Naissance: {date_naissance} à {lieu_naissance}")
    
    # === EXTRACTION DATE DE DÉLIVRANCE ===
    # Cherche "4a. DATE DÉLIVR. : 10.11.2021"
    match_deliv = re.search(r'4a\s*\.?\s*DATE\s*D[ÉE]LIVR(?:\.|ANCE)?\s*:?\s*(\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4})', texte)
    if match_deliv:
        date_delivrance = match_deliv.group(1).strip()
        journal.info(f"Date délivrance: {date_delivrance}")
    
    # === EXTRACTION DATE D'EXPIRATION ===
    # Cherche "4b. EXPIRATION : 09.11.2031"
    match_expir = re.search(r'4b\s*\.?\s*EXPIRATION\s*:?\s*(\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4})', texte)
    if match_expir:
        date_expiration = match_expir.group(1).strip()
        journal.info(f"Date expiration: {date_expiration}")
    
    # === EXTRACTION AUTORITÉ ===
    # Cherche "4c. AUTORITÉ/AUTHORITY : MINISTERE TRANSPORTS"
    match_autorite = re.search(
        r'4c\s*\.?\s*(?:AUTORIT[ÉE]\s*/?\s*AUTHORITY|D[ÉE]LIVR[ÉE]\s*PAR)\s*:?\s*([A-ZÀ-Ÿ\s\.]+?)(?=\d+\.|$)',
        texte
    )
    if match_autorite:
        autorite_delivrance = match_autorite.group(1).strip()
        journal.info(f"Autorité: {autorite_delivrance}")
    
    # === EXTRACTION NUMÉRO DE PERMIS ===
    # Cherche "5. N° PERMIS/LICENSE NO : SN-2021-0098412"
    match_numero = re.search(r'5\s*\.?\s*N[°O]\s*PERMIS\s*/?\s*(?:LICENSE\s*NO)?\s*:?\s*([A-Z0-9\-]+)', texte)
    if match_numero:
        numero_permis = match_numero.group(1).strip()
        journal.info(f"Numéro permis: {numero_permis}")
    
    # === EXTRACTION CATÉGORIES ===
    # Cherche "9. CATÉGORIES : A B C" ou en bas du document
    match_cats = re.search(r'9\s*\.?\s*CAT[ÉE]GORIES?\s*:?\s*([A-Z0-9\s]+?)(?:\s*J\.M\.|$)', texte)
    if match_cats:
        cats_str = match_cats.group(1)
        # Extraire les catégories individuelles
        categories = re.findall(r'(?:A1|A2|A|B|C1|C2|C|D1|D2|D|E|F|G)', cats_str)
        journal.info(f"Catégories: {categories}")
    
    return DonneesPermisExtraites(
        nom_famille=nom_famille,
        prenoms=prenoms,
        date_naissance=date_naissance,
        lieu_naissance=lieu_naissance,
        numero_permis=numero_permis,
        categories=categories,
        date_delivrance=date_delivrance,
        date_expiration=date_expiration,
        autorite_delivrance=autorite_delivrance,
        pays_emetteur=pays_emetteur,
        texte_brut=texte_brut[:5000],
        taux_confiance_moyen=confiance,
        mrz_ligne_1=mrz_lignes[0] if mrz_lignes else None,
        mrz_ligne_2=mrz_lignes[1] if len(mrz_lignes) > 1 else None,
    )