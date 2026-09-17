# -*- coding: utf-8 -*-
"""
Extracteur NLP (Regex avancées) pour documents sans MRZ.
Règle anti-hallucination : ne retourne JAMAIS un label comme valeur de champ.
Solution universelle : délimitation dynamique des champs par les labels connus + mapping typographique.
"""
import re
from typing import Dict, List, Optional
from src.noyau import journal

# =============================================================================
# Mois (français / anglais) pour parser les dates en toutes lettres
# =============================================================================
_MOIS = {
    "JANVIER": 1, "JANV": 1, "JAN": 1, "JANUARY": 1,
    "FEVRIER": 2, "FEVR": 2, "FEV": 2, "FEBRUARY": 2, "FEB": 2,
    "MARS": 3, "MAR": 3, "MARCH": 3,
    "AVRIL": 4, "AVR": 4, "APRIL": 4, "APR": 4,
    "MAI": 5, "MAY": 5,
    "JUIN": 6, "JUN": 6, "JUNE": 6,
    "JUILLET": 7, "JUIL": 7, "JUL": 7, "JULY": 7,
    "AOUT": 8, "AOÛT": 8, "AOU": 8, "AUGUST": 8, "AUG": 8,
    "SEPTEMBRE": 9, "SEPT": 9, "SEP": 9, "SEPTEMBER": 9,
    "OCTOBRE": 10, "OCT": 10, "OCTOBER": 10,
    "NOVEMBRE": 11, "NOV": 11, "NOVEMBER": 11,
    "DECEMBRE": 12, "DEC": 12, "DECEMBER": 12,
}

# =============================================================================
# Labels de champs (FR/EN) à ignorer en tant que valeurs + mots neutres
# =============================================================================
_LABELS = {
    "NOM", "NOMS", "SURNAME", "SURNAMES", "LASTNAME", "LASTNAMES", "FAMILYNAME",
    "PRENOM", "PRENOMS", "GIVENNAME", "GIVENNAMES", "FIRSTNAME", "FIRSTNAMES",
    "GIVEN", "FIRST", "LAST", "NAME", "NAMES", "NE", "NEE", "NÉ", "NÉE",
    "DATE", "NAISSANCE", "BIRTH", "DATEOFBIRTH", "DOB",
    "SEXE", "SEX", "GENDER",
    "LIEU", "LIEUDENAISSANCE", "PLACE", "PLACEOF", "PLACEOFBIRTH",
    "NATIONALITE", "NATIONALITY",
    "NUMERO", "NUMBER", "N°", "DOCUMENT", "DOCUMENTNO", "DOCUMENTNUMBER",
    "NO", "N", "NUM", "CARTE", "DIDENTITE", "IDENTITE", "IDENTIFICATION",
    "IDENTITY", "IDENTIFIANT", "MATRICULE", "CODEPAYS", "CODE",
    "EXPIRATION", "EXPIRY", "EXPIREDATE", "EXPIRES", "EXP", "EXPIRE",
    "VALIDITE", "VALIDITY", "VALIDITEJUSQUAU", "VALID", "VALIDE",
    "DELIVRANCE", "DELIVREE", "DELIVRE", "ISSUE", "ISSUEDATE", "DATEOFISSUE",
    "SIGNATURE", "AUTORITE", "AUTHORITY", "EMETTEUR", "ISSUING",
    "REPUBLIQUE", "REPUBLIQUEDU", "GOUVERNEMENT", "MINISTERE", "MINISTRY",
    "NATIONAL", "NATIONALE", "INTERIEUR", "SECURITE", "OFFICIEL", "OFFICIAL",
    "PHOTO", "FACE", "VERSO", "RECTO", "HORS", "SERVICE", "NON",
    "ETAT", "CIVIL", "ETATCIVIL", "MARITAL", "STATUS", "PROFESSION",
    "OCCUPATION", "RESIDENCE", "ADRESSE", "ADDRESS", "VILLE", "CITY",
    "PAYS", "COUNTRY", "TAILLE", "HEIGHT", "GROUPE", "SANGUIN",
    "GROUPESANGUIN", "BLOOD", "BLOODGROUP", "TYPE", "CATEGORIE", "CATEGORIES",
    "CLASSE", "LICENCE", "LICENSE", "CONDUITE", "DRIVING", "PERMIS",
    "ASSURANCE", "POLICE", "CONTRAT", "CLIENT", "ATTESTATION", "VERTE",
    "TITRE", "TITULAIRE", "HOLDER", "PORTEUR", "SIGNALEMENT", "ENFANT",
    "NOMDUSAGE", "USUALNAME", "ALIAS", "SEJOUR", "VOTE", "ELECTEUR",
    "ETUDIANT", "SCOLARITE", "PASSEPORT", "PASSPORT", "AUTORISATION",
    # Labels spécifiques pour délimiter les champs adjacents (Assurance, etc.)
    "MARQUE", "MODELE", "VEHICULE", "IMMATRICULATION", "TELEPHONE", "EMAIL",
    "NR", "FI" # Artefacts OCR fréquents
}

