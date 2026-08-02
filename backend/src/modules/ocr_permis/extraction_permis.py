# -*- coding: utf-8 -*-
"""
Extraction INTELLIGENTE des champs d'un Permis de Conduire.
Utilise une approche multi-stratégies pour gérer le bruit OCR.
"""
import re
from typing import Optional, List, Tuple
from src.modules.ocr_permis.schemas import DonneesPermisExtraites
from src.noyau.journal import journal

def _nettoyer_texte_intelligent(texte: str) -> str:
    """Nettoie le texte OCR tout en préservant la structure."""
    # Convertir en majuscules
    texte = texte.upper()
    
    # Étape 1: Normaliser les espaces (remplacer multiples espaces par un seul)
    texte = re.sub(r'\s+', ' ', texte)
    
    # Étape 2: Supprimer les caractères très spéciaux mais garder la structure
    texte = re.sub(r'[><+\[\]{}|\\]', ' ', texte)
    
    # Étape 3: Séparer les mots collés avant les chiffres
    texte = re.sub(r'([A-Z])(\d)', r'\1 \2', texte)
    texte = re.sub(r'(\d)([A-Z])', r'\1 \2', texte)
    
    # Étape 4: Normaliser la ponctuation
    texte = re.sub(r'\s*:\s*', ': ', texte)
    texte = re.sub(r'\s*\.\s*', '. ', texte)
    
    return texte.strip()

