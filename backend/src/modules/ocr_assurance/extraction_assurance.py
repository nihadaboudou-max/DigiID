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

_MOTS_CLES_FIN = re.compile(
    r'\s+(?:IMMATRICULATION|PRENOM|PRÉNOM|PLAQUE|DATE|ADRESSE|MARQUE|MODÈLE|VEHICULE|VÉHICULE|N\s*CONTRAT|CONTRAT|POLICE)\b'
)

def _tronquer_au_mot_cle(valeur: Optional[str]) -> Optional[str]:
    """Coupe une valeur d'identité au premier mot-clé de fin de section."""
    if not valeur:
        return valeur
    m = _MOTS_CLES_FIN.search(valeur)
    return valeur[:m.start()].strip() if m else valeur.strip()


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
    nom_assure = None
    prenoms_assure = None
    date_naissance = None
    lieu_naissance = None
    
    # === NOM ET PRÉNOMS DE L'ASSURÉ ===
    # Format A : "ASSURÉ(E)/ASSURE/TITULAIRE/SOUSCRIPTEUR/CONDUCTEUR : DUPONT JEAN"
    match_identite = re.search(
        r'\b(?:ASSUR[ÉE]\(?S?\)?|ASSURE|TITULAIRE|SOUSCRIPTEUR|CONDUCTEUR|DRIVER|INSURED|HOLDER)\s*[:\-]?\s*([A-ZÀ-Ÿ]{2,}(?:\s+[A-ZÀ-Ÿ]+){1,3})',
        texte
    )
    if match_identite:
        identite_complete = _tronquer_au_mot_cle(re.sub(r'[^A-ZÀ-Ÿ\s\-]', '', match_identite.group(1)))
        mots = identite_complete.split()
        if len(mots) >= 2:
            nom_assure = mots[0]
            prenoms_assure = " ".join(mots[1:])
        else:
            nom_assure = identite_complete
        journal.info(f"✓ ASSURÉ: {nom_assure} {prenoms_assure or ''}")

    # Format B : étiquettes séparées "NOM : ..." + "PRENOM(S) : ..."
    if not nom_assure:
        match_nom = re.search(r'\bNOM\s*(?!D[UE]\b|DE\b|LA\b|LE\b|DU\b)\s*[:\-]?\s*([A-ZÀ-Ÿ\-]{2,}(?:\s+[A-ZÀ-Ÿ\-]+)*)', texte)
        match_prenom = re.search(r'\bPRENOM(?:S)?\s*[:\-]?\s*([A-ZÀ-Ÿ\-]{2,}(?:\s+[A-ZÀ-Ÿ\-]+)*)', texte)
        if match_nom and match_nom.group(1):
            nom_assure = _tronquer_au_mot_cle(re.sub(r'[^A-ZÀ-Ÿ\s\-]', '', match_nom.group(1)))
        if match_prenom and match_prenom.group(1):
            prenoms_assure = _tronquer_au_mot_cle(re.sub(r'[^A-ZÀ-Ÿ\s\-]', '', match_prenom.group(1)))
        if nom_assure:
            journal.info(f"✓ NOM ASSURÉ: {nom_assure} / PRÉNOMS: {prenoms_assure or ''}")
    
    # === 1. COMPAGNIE D'ASSURANCE ===
    # Cherche après "COMPAGNIE", "ASSUREUR", "INSURER", etc.
    match_compagnie = re.search(
        r'(?:COMPAGNIE|ASSUREUR|INSURER|SOCIÉTÉ|SOCIETE)\s*[:\-]?\s*([A-ZÀ-Ÿ\s\.]{5,50}?)(?=\s*(?:N\s*(?:[°O]|CONTRAT|POLICE)|CONTRAT|POLICE|IMMATRICULATION|REGISTRATION|DATE|$))',
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
    
    # === 6. DATE / LIEU DE NAISSANCE (si présent sur le document) ===
    match_naiss = re.search(
        r'\b(?:N[ÉE]\(?E?\)?\s*LE?|DATE\s*DE\s*NAISSANCE|DATE OF BIRTH|BIRTH)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})',
        texte
    )
    if match_naiss:
        date_naissance = match_naiss.group(1)
    if date_naissance:
        match_lieu = re.search(rf'{re.escape(date_naissance)}\s*(?:À|A|@)?\s*([A-ZÀ-Ÿ\-]{{3,}})', texte)
        if match_lieu:
            lieu_naissance = match_lieu.group(1).strip()
        journal.info(f"✓ NAISSANCE: {date_naissance} à {lieu_naissance or '?'}")

    # === 7. TOUTES LES DATES DE COUVERTURE ===
    toutes_dates = _trouver_toutes_les_dates(texte)
    journal.info(f"Dates trouvées: {toutes_dates}")

    # Période "VALABLE DU X AU Y" (format le plus courant sur carte verte)
    match_periode = re.search(
        r"VALABLE\s*(?:DU|DE|LE)\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s*(?:AU|À|A|JUSQU[’' ]?AU?)\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})",
        texte
    )
    if match_periode:
        date_effet = match_periode.group(1)
        date_expiration = match_periode.group(2)
        journal.info(f"✓ PÉRIODE COUVERTURE: {date_effet} -> {date_expiration}")

    if len(toutes_dates) >= 1:
        # Recherche après étiquettes (date d'effet)
        if not date_effet:
            match_date_effet = re.search(
                r"(?:DATE\s*D[’']?EFFET|START\s*DATE|EFFET\s*LE)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})",
                texte
            )
            if match_date_effet:
                date_effet = match_date_effet.group(1)

        # Recherche après étiquettes (date d'expiration)
        if not date_expiration:
            match_date_expiration = re.search(
                r"(?:DATE\s*D[’']?EXPIRATION|EXPIRY\s*DATE|EXPIRE\s*LE|JUSQU[’' ]?AU?)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})",
                texte
            )
            if match_date_expiration:
                date_expiration = match_date_expiration.group(1)

        # Repli : dernières dates (hors date de naissance déjà isolée)
        if not date_expiration and toutes_dates:
            candidats = [d for d in toutes_dates if d != date_naissance]
            if len(candidats) >= 1:
                date_expiration = candidats[-1]
            if len(candidats) >= 2:
                date_effet = candidats[-2]

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
        nom_assure=nom_assure,
        prenoms_assure=prenoms_assure,
        date_naissance=date_naissance,
        lieu_naissance=lieu_naissance,
        date_effet=date_effet,
        date_expiration=date_expiration,
        texte_brut=texte_brut[:5000],
        taux_confiance_moyen=confiance,
    )