_NEUTRES = {
    "DE", "DU", "DES", "D", "L", "LE", "LA", "LES", "UN", "UNE",
    "AU", "AUX", "A", "ET", "EN", "N", "NO", "N°",
}

# =============================================================================
# 🛡️ LISTE NOIRE D'IDENTITÉ : tokens qui ne sont JAMAIS un nom de personne.
# Empêche le mapping de champs (ex: "TOYOTA" -> nom_famille / prénom).
# =============================================================================
_MOTS_INTERDITS_NOM = {
    # Marques / modèles véhicules (cause n°1 des faux noms)
    "TOYOTA", "NISSAN", "HONDA", "FORD", "HYUNDAI", "KIA", "PEUGEOT", "RENAULT",
    "CITROEN", "MERCEDES", "BENZ", "BMW", "AUDI", "VOLKSWAGEN", "SUZUKI", "MAZDA",
    "MITSUBISHI", "CHEVROLET", "FIAT", "DACIA", "OPEL", "SKODA", "SEAT", "JEEP",
    "COROLLA", "YARIS", "HILUX", "CAMRY", "RAV4", "PRIUS", "CIVIC", "ACCENT",
    "ELANTRA", "SUNNY", "PASSAT", "GOLF", "CLIO", "MEGANE", "PARTNER", "BERLINGO",
    # Champs techniques véhicule
    "MARQUE", "MODELE", "VEHICULE", "IMMATRICULATION", "IMMAT", "CHASSIS", "VIN",
    "CYLINDREE", "PUISSANCE", "CARROSSERIE", "ENERGIE", "ESSENCE", "DIESEL",
    "BERLINE", "BREAK", "PLAQUE", "IMMATRICULE",
    # Vocabulaire assurance / société / banque
    "ASSURANCE", "ASSURANCES", "COMPAGNIE", "ASSUREUR", "POLICE", "CONTRAT",
    "ATTESTATION", "GARANTIE", "PRIME", "COTISATION", "FRANCHISE", "PLAFOND",
    "COUVERTURE", "ASSISTANCE", "FORMULE", "USAGE", "ECHEANCE", "ECHÉANCE",
    "VALIDITE", "VALIDITÉ", "RESPONSABILITE", "CIVILE", "SOCIETE", "SOCIÉTÉ",
    "BANQUE", "CLIENT", "SOUSCRIPTEUR", "CONDUCTEUR", "TITULAIRE", "PORTEUR",
}

# =============================================================================
# 🛡️ VALIDATION D'UN TOKEN D'IDENTITÉ (nom/prénom)
# =============================================================================
def _mot_interdit_nom(mot: str) -> bool:
    """True si le token ne peut jamais être un nom de personne."""
    m = _sans_accents((mot or "").upper()).strip("-'.,:;()")
    return m in _MOTS_INTERDITS_NOM

def _est_mot_nom_valide(mot: str) -> bool:
    """Un token est un nom-plausible : alphabétique, >=2 lettres, hors blacklist/labels."""
    m = _sans_accents((mot or "").upper()).strip("-'.")
    if len(m) < 2:
        return False
    if not re.fullmatch(r"[A-Z][A-Z\-']*", m):
        return False
    if m in _MOTS_INTERDITS_NOM or m in _LABELS or m in _NEUTRES:
        return False
    return True

_CONTEXTES_NETTOYAGE = {
    "nom_famille": "nom",
    "prenoms": "prenoms",
    "date_naissance": "date",
    "date_expiration": "date",
    "date_delivrance": "date",
    "sexe": "sexe",
    "numero_document": "numero",
    "lieu_naissance": "lieu",
}

# =============================================================================
# Utilitaires de base
# =============================================================================
def _sans_accents(texte: str) -> str:
    for a, b in [("É", "E"), ("È", "E"), ("Ê", "E"), ("Ë", "E"),
                 ("À", "A"), ("Â", "A"), ("Ä", "A"),
                 ("Î", "I"), ("Ï", "I"),
                 ("Ô", "O"), ("Ö", "O"),
                 ("Ù", "U"), ("Û", "U"), ("Ü", "U"),
                 ("Ç", "C"), ("Œ", "OE"), ("Æ", "AE")]:
        texte = texte.replace(a, b)
    return texte

def _mots(texte: str) -> List[str]:
    return [w for w in re.split(r"[^A-Z0-9]+", _sans_accents((texte or "").upper())) if w]

def _ligne_est_que_labels(texte: str) -> bool:
    mots = _mots(texte)
    if not mots: return True
    for m in mots:
        if m not in _LABELS and m not in _NEUTRES:
            return False
    return True

def _retirer_mots_labels_prefixe(texte: str) -> str:
    mots = re.split(r"[\s/:;,()|]+", texte)
    sortie: List[str] = []
    vu_donnee = False
    for m in mots:
        if not m: continue
        normalise = _sans_accents(m.upper()).strip(".,")
        if not vu_donnee:
            if normalise in _LABELS or normalise in _NEUTRES: continue
            vu_donnee = True
        sortie.append(m)
    return " ".join(sortie).strip()