def _extraire_par_numero_champ(texte: str, numero: int, label: str) -> Optional[str]:
    """
    Extrait la valeur après un numéro de champ (ex: "1.Nom:" ou "2.Prénom(s):")
    """
    # Pattern flexible: cherche le numéro suivi du label
    pattern = rf'{numero}\s*\.?\s*{label}\s*[:\-]?\s*([^2-9\.]+?)(?=\d+\.|$)'
    match = re.search(pattern, texte, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return None

def _extraire_date_apres_label(texte: str, label: str) -> Optional[str]:
    """Extrait une date (format JJ.MM.AAAA) après un label donné."""
    pattern = rf'{label}\s*[:\-]?\s*(\d{{1,2}}[\./-]\d{{1,2}}[\./-]\d{{2,4}})'
    match = re.search(pattern, texte, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return None

def _extraire_toutes_dates(texte: str) -> List[str]:
    """Extrait toutes les dates du texte au format JJ.MM.AAAA."""
    return re.findall(r'\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4}', texte)

def extraire_donnees_permis(
    texte_brut: str,
    confiance: float = 0.0,
    mrz_lignes: tuple = (None, None, None),
) -> DonneesPermisExtraites:
    """
    Extraction intelligente multi-stratégies pour permis de conduire.
    """
    if not texte_brut:
        return DonneesPermisExtraites(texte_brut="", taux_confiance_moyen=confiance)

    texte = _nettoyer_texte_intelligent(texte_brut)
    journal.info(f"Texte nettoyé: {texte[:300]}...")
    
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
    
    # === STRATÉGIE 1: Extraction par numéros de champ (la plus fiable) ===
    
    # Champ 1: NOM
    nom_extrait = _extraire_par_numero_champ(texte, 1, r'NOM\s*/?\s*SURNAME?')
    if nom_extrait:
        # Nettoyer le nom (supprimer les caractères restants)
        nom_famille = re.sub(r'[^A-ZÀ-Ÿ\s\-]', '', nom_extrait).strip()
        journal.info(f"✓ Nom extrait (champ 1): {nom_famille}")
    
    # Champ 2: PRÉNOM(S)
    prenoms_extrait = _extraire_par_numero_champ(texte, 2, r'PRÉNOM\(S\)\s*/?\s*(?:GIVEN\s*NAME)?')
    if prenoms_extrait:
        prenoms = re.sub(r'[^A-ZÀ-Ÿ\s\-]', '', prenoms_extrait).strip()
        journal.info(f"✓ Prénoms extraits (champ 2): {prenoms}")
    
    # Champ 3: DATE ET LIEU DE NAISSANCE
    naissance_text = _extraire_par_numero_champ(texte, 3, r'(?:NAISSANCE\s*/?\s*DATE\s*&?\s*PLACE|DATE\s*ET\s*LIEU\s*DE\s*NAISS)')
    if naissance_text:
        # Extraire la date (première date trouvée)
        dates_naiss = re.findall(r'\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4}', naissance_text)
        if dates_naiss:
            date_naissance = dates_naiss[0]
        # Extraire le lieu (après la date)
        lieu_match = re.search(r'\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4}\s*(?:À|A)?\s*([A-ZÀ-Ÿ\s]+)', naissance_text)
        if lieu_match:
            lieu_naissance = lieu_match.group(1).strip()
        journal.info(f"✓ Naissance: {date_naissance} à {lieu_naissance}")
    
    # Champ 4a: DATE DE DÉLIVRANCE
    date_delivrance = _extraire_date_apres_label(texte, r'4A\s*\.?\s*DATE\s*D[ÉE]LIVR')
    if not date_delivrance:
        # Fallback: chercher juste "4a." suivi d'une date
        match_4a = re.search(r'4A\s*\.?\s*(\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4})', texte)
        if match_4a:
            date_delivrance = match_4a.group(1)
    if date_delivrance:
        journal.info(f"✓ Date délivrance (champ 4a): {date_delivrance}")
    
    # Champ 4b: DATE D'EXPIRATION
    date_expiration = _extraire_date_apres_label(texte, r'4B\s*\.?\s*EXPIRATION')
    if not date_expiration:
        # Fallback: chercher "4b." suivi d'une date
        match_4b = re.search(r'4B\s*\.?\s*(\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4})', texte)
        if match_4b:
            date_expiration = match_4b.group(1)
    if date_expiration:
        journal.info(f"✓ Date expiration (champ 4b): {date_expiration}")
    
    # Champ 4c: AUTORITÉ
    autorite_extrait = _extraire_par_numero_champ(texte, 4, r'C\s*\.?\s*(?:AUTORIT[ÉE]\s*/?\s*AUTHORITY|D[ÉE]LIVR[ÉE]\s*PAR)')
    if autorite_extrait:
        autorite_delivrance = re.sub(r'[^A-ZÀ-Ÿ\s\.]', '', autorite_extrait).strip()
        journal.info(f"✓ Autorité (champ 4c): {autorite_delivrance}")
    
    # Champ 5: NUMÉRO DE PERMIS
    numero_extrait = _extraire_par_numero_champ(texte, 5, r'N[°O]\s*PERMIS\s*/?\s*(?:LICENSE\s*NO)?')
    if numero_extrait:
        # Extraire le numéro (format: SN-2021-0094821 ou similaire)
        match_num = re.search(r'([A-Z]{2,3}[\-]?\d{4}[\-]?\d{5,7})', numero_extrait)
        if match_num:
            numero_permis = match_num.group(1)
        else:
            numero_permis = re.sub(r'[^A-Z0-9\-]', '', numero_extrait).strip()
        journal.info(f"✓ Numéro permis (champ 5): {numero_permis}")
    
    # Champ 9: CATÉGORIES
    categories_text = _extraire_par_numero_champ(texte, 9, r'CAT[ÉE]GORIES?')
    if categories_text:
        # Extraire les catégories individuelles (A1, B, C1, etc.)
        categories = re.findall(r'\b(A1|A2|A|B|C1|C2|C|D1|D2|D|E|F|G)\b', categories_text)
        journal.info(f"✓ Catégories (champ 9): {categories}")
    
    # === STRATÉGIE 2: Détection du pays ===
    if "BENIN" in texte or "BÉNIN" in texte:
        pays_emetteur = "Bénin"
    elif "SENEGAL" in texte or "SÉNÉGAL" in texte:
        pays_emetteur = "Sénégal"
    elif "COTE" in texte and "IVOIRE" in texte:
        pays_emetteur = "Côte d'Ivoire"
    
    # === STRATÉGIE 3: Fallback pour les dates ===
    # Si on n'a pas trouvé les dates par les champs 4a/4b, chercher toutes les dates
    toutes_dates = _extraire_toutes_dates(texte)
    if len(toutes_dates) >= 2:
        if not date_delivrance:
            # La première date est souvent la délivrance
            date_delivrance = toutes_dates[0]
            journal.info(f"✓ Date délivrance (fallback): {date_delivrance}")
        if not date_expiration:
            # La dernière date est souvent l'expiration
            date_expiration = toutes_dates[-1]
            journal.info(f"✓ Date expiration (fallback): {date_expiration}")
    
    # === Validation et retour ===
    champs_remplis = sum([
        bool(nom_famille), bool(prenoms), bool(numero_permis),
        bool(date_delivrance), bool(date_expiration)
    ])
    
    journal.info(f"Extraction terminée: {champs_remplis}/5 champs principaux remplis")
    
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