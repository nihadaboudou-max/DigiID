# -*- coding: utf-8 -*-
"""
Extraction HYBRIDE pour l'Assurance Automobile.
Combine la puissance du NLP (spaCy) et la robustesse des Regex avec gestion des mots collés.
"""
import re
from typing import Optional, List, Tuple, Dict, Any
from src.modules.ocr_assurance.schemas import DonneesAssuranceExtraites
from src.noyau.journal import journal

# ✅ IMPORT DU MODULE NLP
try:
    from src.modules.ocr_assurance.extraction_nlp import extraire_avec_nlp
    NLP_DISPONIBLE = True
except ImportError:
    NLP_DISPONIBLE = False
    journal.warning("Module NLP non trouvé. Utilisation du mode Regex uniquement.")

# Labels à exclure (mots qui ne sont JAMAIS des valeurs)
LABELS_A_EXCLURE = {
    'NOM', 'PRÉNOM', 'PRENOM', 'ASSURÉ', 'ASSURE', 'TITULAIRE', 
    'SOUSCRIPTEUR', 'CONDUCTEUR', 'VÉHICULE', 'VEHICULE', 'MARQUE', 
    'MODÈLE', 'MODELE', 'IMMATRICULATION', 'PLAQUE', 'DATE', 'ADRESSE',
    'TÉLÉPHONE', 'EMAIL', 'CONTRAT', 'POLICE', 'GARANTIE', 'PRIME',
    'COTISATION', 'FRANCHISE', 'PLAFOND', 'COUVERTURE', 'ASSISTANCE',
    'INFORMATIONS', 'DURÉE', 'FORMULE', 'USAGE', 'PUISANCE', 'ANNÉE'
}

def _separer_mots_colles(texte: str) -> str:
    """Sépare les mots collés par l'OCR (ex: 'CONTRATDASSURANCE' -> 'CONTRAT D ASSURANCE')."""
    if not texte:
        return texte
    texte = re.sub(r'([a-z0-9À-Ÿ])([A-Z])', r'\1 \2', texte)
    texte = re.sub(r'([A-ZÀ-Ÿ])(\d)', r'\1 \2', texte)
    texte = re.sub(r'(\d)([A-ZÀ-Ÿ])', r'\1 \2', texte)
    return texte

def _nettoyer_texte_assurance(texte: str) -> str:
    """Nettoie le texte OCR en préservant la structure."""
    texte = _separer_mots_colles(texte)
    texte = texte.upper()
    texte = re.sub(r'\n\s*\n', ' § ', texte)
    texte = re.sub(r'\s+', ' ', texte)
    return texte.strip()

def _est_valeur_valide(texte: str, type_attendu: str) -> bool:
    """Vérifie si le texte extrait est une vraie valeur et non un label."""
    if not texte or len(texte) < 2:
        return False
    texte_pur = re.sub(r'[^A-ZÀ-Ÿ\s\-]', '', texte).strip()
    mots = texte_pur.split()
    
    for mot in mots:
        if mot in LABELS_A_EXCLURE:
            return False
    
    if type_attendu == "nom":
        return len(texte_pur) >= 2 and not texte_pur.isdigit()
    elif type_attendu == "immatriculation":
        return bool(re.search(r'[A-Z]', texte_pur)) and bool(re.search(r'\d', texte_pur))
    elif type_attendu == "numero_contrat":
        return bool(re.search(r'[\d\-]', texte_pur)) and len(texte_pur) >= 5
    return True

def _extraire_valeur_apres_label(
    texte: str, 
    labels_possibles: List[str], 
    type_valeur: str,
    arreter_au_prochain_label: bool = True
) -> Optional[str]:
    """Extrait une valeur après un ou plusieurs labels possibles."""
    for label in labels_possibles:
        if arreter_au_prochain_label:
            pattern = rf'{label}\s*[:\-]?\s*([^\n§]{{1,100}}?)(?=\s+(?:NOM|PRÉNOM|PRENOM|ASSUR[ÉE]|TITULAIRE|SOUSCRIPTEUR|VÉHICULE|VEHICULE|MARQUE|MODÈLE|IMMATRICULATION|PLAQUE|DATE|ADRESSE|CONTRAT|POLICE|GARANTIE|PRIME|COTISATION)\b|$)'
        else:
            pattern = rf'{label}\s*[:\-]?\s*([^\n§]{{1,100}})'
        
        match = re.search(pattern, texte, re.IGNORECASE)
        if match:
            valeur = match.group(1).strip()
            valeur = re.sub(r'[^A-ZÀ-Ÿ0-9\s\-\.]', '', valeur)
            if _est_valeur_valide(valeur, type_valeur):
                return valeur
    return None