# =============================================================================
# 🚀 SOLUTION UNIVERSELLE 1 : Délimitation dynamique par les labels
# =============================================================================
def _construire_regex_fin_de_champ() -> str:
    """Construit dynamiquement une regex qui détecte n'importe quel label connu."""
    labels_tries = sorted(list(_LABELS), key=len, reverse=True)
    labels_echappes = [re.escape(l) for l in labels_tries if l]
    return r"(?=\s+(?:" + "|".join(labels_echappes) + r")\s*[:\-]?\s)"

# =============================================================================
# 🚀 SOLUTION UNIVERSELLE 2 : Mapping typographique d'identité
# =============================================================================
def _normaliser_et_mapper_identite(texte_brut: str) -> Dict[str, Optional[str]]:
    """
    Moteur universel de mapping d'identité (typographie NOM/prénom).
    🛡️ Durci : n'opère plus aveuglément sur tout le texte ; tout token non-personne
    (marque, société, champ technique) invalide le résultat -> zéro fusion 'Toyota'.
    """
    vide = {"nom_famille": None, "prenoms": None}
    if not texte_brut:
        return vide

    # 1. Nettoyage des artefacts de début de ligne et labels
    texte_propre = re.sub(r"^[^a-zA-ZÀ-ÿ]+", "", texte_brut).strip()
    texte_propre = re.sub(
        r"^(NOM|PRENOM|NOMS|PRENOMS|SURNAME|FIRSTNAME|NR|FI)\s*[:\-]?\s*",
        "", texte_propre, flags=re.IGNORECASE,
    ).strip()
    if not texte_propre:
        return vide

    # 2. GARDE-FOU : la présence d'un token interdit (marque/véhicule/société) => rejet.
    tokens_bruts = [t for t in re.split(r"[\s,;/]+", texte_propre) if t]
    if any(_mot_interdit_nom(t) for t in tokens_bruts):
        journal.warning("Mapping identité: token non-personne détecté -> fallback ignoré.")
        return vide

    # 3. On ne conserve QUE les tokens plausibles d'un nom de personne.
    tokens = [t for t in tokens_bruts if _est_mot_nom_valide(t)]
    if not tokens:
        return vide

    nom_parts = [m for m in tokens if m.isupper() and len(m) > 1]
    prenom_parts = [m for m in tokens if not (m.isupper() and len(m) > 1)]

    nom_famille = " ".join(nom_parts).strip() or None
    prenoms = " ".join(prenom_parts).strip() or None

    # 4. Rééquilibrage quand la casse ne tranche pas (tout majuscule OU tout minuscule).
    if not nom_famille and prenoms:
        parties = prenoms.split()
        if len(parties) >= 2:
            nom_famille, prenoms = parties[0], " ".join(parties[1:])
        else:
            nom_famille, prenoms = prenoms, None
    elif not prenoms and nom_famille:
        parties = nom_famille.split()
        if len(parties) >= 2:
            prenoms = parties[-1].capitalize()
            nom_famille = " ".join(parties[:-1])

    return {
        "nom_famille": nom_famille if nom_famille and len(nom_famille) >= 2 else None,
        "prenoms": prenoms if prenoms and len(prenoms) >= 2 else None,
    }

# =============================================================================
# Parsing de date tolérant
# =============================================================================
def _annee_complete(annee: str) -> Optional[int]:
    if not annee: return None
    if len(annee) == 2:
        a = int(annee)
        return 1900 + a if a >= 40 else 2000 + a
    return int(annee) if 1900 <= int(annee) <= 2100 else None

def _valider_jour_mois_annee(jour: int, mois: int, annee: int) -> bool:
    return 1 <= jour <= 31 and 1 <= mois <= 12 and 1900 <= annee <= 2100

def _parser_date(valeur: str) -> Optional[str]:
    if not valeur: return None
    v = valeur.strip().strip(".:;,")
    m = re.search(r"(\d{1,2})\s*[/.\- ]\s*(\d{1,2})\s*[/.\- ]\s*(\d{2,4})", v)
    if m:
        jour, mois, annee = int(m.group(1)), int(m.group(2)), m.group(3)
        a4 = _annee_complete(annee)
        if a4 and _valider_jour_mois_annee(jour, mois, a4):
            return f"{jour:02d}/{mois:02d}/{a4:04d}"
    m = re.search(r"(\d{1,2})\s*[/.\- ]\s*([A-Za-zÀ-ÿ]{3,})\s*[/.\- ]\s*(\d{2,4})", v)
    if m:
        jour = int(m.group(1))
        mois_num = _MOIS.get(_sans_accents(m.group(2)).upper().rstrip("."))
        a4 = _annee_complete(m.group(3))
        if mois_num and a4 and _valider_jour_mois_annee(jour, mois_num, a4):
            return f"{jour:02d}/{mois_num:02d}/{a4:04d}"
    m = re.search(r"(\d{4})\s*[/.\- ]\s*(\d{1,2})\s*[/.\- ]\s*(\d{1,2})", v)
    if m:
        annee, mois, jour = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if _valider_jour_mois_annee(jour, mois, annee):
            return f"{jour:02d}/{mois:02d}/{annee:04d}"
    m = re.search(r"^(\d{2})(\d{2})(\d{4}|\d{2})$", v)
    if m:
        jour, mois = int(m.group(1)), int(m.group(2))
        a4 = _annee_complete(m.group(3))
        if a4 and _valider_jour_mois_annee(jour, mois, a4):
            return f"{jour:02d}/{mois:02d}/{a4:04d}"
    return None

