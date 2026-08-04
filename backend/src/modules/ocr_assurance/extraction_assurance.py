# -*- coding: utf-8 -*-
"""
Extraction INTELLIGENTE pour l'Assurance Automobile.
Gère les documents variables avec une approche contextuelle robuste.
"""
import re
from typing import Optional, List, Tuple
from src.modules.ocr_assurance.schemas import DonneesAssuranceExtraites
from src.noyau.journal import journal

# Labels à exclure (mots qui ne sont JAMAIS des valeurs)
LABELS_A_EXCLURE = {
    'NOM', 'PRÉNOM', 'PRENOM', 'ASSURÉ', 'ASSURE', 'TITULAIRE', 
    'SOUSCRIPTEUR', 'CONDUCTEUR', 'VÉHICULE', 'VEHICULE', 'MARQUE', 
    'MODÈLE', 'MODELE', 'IMMATRICULATION', 'PLAQUE', 'DATE', 'ADRESSE',
    'TÉLÉPHONE', 'EMAIL', 'CONTRAT', 'POLICE', 'GARANTIE', 'PRIME',
    'COTISATION', 'FRANCHISE', 'PLAFOND', 'COUVERTURE', 'ASSISTANCE'
}

def _nettoyer_texte_assurance(texte: str) -> str:
    """Nettoie le texte OCR en préservant la structure."""
    texte = texte.upper()
    # Remplacer les sauts de ligne multiples par un marqueur
    texte = re.sub(r'\n\s*\n', ' § ', texte)
    # Normaliser les espaces
    texte = re.sub(r'\s+', ' ', texte)
    return texte.strip()

def _est_valeur_valide(texte: str, type_attendu: str) -> bool:
    """Vérifie si le texte extrait est une vraie valeur (pas un label)."""
    if not texte or len(texte) < 2:
        return False
    
    # Nettoyer
    texte_pur = re.sub(r'[^A-ZÀ-Ÿ\s\-]', '', texte).strip()
    
    # Vérifier que ce n'est pas un label
    mots = texte_pur.split()
    for mot in mots:
        if mot in LABELS_A_EXCLURE:
            return False
    
    # Vérifications spécifiques par type
    if type_attendu == "nom":
        # Un nom doit avoir au moins 2 lettres et ne pas être que des chiffres
        return len(texte_pur) >= 2 and not texte_pur.isdigit()
    
    elif type_attendu == "immatriculation":
        # Doit contenir des lettres ET des chiffres
        a_lettres = bool(re.search(r'[A-Z]', texte_pur))
        a_chiffres = bool(re.search(r'\d', texte_pur))
        return a_lettres and a_chiffres
    
    elif type_attendu == "numero_contrat":
        # Doit contenir des chiffres ou être un format alphanumérique
        return bool(re.search(r'\d', texte_pur)) or len(texte_pur) >= 5
    
    return True

def _extraire_valeur_apres_label(
    texte: str, 
    labels_possibles: List[str], 
    type_valeur: str,
    arreter_au_prochain_label: bool = True
) -> Optional[str]:
    """
    Extrait une valeur après un ou plusieurs labels possibles.
    
    Args:
        texte: Texte complet
        labels_possibles: Liste de regex pour les labels
        type_valeur: Type de valeur attendue (pour validation)
        arreter_au_prochain_label: Si True, s'arrête au prochain label
    """
    for label in labels_possibles:
        # Construire le pattern
        if arreter_au_prochain_label:
            # Capturer jusqu'au prochain label connu ou fin de ligne
            pattern = rf'{label}\s*[:\-]?\s*([^\n§]{{1,100}}?)(?=\s+(?:NOM|PRÉNOM|PRENOM|ASSUR[ÉE]|TITULAIRE|SOUSCRIPTEUR|VÉHICULE|VEHICULE|MARQUE|MODÈLE|IMMATRICULATION|PLAQUE|DATE|ADRESSE|CONTRAT|POLICE|GARANTIE|PRIME|COTISATION)\b|$)'
        else:
            pattern = rf'{label}\s*[:\-]?\s*([^\n§]{{1,100}})'
        
        match = re.search(pattern, texte, re.IGNORECASE)
        if match:
            valeur = match.group(1).strip()
            
            # Nettoyer
            valeur = re.sub(r'[^A-ZÀ-Ÿ0-9\s\-\.]', '', valeur)
            
            # Valider
            if _est_valeur_valide(valeur, type_valeur):
                journal.info(f"✓ Trouvé après '{label}': {valeur}")
                return valeur
    
    return None