def _separer_nom_prenom(valeur_complete: str) -> Tuple[Optional[str], Optional[str]]:
    """Sépare un nom complet en nom et prénom(s).

    Convention française « NOM Prénom(s) » : le premier mot est le nom de famille.
    NB : le texte OCR est en MAJUSCULES → la détection par casse est inutile
    (l'ancienne heuristique renvoyait toujours le DERNIER mot comme nom, ce qui
    produisait des inversions type nom=NIHAD). La vérification d'identité finale
    (service.py) compare l'identité GLOBALE pour couvrir les cas imparfaits.
    """
    if not valeur_complete:
        return None, None
    valeur = re.sub(r'[^A-ZÀ-Ÿ\s\-]', '', valeur_complete).strip()
    mots = valeur.split()
    
    if len(mots) == 0:
        return None, None
    elif len(mots) == 1:
        return mots[0], None
    else:
        # Convention française : NOM en premier (ex: DUPONT JEAN MICHEL)
        return mots[0], " ".join(mots[1:])

def _extraire_date_par_contexte(texte: str, contextes: List[str]) -> Optional[str]:
    """Extrait une date qui suit un contexte donné."""
    for contexte in contextes:
        match = re.search(rf'{contexte}\s*[:\-]?\s*(\d{{1,2}}[./-]\d{{1,2}}[./-]\d{{2,4}})', texte)
        if match:
            return match.group(1)
    return None