# =============================================================================
# Nettoyage sécurisé des valeurs
# =============================================================================
def _nettoyer_valeur_securisee(valeur: str, contexte: str) -> Optional[str]:
    if not valeur: return None
    valeur = valeur.strip().strip(":;,.-\"'()|/ ")
    if not valeur: return None
    
    if contexte in ("nom", "prenoms"):
        if _ligne_est_que_labels(valeur): return None
        if re.fullmatch(r"\d+", valeur): return None
        propre = re.sub(r"[^a-zA-ZÀ-ÿ\s\-']", "", valeur).strip()
        if len(propre) < 2: return None
        # 🛡️ Rejet d'une valeur contenant un token non-personne (marque, société, label)
        tokens = [t for t in re.split(r"[\s\-']+", propre) if t]
        if not tokens or any(_mot_interdit_nom(t) for t in tokens):
            return None
        if not any(_est_mot_nom_valide(t) for t in tokens):
            return None
        return propre
    if contexte == "numero":
        valeur = "".join(c for c in valeur.upper() if c.isalnum())
        return valeur if 5 <= len(valeur) <= 20 else None
    if contexte == "date": return _parser_date(valeur)
    if contexte == "sexe":
        v = valeur.upper()[:1]
        return "M" if v in ("M", "H") else "F" if v == "F" else None
    if contexte == "lieu":
        if _ligne_est_que_labels(valeur): return None
        propre = re.sub(r"[^a-zA-ZÀ-ÿ\s\-']", "", valeur).strip()
        return propre if len(propre) >= 2 else None
    return valeur if valeur else None

# =============================================================================
# Extraction de valeur depuis les lignes OCR (avec coupure dynamique)
# =============================================================================
def _valeur_depuis_ligne(reste: str) -> Optional[str]:
    if not reste: return None
    nettoye = reste.strip().strip(" \t:;,-/|·•\"'()")
    if not nettoye or _ligne_est_que_labels(nettoye): return None
    
    # 🚀 COUPURE DYNAMIQUE : s'arrête net avant le prochain label
    regex_fin = _construire_regex_fin_de_champ()
    valeur_coupee = re.split(regex_fin, nettoye, flags=re.IGNORECASE)[0].strip()
    
    nettoye = _retirer_mots_labels_prefixe(valeur_coupee).strip(" \t:;,-/|·•\"'()")
    return nettoye or None

def _chercher_valeur_lignes_suivantes(lignes: List[str], debut: int) -> Optional[str]:
    for j in range(debut, min(debut + 4, len(lignes))):
        ligne = lignes[j].strip()
        if not ligne: continue
        if _ligne_est_que_labels(ligne): continue
        premier = _mots(ligne)[0] if _mots(ligne) else ""
        if premier in _LABELS or premier in _NEUTRES: continue
        return ligne
    return None