def _separer_nom_prenom(valeur_complete: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Sépare intelligemment un nom complet en nom et prénom(s).
    Gère les formats: "DUPONT JEAN", "JEAN DUPONT", "DUPONT JEAN MICHEL"
    """
    if not valeur_complete:
        return None, None
    
    # Nettoyer
    valeur = re.sub(r'[^A-ZÀ-Ÿ\s\-]', '', valeur_complete).strip()
    mots = valeur.split()
    
    if len(mots) == 0:
        return None, None
    elif len(mots) == 1:
        # Un seul mot - probablement le nom
        return mots[0], None
    else:
        # Stratégie: le dernier mot en majuscules complètes est souvent le nom
        # OU le premier mot si c'est un nom composé
        if len(mots[-1]) > 3 and mots[-1].isupper():
            # Format: "JEAN MICHEL DUPONT" -> nom=DUPONT, prenoms=JEAN MICHEL
            nom = mots[-1]
            prenoms = " ".join(mots[:-1])
        else:
            # Format: "DUPONT JEAN" -> nom=DUPONT, prenoms=JEAN
            nom = mots[0]
            prenoms = " ".join(mots[1:])
        
        return nom.strip(), prenoms.strip()

def _extraire_date_par_contexte(texte: str, contextes: List[str]) -> Optional[str]:
    """Extrait une date qui suit un contexte donné."""
    for contexte in contextes:
        match = re.search(
            rf'{contexte}\s*[:\-]?\s*(\d{{1,2}}[./-]\d{{1,2}}[./-]\d{{2,4}})',
            texte
        )
        if match:
            return match.group(1)
    return None

def extraire_donnees_assurance(
    texte_brut: str,
    confiance: float = 0.0,
) -> DonneesAssuranceExtraites:
    """
    Extraction intelligente avec validation contextuelle.
    """
    if not texte_brut:
        return DonneesAssuranceExtraites(texte_brut="", taux_confiance_moyen=confiance)

    texte = _nettoyer_texte_assurance(texte_brut)
    journal.info(f"Texte nettoyé ({len(texte)} chars): {texte[:300]}...")
    
    # Initialisation
    donnees = {
        'compagnie_assurance': None,
        'numero_contrat': None,
        'immatriculation_vehicule': None,
        'marque_vehicule': None,
        'modele_vehicule': None,
        'date_effet': None,
        'date_expiration': None,
        'nom_assure': None,
        'prenoms_assure': None,
    }
    
    # === 1. IDENTITÉ DE L'ASSURÉ (NOM + PRÉNOMS) ===
    # Chercher dans une section dédiée si possible
    section_assure = re.search(
        r'(?:SOUSCRIPTEUR|ASSUR[ÉE]\(?S?\)?|TITULAIRE|CONDUCTEUR)\s*[:\-]?(.*?)(?=(?:VÉHICULE|VEHICULE|INFORMATIONS|GARANTIES|COTISATION|PRIME|$))',
        texte,
        re.DOTALL
    )
    
    if section_assure:
        contenu_section = section_assure.group(1)
        journal.info(f"Section assureur trouvée: {contenu_section[:100]}...")
        
        # Chercher "Nom & Prénom" ou "Nom Prénom"
        nom_prenom = _extraire_valeur_apres_label(
            contenu_section,
            [r'NOM\s*(?:&\s*PRÉNOM|ET\s*PRÉNOM)?', r'NOM\s*PRÉNOM', r'NOM'],
            "nom",
            arreter_au_prochain_label=True
        )
        
        if nom_prenom:
            nom, prenoms = _separer_nom_prenom(nom_prenom)
            donnees['nom_assure'] = nom
            donnees['prenoms_assure'] = prenoms
            journal.info(f"✓ NOM: {nom} / PRÉNOMS: {prenoms or ''}")
    
    # Fallback: chercher NOM et PRÉNOM séparément dans tout le texte
    if not donnees['nom_assure']:
        nom_seul = _extraire_valeur_apres_label(
            texte,
            [r'\bNOM\s+(?!D[EU]\b|DE\b|LA\b|LE\b)'],
            "nom",
            arreter_au_prochain_label=True
        )
        prenom_seul = _extraire_valeur_apres_label(
            texte,
            [r'\bPRÉNOM(?:S)?\b'],
            "nom",
            arreter_au_prochain_label=True
        )
        
        if nom_seul:
            donnees['nom_assure'] = nom_seul
            journal.info(f"✓ NOM (fallback): {nom_seul}")
        if prenom_seul:
            donnees['prenoms_assure'] = prenom_seul
            journal.info(f"✓ PRÉNOMS (fallback): {prenom_seul}")
    
    # === 2. COMPAGNIE D'ASSURANCE ===
    donnees['compagnie_assurance'] = _extraire_valeur_apres_label(
        texte,
        [r'COMPAGNIE', r'ASSUREUR', r'INSURER', r'SOCIÉT[ÉE]', r'SOCIETE'],
        "texte",
        arreter_au_prochain_label=True
    )
    
    # === 3. NUMÉRO DE CONTRAT ===
    donnees['numero_contrat'] = _extraire_valeur_apres_label(
        texte,
        [r'N[°O]\s*CONTRAT', r'CONTRAT\s*N[°O]?', r'POLICE\s*N[°O]?', r'N[°O]\s*POLICE'],
        "numero_contrat",
        arreter_au_prochain_label=False
    )
    
    # Fallback: chercher un pattern de numéro après "CONTRAT"
    if not donnees['numero_contrat']:
        match = re.search(r'CONTRAT\s*[:\-]?\s*([A-Z0-9\-]{5,30})', texte)
        if match and _est_valeur_valide(match.group(1), "numero_contrat"):
            donnees['numero_contrat'] = match.group(1)
            journal.info(f"✓ CONTRAT (fallback): {donnees['numero_contrat']}")
    
    # === 4. IMMATRICULATION ===
    donnees['immatriculation_vehicule'] = _extraire_valeur_apres_label(
        texte,
        [r'IMMATRICULATION', r'REGISTRATION', r'PLAQUE', r'LICENSE\s*PLATE'],
        "immatriculation",
        arreter_au_prochain_label=False
    )
    
    # Fallback: pattern de plaque
    if not donnees['immatriculation_vehicule']:
        match = re.search(r'\b([A-Z]{1,3}[\-]?\d{2,4}[\-]?[A-Z]{1,3})\b', texte)
        if match:
            donnees['immatriculation_vehicule'] = match.group(1)
            journal.info(f"✓ IMMAT (pattern): {donnees['immatriculation_vehicule']}")
    
    # === 5. MARQUE ET MODÈLE ===
    # Chercher "Marque / Modèle" ensemble
    match_marque_modele = re.search(
        r'MARQUE\s*/\s*MODÈLE\s*[:\-]?\s*([^\n§]+)',
        texte
    )
    if match_marque_modele:
        valeur = match_marque_modele.group(1).strip()
        # Nettoyer et valider
        valeur = re.sub(r'[^A-ZÀ-Ÿ0-9\s\-\.]', '', valeur)
        if _est_valeur_valide(valeur, "texte"):
            # Séparer marque et modèle
            if '/' in valeur:
                parties = valeur.split('/')
                donnees['marque_vehicule'] = parties[0].strip()
                donnees['modele_vehicule'] = parties[1].strip() if len(parties) > 1 else None
            else:
                # Prendre les 2-3 premiers mots comme marque, le reste comme modèle
                mots = valeur.split()
                if len(mots) >= 2:
                    donnees['marque_vehicule'] = mots[0]
                    donnees['modele_vehicule'] = " ".join(mots[1:])
                else:
                    donnees['marque_vehicule'] = valeur
            
            journal.info(f"✓ MARQUE/MODÈLE: {donnees['marque_vehicule']} / {donnees['modele_vehicule']}")
    
    # Fallback: chercher séparément
    if not donnees['marque_vehicule']:
        donnees['marque_vehicule'] = _extraire_valeur_apres_label(
            texte,
            [r'\bMARQUE\b', r'\bMAKE\b'],
            "texte",
            arreter_au_prochain_label=True
        )
    
    if not donnees['modele_vehicule']:
        donnees['modele_vehicule'] = _extraire_valeur_apres_label(
            texte,
            [r'\bMODÈLE\b', r'\bMODEL\b'],
            "texte",
            arreter_au_prochain_label=True
        )
    
    # === 6. DATES DE COUVERTURE ===
    # Format "VALABLE DU X AU Y"
    match_periode = re.search(
        r"VALABLE\s*(?:DU|DE|LE)\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s*(?:AU|À|A|JUSQU[’' ]?AU?)\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})",
        texte
    )
    if match_periode:
        donnees['date_effet'] = match_periode.group(1)
        donnees['date_expiration'] = match_periode.group(2)
        journal.info(f"✓ PÉRIODE: {donnees['date_effet']} -> {donnees['date_expiration']}")
    else:
        # Chercher séparément
        donnees['date_effet'] = _extraire_date_par_contexte(
            texte,
            [r"DATE\s*D[’']?EFFET", r"START\s*DATE", r"EFFET\s*LE", r"DU"]
        )
        donnees['date_expiration'] = _extraire_date_par_contexte(
            texte,
            [r"DATE\s*D[’']?EXPIRATION", r"EXPIRY\s*DATE", r"JUSQU[’' ]?AU?", r"AU"]
        )
    
    # Fallback: utiliser toutes les dates trouvées
    if not donnees['date_effet'] or not donnees['date_expiration']:
        toutes_dates = re.findall(r'\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b', texte)
        if len(toutes_dates) >= 2:
            if not donnees['date_effet']:
                donnees['date_effet'] = toutes_dates[0]
            if not donnees['date_expiration']:
                donnees['date_expiration'] = toutes_dates[-1]
            journal.info(f"✓ Dates (fallback): {donnees['date_effet']} -> {donnees['date_expiration']}")
    
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