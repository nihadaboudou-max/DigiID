# -*- coding: utf-8 -*-
"""
Extraction ULTRA-ROBUSTE pour permis de conduire.
Fonctionne même avec un OCR de mauvaise qualité.
"""
import re
from typing import Optional, List
from src.modules.ocr_permis.schemas import DonneesPermisExtraites
from src.noyau.journal import journal

def _extraire_tout_le_texte_lisible(texte: str) -> str:
    """Nettoie le texte en gardant un maximum d'informations."""
    # Convertir en majuscules
    texte = texte.upper()
    
    # Supprimer les caractères très spéciaux mais garder l'essentiel
    texte = re.sub(r'[{}()\[\]<>]', ' ', texte)
    
    # Séparer les mots collés aux chiffres
    texte = re.sub(r'([A-Z])(\d)', r'\1 \2', texte)
    texte = re.sub(r'(\d)([A-Z])', r'\1 \2', texte)
    
    # Normaliser les espaces
    texte = re.sub(r'\s+', ' ', texte)
    
    return texte.strip()

def _trouver_toutes_les_dates(texte: str) -> List[str]:
    """Extrait toutes les dates au format JJ.MM.AAAA ou JJ/MM/AAAA."""
    return re.findall(r'\b(\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4})\b', texte)

def _extraire_apres_mot_cle(texte: str, mot_cle: str, longueur_max: int = 50) -> Optional[str]:
    """Extrait le texte qui suit immédiatement un mot-clé."""
    pattern = rf'{re.escape(mot_cle)}\s*[:\-]?\s*([^\n\.]{{1,{longueur_max}}})'
    match = re.search(pattern, texte, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return None

def extraire_donnees_permis(
    texte_brut: str,
    confiance: float = 0.0,
    mrz_lignes: tuple = (None, None, None),
) -> DonneesPermisExtraites:
    """
    Extraction ultra-robuste - cherche partout dans le texte.
    """
    if not texte_brut:
        return DonneesPermisExtraites(texte_brut="", taux_confiance_moyen=confiance)

    texte = _extraire_tout_le_texte_lisible(texte_brut)
    journal.info(f"Texte nettoyé ({len(texte)} chars): {texte[:200]}...")
    
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
    
    # === 1. DÉTECTION PAYS ===
    if "BENIN" in texte:
        pays_emetteur = "Bénin"
    elif "SENEGAL" in texte or "SENEGAL" in texte:
        pays_emetteur = "Sénégal"
    
    # === 2. NOM (champ 1 ou après "NOM") ===
    # Cherche "1.NOM/SURNAME: ABOUDOU TRAORE" ou "NOM : ABOUDOU TRAORE"
    match_nom = re.search(r'(?:1\s*\.?\s*)?NOM\s*/?\s*SURNAME?\s*[:\-]?\s*([A-ZÀ-Ÿ]+(?:\s+[A-ZÀ-Ÿ]+)+)', texte)
    if not match_nom:
        # Fallback: cherche juste après "1."
        match_nom = re.search(r'1\s*\.?\s*([A-Z]{5,}(?:\s+[A-Z]+)+)', texte)
    if match_nom:
        nom_famille = match_nom.group(1).strip()
        # Nettoyer le nom
        nom_famille = re.sub(r'[^A-ZÀ-Ÿ\s\-]', '', nom_famille).strip()
        journal.info(f"✓ NOM: {nom_famille}")
    
    # === 3. PRÉNOMS (champ 2) ===
    match_prenoms = re.search(r'2\s*\.?\s*PRENOM\s*\(?S\)?\s*/?\s*(?:GIVEN\s*NAME)?\s*[:\-]?\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿ\s]*)', texte)
    if not match_prenoms:
        # Cherche après "Prénom"
        match_prenoms = re.search(r'PRENOM(?:S)?\s*[:\-]?\s*([A-Z][A-Z\s]+)', texte)
    if match_prenoms:
        prenoms = match_prenoms.group(1).strip()
        prenoms = re.sub(r'[^A-ZÀ-Ÿ\s\-]', '', prenoms).strip()
        journal.info(f"✓ PRÉNOMS: {prenoms}")
    
    # === 4. DATE ET LIEU DE NAISSANCE ===
    # Cherche "12.10.2002 À PARAKOU" ou similaire
    match_naiss = re.search(r'(\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4})\s*(?:À|A)?\s*([A-Z]{4,})', texte)
    if match_naiss:
        date_naissance = match_naiss.group(1)
        lieu_naissance = match_naiss.group(2).strip()
        journal.info(f"✓ NAISSANCE: {date_naissance} à {lieu_naissance}")
    
    # === 5. TOUTES LES DATES DU DOCUMENT ===
    toutes_dates = _trouver_toutes_les_dates(texte)
    journal.info(f"Dates trouvées: {toutes_dates}")
    
    if len(toutes_dates) >= 2:
        # Stratégie: première date = naissance ou délivrance, dernière = expiration
        if not date_naissance:
            date_naissance = toutes_dates[0]
        
        # Cherche spécifiquement les dates après "4a" et "4b"
        match_4a = re.search(r'4A\s*\.?\s*(\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4})', texte)
        match_4b = re.search(r'4B\s*\.?\s*(\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4})', texte)
        
        if match_4a:
            date_delivrance = match_4a.group(1)
        elif len(toutes_dates) >= 2:
            # Prendre l'avant-dernière date comme délivrance
            date_delivrance = toutes_dates[-2] if len(toutes_dates) >= 2 else toutes_dates[0]
        
        if match_4b:
            date_expiration = match_4b.group(1)
        else:
            # Dernière date = expiration
            date_expiration = toutes_dates[-1]
        
        journal.info(f"✓ DÉLIVRANCE: {date_delivrance}")
        journal.info(f"✓ EXPIRATION: {date_expiration}")
    
    # === 6. NUMÉRO DE PERMIS (CRITIQUE) ===
    # Cherche "SN-2021-0094821" ou "5.NPERMIS: SN-2021-0094821"
    match_numero = re.search(r'(?:5\s*\.?\s*N[°O]\s*PERMIS\s*/?\s*(?:LICENSE\s*NO)?\s*[:\-]?\s*)?([A-Z]{2,3}[\-]?\d{4}[\-]?\d{5,7})', texte)
    if not match_numero:
        # Fallback: cherche un pattern de numéro de permis
        match_numero = re.search(r'\b([A-Z]{2,3}[\-]\d{4}[\-]\d{5,7})\b', texte)
    if not match_numero:
        # Cherche après "NPERMIS"
        match_numero = re.search(r'N\s*PERMIS\s*[:\-]?\s*([A-Z0-9\-]+)', texte)
    
    if match_numero:
        numero_permis = match_numero.group(1).strip()
        journal.info(f"✓ NUMÉRO PERMIS: {numero_permis}")
    
    # === 7. AUTORITÉ (champ 4c) ===
    match_autorite = re.search(r'4C\s*\.?\s*(?:AUTORIT[ÉE]\s*/?\s*AUTHORITY|D[ÉE]LIVR[ÉE]\s*PAR)\s*[:\-]?\s*([A-Z\s\.]+?)(?=\d+\.|$)', texte)
    if match_autorite:
        autorite_delivrance = match_autorite.group(1).strip()
        journal.info(f"✓ AUTORITÉ: {autorite_delivrance}")
    
    # === 8. CATÉGORIES (champ 9) ===
    match_cats = re.search(r'9\s*\.?\s*CAT[ÉE]GORIES?\s*[:\-]?\s*([A-Z0-9\s]+?)(?:\s*[A-Z]\.|$)', texte)
    if match_cats:
        cats_text = match_cats.group(1)
        categories = re.findall(r'\b(A1|A2|A|B|C1|C2|C|D|E|F|G)\b', cats_text)
        journal.info(f"✓ CATÉGORIES: {categories}")
    
    # === VALIDATION ===
    champs_ok = sum([
        bool(nom_famille), bool(prenoms), bool(numero_permis),
        bool(date_delivrance), bool(date_expiration)
    ])
    
    journal.warning(f"Extraction terminée: {champs_ok}/5 champs principaux")
    if champs_ok < 3:
        journal.error(f"EXTRACTION INSUFFISANTE - Texte: {texte[:500]}")
    
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