# =============================================================================
# Extraction spécifique : Permis de conduire (Format CEDEAO numéroté OU non-numéroté)
# =============================================================================
def extraire_permis_conduire(texte: str) -> Dict:
    """
    Extraction ultra-robuste pour permis de conduire.
    Gère à la fois les formats numérotés (1., 2., 4a...) et les formats sans numéros.
    Utilise un filet de sécurité typographique en dernier recours.
    """
    resultats = {}
    if not texte:
        return resultats

    texte_nettoye = _nettoyer_texte_permis(texte)
    lignes = texte_nettoye.split("\n")
    
    journal.info(f"Permis: Début extraction robuste ({len(texte_nettoye)} chars)")

    # === 1. DÉTECTION PAYS ===
    if "BENIN" in texte_nettoye or "BEN" in texte_nettoye:
        resultats["pays_emetteur"] = "BEN"
    elif "SENEGAL" in texte_nettoye or "SEN" in texte_nettoye:
        resultats["pays_emetteur"] = "SEN"

    # === 2. NOM DE FAMILLE (Niveau 1: Numéroté -> Niveau 2: Label -> Niveau 3: Universel) ===
    match_nom = re.search(r'(?:1\s*\.?\s*)?NOM\s*/?\s*SURNAME?\s*[:\-]?\s*([A-ZÀ-Ÿ]+(?:\s+[A-ZÀ-Ÿ]+)+)', texte_nettoye)
    if match_nom:
        resultats["nom_famille"] = re.sub(r'[^A-ZÀ-Ÿ\s\-]', '', match_nom.group(1)).strip()
    else:
        # Fallback : chercher juste le label
        for ligne in lignes:
            if re.search(r'\bNOM\b', ligne, re.IGNORECASE) and not re.search(r'PRENOM', ligne, re.IGNORECASE):
                val = _valeur_depuis_ligne(ligne.split("NOM", 1)[1] if "NOM" in ligne else "")
                if val:
                    resultats["nom_famille"] = _nettoyer_valeur_securisee(val, "nom")
                    break

    # === 3. PRÉNOMS (Niveau 1: Numéroté -> Niveau 2: Label -> Niveau 3: Universel) ===
    match_prenoms = re.search(r'2\s*\.?\s*PRENOM\s*\(?S\)?\s*/?\s*(?:GIVEN\s*NAME)?\s*[:\-]?\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿ\s]*)', texte_nettoye)
    if match_prenoms:
        resultats["prenoms"] = re.sub(r'[^A-ZÀ-Ÿ\s\-]', '', match_prenoms.group(1)).strip()
    else:
        # Fallback : chercher juste le label
        for ligne in lignes:
            if re.search(r'\bPRENOM(?:S)?\b', ligne, re.IGNORECASE):
                val = _valeur_depuis_ligne(ligne.split("PRENOM", 1)[1] if "PRENOM" in ligne else "")
                if val:
                    resultats["prenoms"] = _nettoyer_valeur_securisee(val, "prenoms")
                    break

    # 🚨 FILET DE SÉCURITÉ UNIVERSEL : Si Nom/Prénom sont toujours vides, on utilise la typographie
    if not resultats.get("nom_famille") or not resultats.get("prenoms"):
        journal.warning("Permis: Champs numérotés/labels échoués, activation du fallback typographique universel.")
        fallback = _normaliser_et_mapper_identite(texte_nettoye)
        if not resultats.get("nom_famille") and fallback.get("nom_famille"):
            resultats["nom_famille"] = fallback["nom_famille"]
        if not resultats.get("prenoms") and fallback.get("prenoms"):
            resultats["prenoms"] = fallback["prenoms"]

    # === 4. DATE ET LIEU DE NAISSANCE ===
    # Cherche "12.10.2002 À PARAKOU" ou "NÉ LE 12/10/2002 À PARAKOU"
    match_naiss = re.search(r'(\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4})\s*(?:N[ÉE]\s*(?:LE)?\s*)?(?:À|A|AT)?\s*([A-ZÀ-Ÿ]{4,})', texte_nettoye)
    if match_naiss:
        resultats["date_naissance"] = _parser_date(match_naiss.group(1))
        lieu = re.sub(r'[^A-ZÀ-Ÿ\s\-]', '', match_naiss.group(2)).strip()
        if len(lieu) >= 3:
            resultats["lieu_naissance"] = lieu
    else:
        # Fallback : prendre la plus ancienne date valide du document comme date de naissance
        toutes_dates = _trouver_toutes_les_dates(texte_nettoye)
        dates_valides = [_parser_date(d) for d in toutes_dates if _parser_date(d)]
        if dates_valides:
            resultats["date_naissance"] = min(dates_valides, key=lambda d: int(d.split('/')[2]))

    # === 5. DATES DE DÉLIVRANCE ET EXPIRATION (Champs 4a et 4b ou labels) ===
    match_4a = re.search(r'(?:4A\s*\.?\s*)?(?:DATE\s*)?D[ÉE]LIVR(?:ANCE|ÉE)?\s*[:\-]?\s*(\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4})', texte_nettoye)
    if match_4a:
        resultats["date_delivrance"] = _parser_date(match_4a.group(1))
        
    match_4b = re.search(r'(?:4B\s*\.?\s*)?(?:EXPIR|VALID|FIN)\s*[:\-]?\s*(\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4})', texte_nettoye)
    if match_4b:
        resultats["date_expiration"] = _parser_date(match_4b.group(1))

    # Fallback dates : si pas trouvé, utiliser la logique des dates multiples
    toutes_dates = _trouver_toutes_les_dates(texte_nettoye)
    dates_valides = [_parser_date(d) for d in toutes_dates if _parser_date(d)]
    if len(dates_valides) >= 2:
        if not resultats.get("date_delivrance"):
            resultats["date_delivrance"] = dates_valides[-2] # Avant-dernière
        if not resultats.get("date_expiration"):
            resultats["date_expiration"] = dates_valides[-1] # Dernière (la plus lointaine)

    # === 6. NUMÉRO DE PERMIS (Champ 5 ou pattern générique) ===
    match_numero = re.search(r'(?:5\s*\.?\s*)?N[°O]\s*PERMIS\s*/?\s*(?:LICENSE\s*NO)?\s*[:\-]?\s*([A-Z0-9\-]{6,20})', texte_nettoye)
    if not match_numero:
        # Fallback : chercher un pattern de numéro de permis type CEDEAO (ex: SN-2021-0094821)
        match_numero = re.search(r'\b([A-Z]{2,3}[\-]\d{4}[\-]\d{5,7})\b', texte_nettoye)
    if not match_numero:
        # Fallback ultime : n'importe quel bloc alphanumérique après "PERMIS" ou "N°"
        match_numero = re.search(r'(?:PERMIS|N[°O])\s*[:\-]?\s*([A-Z0-9\-]{6,20})', texte_nettoye)
    
    if match_numero:
        num = re.sub(r'[^A-Z0-9\-]', '', match_numero.group(1)).strip()
        if 6 <= len(num) <= 20:
            resultats["numero_document"] = num

    # === 7. AUTORITÉ DE DÉLIVRANCE (Champ 4c) ===
    match_autorite = re.search(r'(?:4C\s*\.?\s*)?(?:AUTORIT[ÉE]\s*/?\s*AUTHORITY|D[ÉE]LIVR[ÉE]\s*PAR)\s*[:\-]?\s*([A-ZÀ-Ÿ\s\.]+?)(?=\d+\.|$)', texte_nettoye)
    if match_autorite:
        autorite = re.sub(r'[^A-ZÀ-Ÿ\s\.]', '', match_autorite.group(1)).strip()
        if len(autorite) > 3:
            resultats["autorite_delivrance"] = autorite

    # === 8. CATÉGORIES (Champ 9) ===
    match_cats = re.search(r'(?:9\s*\.?\s*)?CAT[ÉE]GORIES?\s*[:\-]?\s*([A-Z0-9\s]+?)(?:\s*[A-Z]\.|$)', texte_nettoye)
    if match_cats:
        cats_text = match_cats.group(1)
        categories = re.findall(r'\b(A1|A2|A|B|C1|C2|C|D|E|F|G)\b', cats_text)
        if categories:
            resultats["categories_permis"] = categories

    # Validation finale
    champs_ok = sum([bool(resultats.get("nom_famille")), bool(resultats.get("prenoms")), bool(resultats.get("numero_document"))])
    if champs_ok < 2:
        journal.warning(f"Permis: Extraction faible ({champs_ok}/3 champs principaux). Texte: {texte_nettoye[:200]}")
    else:
        journal.info(f"Permis: Extraction réussie ({champs_ok}/3 champs principaux)")

    return resultats

