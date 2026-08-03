# -*- coding: utf-8 -*-
"""
Extraction ULTRA-ROBUSTE pour l'Assurance Automobile.
Fonctionne même avec un OCR très bruité.
"""
import re
from typing import Optional, List
from src.modules.ocr_assurance.schemas import DonneesAssuranceExtraites
from src.noyau.journal import journal

def _nettoyer_texte_assurance(texte: str) -> str:
    """Nettoie le texte OCR bruité en gardant l'essentiel."""
    # Convertir en majuscules
    texte = texte.upper()
    
    # Supprimer les caractères très spéciaux mais garder lettres, chiffres et espaces
    texte = re.sub(r'[^A-ZÀ-Ÿ0-9\s.:,\-/]', ' ', texte)
    
    # Normaliser les espaces multiples
    texte = re.sub(r'\s+', ' ', texte)
    
    return texte.strip()

def _trouver_toutes_les_dates(texte: str) -> List[str]:
    """Extrait toutes les dates au format JJ.MM.AAAA ou JJ/MM/AAAA."""
    return re.findall(r'\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b', texte)

def _extraire_apres_mot_cle(texte: str, mot_cle: str, longueur_max: int = 100) -> Optional[str]:
    """Extrait le texte qui suit immédiatement un mot-clé."""
    pattern = rf'{re.escape(mot_cle)}\s*[:\-]?\s*([^\n\.]{{1,{longueur_max}}})'
    match = re.search(pattern, texte, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return None

def extraire_donnees_assurance(
    texte_brut: str,
    confiance: float = 0.0,
) -> DonneesAssuranceExtraites:
    """
    Extraction ultra-robuste - cherche partout dans le texte.
    """
    if not texte_brut:
        return DonneesAssuranceExtraites(texte_brut="", taux_confiance_moyen=confiance)

    texte = _nettoyer_texte_assurance(texte_brut)
    journal.info(f"Texte nettoyé assurance ({len(texte)} chars): {texte[:200]}...")
    
    # Initialisation
    compagnie_assurance = None
    numero_contrat = None
    immatriculation_vehicule = None
    marque_vehicule = None
    modele_vehicule = None
    date_effet = None
    date_expiration = None
    
    # === 1. COMPAGNIE D'ASSURANCE ===
    # Cherche après "COMPAGNIE", "ASSUREUR", "INSURER", etc.
    match_compagnie = re.search(
        r'(?:COMPAGNIE|ASSUREUR|INSURER|SOCIÉTÉ|SOCIETE)\s*[:\-]?\s*([A-ZÀ-Ÿ\s\.]{5,50}?)(?=\s*(?:N[°O]|CONTRAT|POLICE|IMMATRICULATION|REGISTRATION|DATE|$))',
        texte
    )
    if match_compagnie:
        compagnie_assurance = match_compagnie.group(1).strip()
        # Nettoyer la compagnie
        compagnie_assurance = re.sub(r'[^A-ZÀ-Ÿ\s\.]', '', compagnie_assurance).strip()
        journal.info(f"✓ COMPAGNIE: {compagnie_assurance}")
    
    # === 2. NUMÉRO DE CONTRAT (CRITIQUE) ===
    # Cherche "N° CONTRAT", "CONTRACT N°", "POLICE N°", etc.
    match_contrat = re.search(
        r'(?:N[°O]\s*CONTRAT|CONTRACT\s*N[°O]?|POLICE\s*N[°O]?|POLICY\s*N[°O]?|N[°O]\s*POLICE)\s*[:\-]?\s*([A-Z0-9\-]{5,30})',
        texte
    )
    if not match_contrat:
        # Fallback: cherche juste un numéro après "CONTRAT" ou "POLICE"
        match_contrat = re.search(r'(?:CONTRAT|POLICE)\s*[:\-]?\s*([A-Z0-9\-]{5,30})', texte)
    if match_contrat:
        numero_contrat = match_contrat.group(1).strip()
        journal.info(f"✓ NUMÉRO CONTRAT: {numero_contrat}")
    
    # === 3. IMMATRICULATION (CRITIQUE) ===
    # Cherche "IMMATRICULATION", "REGISTRATION", "PLAQUE", etc.
    match_immat = re.search(
        r'(?:IMMATRICULATION|REGISTRATION\s*N[°O]?|PLAQUE|LICENSE\s*PLATE)\s*[:\-]?\s*([A-Z0-9\-]{5,20})',
        texte
    )
    if not match_immat:
        # Fallback: cherche un pattern de plaque (ex: AB-123-CD, 1234 ABC 56)
        match_immat = re.search(r'\b([A-Z]{1,3}[\-]?\d{2,4}[\-]?[A-Z]{1,3})\b', texte)
    if match_immat:
        immatriculation_vehicule = match_immat.group(1).strip()
        journal.info(f"✓ IMMATRICULATION: {immatriculation_vehicule}")
    
    # === 4. MARQUE DU VÉHICULE ===
    match_marque = re.search(
        r'(?:MARQUE|MAKE)\s*[:\-]?\s*([A-ZÀ-Ÿ\s\.]{3,30}?)(?=\s*(?:MODÈLE|MODEL|TYPE|ANNÉE|$))',
        texte
    )
    if match_marque:
        marque_vehicule = match_marque.group(1).strip()
        journal.info(f"✓ MARQUE: {marque_vehicule}")
    
    # === 5. MODÈLE DU VÉHICULE ===
    match_modele = re.search(
        r'(?:MODÈLE|MODEL)\s*[:\-]?\s*([A-ZÀ-Ÿ0-9\s\.]{3,40})',
        texte
    )
    if match_modele:
        modele_vehicule = match_modele.group(1).strip()
        journal.info(f"✓ MODÈLE: {modele_vehicule}")
    
    # === 6. TOUTES LES DATES ===
    toutes_dates = _trouver_toutes_les_dates(texte)
    journal.info(f"Dates trouvées: {toutes_dates}")
    
    if len(toutes_dates) >= 1:
        # Cherche spécifiquement les dates après labels
        match_date_effet = re.search(
            r'(?:DATE\s*D\'EFFET|START\s*DATE|VALABLE\s*DU|EFFET\s*LE)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})',
            texte
        )
        if match_date_effet:
            date_effet = match_date_effet.group(1)
        
        match_date_expiration = re.search(
            r'(?:DATE\s*D\'EXPIRATION|EXPIRY\s*DATE|VALABLE\s*JUSQU\'?AU?|EXPIRE\s*LE)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})',
            texte
        )
        if match_date_expiration:
            date_expiration = match_date_expiration.group(1)
        elif len(toutes_dates) >= 2:
            # Stratégie: dernière date = expiration
            date_expiration = toutes_dates[-1]
            # Avant-dernière date = effet (si disponible)
            if len(toutes_dates) >= 2:
                date_effet = toutes_dates[-2]
        
        journal.info(f"✓ DATE EFFET: {date_effet}")
        journal.info(f"✓ DATE EXPIRATION: {date_expiration}")
    
    # === VALIDATION ===
    champs_ok = sum([
        bool(compagnie_assurance),
        bool(numero_contrat),
        bool(immatriculation_vehicule),
        bool(date_expiration)
    ])
    
    journal.warning(f"Extraction assurance terminée: {champs_ok}/4 champs critiques")
    if champs_ok < 2:
        journal.error(f"EXTRACTION INSUFFISANTE - Texte: {texte[:500]}")
    
    return DonneesAssuranceExtraites(
        compagnie_assurance=compagnie_assurance,
        numero_contrat=numero_contrat,
        immatriculation_vehicule=immatriculation_vehicule,
        marque_vehicule=marque_vehicule,
        modele_vehicule=modele_vehicule,
        date_effet=date_effet,
        date_expiration=date_expiration,
        texte_brut=texte_brut[:5000],
        taux_confiance_moyen=confiance,
    )