# =============================================================================
# FONCTION PRINCIPALE D'EXTRACTION
# =============================================================================
def extraire_donnees_assurance(
    texte_brut: str,
    confiance: float = 0.0,
) -> DonneesAssuranceExtraites:
    """
    Extraction hybride : NLP (prioritaire) + Regex (fallback robuste).
    """
    if not texte_brut:
        return DonneesAssuranceExtraites(texte_brut="", taux_confiance_moyen=confiance)

    # 1. Tentative d'extraction NLP (avec protection en cas d'erreur)
    donnees_nlp: Dict[str, Any] = {}
    if NLP_DISPONIBLE:
        try:
            donnees_nlp = extraire_avec_nlp(texte_brut)
            journal.info(f"✓ NLP Actif: Nom={donnees_nlp.get('nom_personne')}, Org={donnees_nlp.get('organisation')}")
        except Exception as e:
            journal.warning(f"Échec extraction NLP, fallback sur Regex: {e}")

    # 2. Nettoyage du texte pour les Regex
    texte = _nettoyer_texte_assurance(texte_brut)
    
    # Initialisation du dictionnaire de données
    donnees = {
        'compagnie_assurance': donnees_nlp.get('organisation'),
        'numero_contrat': donnees_nlp.get('numero_contrat'),
        'immatriculation_vehicule': donnees_nlp.get('immatriculation'),
        'marque_vehicule': None,
        'modele_vehicule': None,
        'date_effet': donnees_nlp.get('date_effet'),
        'date_expiration': donnees_nlp.get('date_expiration'),
        'nom_assure': donnees_nlp.get('nom_personne'),
        'prenoms_assure': None,
    }

    # === 1. IDENTITÉ DE L'ASSURÉ (Fallback Regex si NLP échoue) ===
    if not donnees['nom_assure']:
        nom_prenom = _extraire_valeur_apres_label(
            texte, [r'NOM\s*(?:&\s*PRÉNOM|ET\s*PRÉNOM)?', r'NOM\s+PRÉNOM'], "nom", arreter_au_prochain_label=True
        )
        if nom_prenom:
            donnees['nom_assure'], donnees['prenoms_assure'] = _separer_nom_prenom(nom_prenom)
        else:
            donnees['nom_assure'] = _extraire_valeur_apres_label(texte, [r'\bNOM\s+(?!D[EU]\b|DE\b|LA\b|LE\b)'], "nom", True)
            donnees['prenoms_assure'] = _extraire_valeur_apres_label(texte, [r'\bPRÉNOM(?:S)?\b'], "nom", True)
        
        if donnees['nom_assure']:
            journal.info(f"✓ NOM (Regex): {donnees['nom_assure']} / PRÉNOMS: {donnees['prenoms_assure'] or ''}")

    # === 2. NUMÉRO DE CONTRAT (Fallback Regex) ===
    if not donnees['numero_contrat']:
        match_contrat = re.search(r'\b([A-Z]{2,4}[\-]\d{4}[\-]\d{2}[\-]\d{5,7})\b', texte)
        if match_contrat:
            donnees['numero_contrat'] = match_contrat.group(1)
        else:
            donnees['numero_contrat'] = _extraire_valeur_apres_label(
                texte, [r'N[°O]\s*CONTRAT', r'CONTRAT\s*N[°O]?', r'POLICE\s*N[°O]?'], "numero_contrat", False
            )
        if donnees['numero_contrat']:
            journal.info(f"✓ CONTRAT: {donnees['numero_contrat']}")

    # === 3. IMMATRICULATION (Fallback Regex) ===
    if not donnees['immatriculation_vehicule']:
        donnees['immatriculation_vehicule'] = _extraire_valeur_apres_label(
            texte, [r'IMMATRICULATION', r'REGISTRATION', r'PLAQUE'], "immatriculation", False
        )
        if not donnees['immatriculation_vehicule']:
            match_immat = re.search(r'\b([A-Z]{1,3}[\-]?\d{2,4}[\-]?[A-Z]{1,3})\b', texte)
            if match_immat:
                donnees['immatriculation_vehicule'] = match_immat.group(1)
        if donnees['immatriculation_vehicule']:
            journal.info(f"✓ IMMATRICULATION: {donnees['immatriculation_vehicule']}")

    # === 4. MARQUE ET MODÈLE (Regex reste le meilleur ici) ===
    match_marque_modele = re.search(r'MARQUE\s*/\s*MODÈLE\s*[:\-]?\s*([^\n§]+)', texte)
    if match_marque_modele:
        valeur = re.sub(r'[^A-ZÀ-Ÿ0-9\s\-\.]', '', match_marque_modele.group(1).strip())
        if _est_valeur_valide(valeur, "texte"):
            if '/' in valeur:
                parties = valeur.split('/')
                donnees['marque_vehicule'] = parties[0].strip()
                donnees['modele_vehicule'] = parties[1].strip() if len(parties) > 1 else None
            else:
                match_marque = re.search(r'(TOYOTA|PEUGEOT|RENAULT|CITROEN|NISSAN|HYUNDAI|KIA|BMW|MERCEDES|AUDI|VOLKSWAGEN)', valeur)
                if match_marque:
                    donnees['marque_vehicule'] = match_marque.group(1)
                    donnees['modele_vehicule'] = valeur[valeur.find(match_marque.group(1)) + len(match_marque.group(1)):].strip()
                else:
                    mots = valeur.split()
                    donnees['marque_vehicule'] = mots[0] if len(mots) >= 1 else valeur
                    donnees['modele_vehicule'] = " ".join(mots[1:]) if len(mots) >= 2 else None
            journal.info(f"✓ MARQUE/MODÈLE: {donnees['marque_vehicule']} / {donnees['modele_vehicule']}")

    # === 5. COMPAGNIE D'ASSURANCE (Fallback Regex) ===
    if not donnees['compagnie_assurance']:
        match_compagnie = re.search(r'^(ZUTO|NSIA|UGAN|SUNU|SAHAM|VISTA)\s*(ASSURANCES?)?', texte)
        if match_compagnie:
            donnees['compagnie_assurance'] = f"{match_compagnie.group(1)} {match_compagnie.group(2) or ''}".strip()
        else:
            donnees['compagnie_assurance'] = _extraire_valeur_apres_label(
                texte, [r'COMPAGNIE', r'ASSUREUR', r'INSURER'], "texte", True
            )
        if donnees['compagnie_assurance']:
            journal.info(f"✓ COMPAGNIE: {donnees['compagnie_assurance']}")

    # === 6. DATES DE COUVERTURE (Fallback Regex) ===
    match_periode = re.search(
        r"VALABLE\s*(?:DU|DE|LE)\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s*(?:AU|À|A|JUSQU[’' ]?AU?)\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})",
        texte
    )
    if match_periode:
        donnees['date_effet'] = match_periode.group(1)
        donnees['date_expiration'] = match_periode.group(2)
    else:
        if not donnees['date_effet']:
            donnees['date_effet'] = _extraire_date_par_contexte(texte, [r"DATE\s*D[’']?EFFET", r"START\s*DATE", r"EFFET\s*LE", r"DU"])
        if not donnees['date_expiration']:
            donnees['date_expiration'] = _extraire_date_par_contexte(texte, [r"DATE\s*D[’']?EXPIRATION", r"EXPIRY\s*DATE", r"JUSQU[’' ]?AU?", r"AU", r"ECHEANCE"])
    
    # Fallback ultime sur toutes les dates
    if not donnees['date_effet'] or not donnees['date_expiration']:
        toutes_dates = re.findall(r'\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b', texte)
        if len(toutes_dates) >= 2:
            if not donnees['date_effet']: donnees['date_effet'] = toutes_dates[0]
            if not donnees['date_expiration']: donnees['date_expiration'] = toutes_dates[-1]
            journal.info(f"✓ Dates (Fallback): {donnees['date_effet']} -> {donnees['date_expiration']}")

    # === VALIDATION FINALE ===
    champs_critiques = sum([
        bool(donnees['compagnie_assurance']),
        bool(donnees['numero_contrat']),
        bool(donnees['immatriculation_vehicule']),
        bool(donnees['date_expiration'])
    ])
    
    journal.warning(f"Extraction terminée: {champs_critiques}/4 champs critiques")
    if champs_critiques < 2:
        journal.error(f"EXTRACTION INSUFFISANTE - Texte: {texte[:500]}")
    
    return DonneesAssuranceExtraites(
        **donnees,
        texte_brut=texte_brut[:5000],
        taux_confiance_moyen=confiance,
    )