# =============================================================================
# Fonctions utilitaires pour Permis de Conduire
# =============================================================================
def _nettoyer_texte_permis(texte: str) -> str:
    """Nettoie le texte en gardant un maximum d'informations structurantes."""
    texte = texte.upper()
    texte = re.sub(r'[{}()\[\]<>]', ' ', texte)
    # Séparer les mots collés aux chiffres (ex: "A12" -> "A 12")
    texte = re.sub(r'([A-Z])(\d)', r'\1 \2', texte)
    texte = re.sub(r'(\d)([A-Z])', r'\1 \2', texte)
    return re.sub(r'\s+', ' ', texte).strip()

def _trouver_toutes_les_dates(texte: str) -> List[str]:
    """Extrait toutes les dates au format JJ.MM.AAAA, JJ/MM/AAAA ou JJ-MM-AAAA."""
    return re.findall(r'\b(\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4})\b', texte)


# =============================================================================
# UTILITAIRES SPÉCIFIQUES ASSURANCE (Anti-bruit OCR et mots collés)
# =============================================================================
_LABELS_ARRET_ASSURANCE = (
    r"NOM|PRÉNOM|PRENOM|ASSUR[ÉE]|TITULAIRE|SOUSCRIPTEUR|CONDUCTEUR|"
    r"VÉHICULE|VEHICULE|MARQUE|MODÈLE|MODELE|IMMATRICULATION|PLAQUE|"
    r"DATE|ADRESSE|TÉLÉPHONE|EMAIL|CONTRAT|POLICE|GARANTIE|PRIME|"
    r"COTISATION|FRANCHISE|PLAFOND|COUVERTURE|ASSISTANCE|INFORMATIONS|"
    r"DURÉE|FORMULE|USAGE|PUISANCE|ANNÉE|ECHEANCE|ÉCHÉANCE"
)

def _separer_mots_colles(texte: str) -> str:
    """Sépare les mots collés par l'OCR (ex: 'CONTRATDASSURANCE' -> 'CONTRAT D ASSURANCE')."""
    if not texte: return texte
    texte = re.sub(r'([a-z0-9À-ÿ])([A-Z])', r'\1 \2', texte)
    texte = re.sub(r'([A-ZÀ-ÿ])(\d)', r'\1 \2', texte)
    texte = re.sub(r'(\d)([A-ZÀ-ÿ])', r'\1 \2', texte)
    return texte

def _est_valeur_valide_assurance(texte: str, type_attendu: str) -> bool:
    """Vérifie si le texte extrait est une vraie valeur et non un label ou un en-tête collé."""
    if not texte or len(texte) < 2: return False
    texte_pur = re.sub(r'[^A-Za-zÀ-ÿ\s\-]', '', texte).strip()
    mots = texte_pur.split()
    
    # Rejeter si c'est un mot d'en-tête classique d'attestation
    mots_interdits = {'CONTRAT', 'POLICE', 'INFORMATIONS', 'GARANTIE', 'COUVERTURE', 
                      'ATTESTATION', 'CERTIFICAT', 'COTISATION', 'FRANCHISE', 'FORMULE'}
    for mot in mots:
        if any(interdit in mot for interdit in mots_interdits):
            return False
            
    if type_attendu == "nom":
        if texte_pur.isdigit():
            return False
        # 🛡️ Anti-mapping : rejette les marques/sociétés (ex: "TOYOTA COROLLA")
        tokens = [t for t in re.split(r"[\s\-']+", texte_pur) if t]
        if any(_mot_interdit_nom(t) for t in tokens):
            return False
        return len(texte_pur) >= 2
    elif type_attendu == "immatriculation":
        return bool(re.search(r'[A-Z]', texte_pur)) and bool(re.search(r'\d', texte_pur))
    elif type_attendu == "numero":
        return bool(re.search(r'[\d\-]', texte_pur)) and len(texte_pur) >= 5
    return True

def _extraire_valeur_apres_label(texte: str, labels_possibles: List[str], type_valeur: str) -> Optional[str]:
    """Extrait une valeur après un label, et s'ARRÊTE NET au prochain label connu."""
    for label in labels_possibles:
        # La lookahead (?=...) est la clé : elle force l'arrêt avant le prochain champ
        pattern = rf'{label}\s*[:\-]?\s*([^\n§]{{1,100}}?)(?=\s+(?:{_LABELS_ARRET_ASSURANCE})\b|$)'
        match = re.search(pattern, texte, re.IGNORECASE)
        if match:
            valeur = match.group(1).strip()
            valeur = re.sub(r'[^A-ZÀ-ÿ0-9\s\-\.]', '', valeur) # Nettoyage léger
            if _est_valeur_valide_assurance(valeur, type_valeur):
                return valeur
    return None

def _separer_nom_prenom_assurance(valeur_complete: str) -> tuple[Optional[str], Optional[str]]:
    """Sépare un nom complet en nom et prénom(s) selon la convention NOM Prénom(s)."""
    if not valeur_complete: return None, None
    valeur = re.sub(r'[^A-Za-zÀ-ÿ\s\-]', '', valeur_complete).strip()
    # 🛡️ On ne garde que les tokens plausibles d'une identité (rejette marques/labels)
    mots = [m for m in valeur.split() if _est_mot_nom_valide(m)]

    if len(mots) == 0: return None, None
    elif len(mots) == 1: return mots[0], None
    else:
        # Convention : le premier mot (ou les premiers en majuscules) est le nom de famille
        return mots[0], " ".join(mots[1:])

# =============================================================================
# Extraction spécifique : Carte d'assurance (Version Hybride Ultra-Robuste)
# =============================================================================
def extraire_carte_assurance(texte: str) -> Dict:
    """
    Extraction hybride pour assurance : gère les mots collés, s'arrête aux bons labels,
    et sépare correctement NOM et PRÉNOM même si l'OCR a tout fusionné.
    """
    resultats = {}
    if not texte: return resultats

    # 1. Préparation du texte : séparer les mots collés pour aider les regex
    texte_prep = _separer_mots_colles(texte).upper()
    texte_prep = re.sub(r'\n\s*\n', ' § ', texte_prep) # Préserver les sauts de section
    texte_prep = re.sub(r'\s+', ' ', texte_prep).strip()
    
    journal.info("Assurance: Début extraction hybride robuste")

    # === 1. IDENTITÉ DE L'ASSURÉ (La clé pour éviter "Toyota Corolla") ===
    # On cherche "NOM & PRÉNOM" ou "NOM PRÉNOM", et on s'arrête avant "MARQUE" ou "IMMATRICULATION"
    nom_prenom = _extraire_valeur_apres_label(
        texte_prep, 
        [r'NOM\s*(?:&\s*PRÉNOM|ET\s*PRÉNOM|ET\s*PRENOM)?', r'NOM\s+PRÉNOM', r'ASSUR[ÉE]\s*[:\-]?'], 
        "nom"
    )
    
    if nom_prenom:
        resultats["nom_famille"], resultats["prenoms"] = _separer_nom_prenom_assurance(nom_prenom)
        journal.info(f"✓ Assurance NOM/PRÉNOM: {resultats['nom_famille']} / {resultats['prenoms']}")
    else:
        # Fallback : utiliser le mapping universel typographique sur tout le texte
        fallback = _normaliser_et_mapper_identite(texte_prep)
        if fallback.get("nom_famille"): resultats["nom_famille"] = fallback["nom_famille"]
        if fallback.get("prenoms"): resultats["prenoms"] = fallback["prenoms"]

    # === 2. NUMÉRO DE POLICE / CONTRAT ===
    match_contrat = re.search(r'\b([A-Z]{2,4}[\-]\d{4}[\-]\d{2,4}[\-]?\d{5,7})\b', texte_prep)
    if match_contrat:
        resultats["numero_police"] = match_contrat.group(1)
    else:
        resultats["numero_police"] = _extraire_valeur_apres_label(
            texte_prep, [r'N[°O]\s*CONTRAT', r'CONTRAT\s*N[°O]?', r'POLICE\s*N[°O]?'], "numero"
        )
    if resultats.get("numero_police"):
        journal.info(f"✓ Assurance CONTRAT: {resultats['numero_police']}")

    # === 3. IMMATRICULATION ===
    match_immat = re.search(r'\b([A-Z]{1,3}[\-]?\d{2,4}[\-]?[A-Z]{1,3})\b', texte_prep)
    if match_immat:
        # Filtrer les faux positifs (ex: numéros de téléphone ou de contrat longs)
        candidat = match_immat.group(1)
        if not (re.search(r'\d{4,}', candidat) and "-" not in candidat):
            resultats["immatriculation"] = candidat
    if not resultats.get("immatriculation"):
        resultats["immatriculation"] = _extraire_valeur_apres_label(
            texte_prep, [r'IMMATRICULATION', r'REGISTRATION', r'PLAQUE'], "immatriculation"
        )
    if resultats.get("immatriculation"):
        journal.info(f"✓ Assurance IMMATRICULATION: {resultats['immatriculation']}")

    # === 4. COMPAGNIE D'ASSURANCE ===
    # Cherche les noms connus en priorité
    assureurs_connus = ["ZUTO", "NSIA", "SUNU", "SAHAM", "VISTA", "UGAN", "AXA", "ALLIANZ"]
    for assureur in assureurs_connus:
        if assureur in texte_prep:
            resultats["compagnie_assurance"] = assureur
            break
            
    if not resultats.get("compagnie_assurance"):
        resultats["compagnie_assurance"] = _extraire_valeur_apres_label(
            texte_prep, [r'COMPAGNIE', r'ASSUREUR', r'INSURER'], "texte"
        )
    if resultats.get("compagnie_assurance"):
        journal.info(f"✓ Assurance COMPAGNIE: {resultats['compagnie_assurance']}")

    # === 5. DATES DE COUVERTURE (Effet et Expiration) ===
    # Cherche le pattern "VALABLE DU JJ/MM/AAAA AU JJ/MM/AAAA"
    match_periode = re.search(
        r"VALABLE\s*(?:DU|DE|LE)?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s*(?:AU|À|A|JUSQU[’' ]?AU?)\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})",
        texte_prep
    )
    if match_periode:
        resultats["date_delivrance"] = _parser_date(match_periode.group(1))
        resultats["date_expiration"] = _parser_date(match_periode.group(2))
    else:
        # Fallback contextuel
        if not resultats.get("date_delivrance"):
            date_effet = _extraire_valeur_apres_label(texte_prep, [r"DATE\s*D[’']?EFFET", r"EFFET\s*LE", r"DU"], "date")
            if date_effet: resultats["date_delivrance"] = _parser_date(date_effet)
            
        if not resultats.get("date_expiration"):
            date_exp = _extraire_valeur_apres_label(texte_prep, [r"EXPIRATION", r"JUSQU[’' ]?AU?", r"AU", r"ECHEANCE"], "date")
            if date_exp: resultats["date_expiration"] = _parser_date(date_exp)

        # Fallback ultime : prendre la première et la dernière date du document
        if not resultats.get("date_delivrance") or not resultats.get("date_expiration"):
            toutes_dates = re.findall(r'\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b', texte_prep)
            dates_valides = [_parser_date(d) for d in toutes_dates if _parser_date(d)]
            if len(dates_valides) >= 2:
                if not resultats.get("date_delivrance"): resultats["date_delivrance"] = dates_valides[0]
                if not resultats.get("date_expiration"): resultats["date_expiration"] = dates_valides[-1]

    return resultats

# =============================================================================
# Extraction générique par labels
# =============================================================================
def extraire_par_labels(texte: str, patterns: Dict[str, list]) -> Dict:
    resultats = {}
    lignes = (texte or "").split("\n")
    for champ, regex_list in patterns.items():
        contexte = _CONTEXTES_NETTOYAGE.get(champ, champ)
        for regex in regex_list:
            if not regex.startswith(r"\b"): regex = r"\b" + regex
            for i, ligne in enumerate(lignes):
                match = re.search(regex, ligne, re.IGNORECASE)
                if not match: continue
                valeur = _valeur_depuis_ligne(ligne[match.end():])
                if not valeur: valeur = _chercher_valeur_lignes_suivantes(lignes, i + 1)
                if not valeur: continue
                nettoye = _nettoyer_valeur_securisee(valeur, contexte)
                if nettoye:
                    resultats[champ] = nettoye
                    break
            if champ in resultats: break
    return resultats