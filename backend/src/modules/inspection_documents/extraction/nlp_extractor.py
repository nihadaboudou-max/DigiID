# -*- coding: utf-8 -*-
"""
Extracteur NLP (Regex avancées) pour documents sans MRZ.
Gère : Permis de conduire (formats numérotés CEDEAO), Cartes d'assurance, Anciennes CNI, etc.
Règle anti-hallucination : ne retourne JAMAIS un label comme valeur de champ.
Solution universelle : délimitation dynamique des champs par les labels connus.
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
    "MARQUE", "MODELE", "VEHICULE", "IMMATRICULATION", "TELEPHONE", "EMAIL"
}

_NEUTRES = {
    "DE", "DU", "DES", "D", "L", "LE", "LA", "LES", "UN", "UNE",
    "AU", "AUX", "A", "ET", "EN", "N", "NO", "N°",
}

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
    """Découpe un texte en mots normalisés (majuscules, sans accents)."""
    return [w for w in re.split(r"[^A-Z0-9]+", _sans_accents((texte or "").upper())) if w]

def _ligne_est_que_labels(texte: str) -> bool:
    """True si la ligne ne contient QUE des labels / mots neutres (en-tête)."""
    mots = _mots(texte)
    if not mots:
        return True
    for m in mots:
        if m not in _LABELS and m not in _NEUTRES:
            return False
    return True

def _retirer_mots_labels_prefixe(texte: str) -> str:
    """Retire les mots-labels qui précèdent la vraie valeur (ex : 'SURNAME DIOP' → 'DIOP')."""
    mots = re.split(r"[\s/:;,()|]+", texte)
    sortie: List[str] = []
    vu_donnee = False
    for m in mots:
        if not m:
            continue
        normalise = _sans_accents(m.upper()).strip(".,")
        if not vu_donnee:
            if normalise in _LABELS or normalise in _NEUTRES:
                continue
            vu_donnee = True
        sortie.append(m)
    return " ".join(sortie).strip()

# =============================================================================
# 🚀 SOLUTION UNIVERSELLE : Délimitation dynamique par les labels
# =============================================================================
def _construire_regex_fin_de_champ() -> str:
    """
    Construit dynamiquement une regex qui détecte n'importe quel label connu.
    C'est le cœur de la solution professionnelle : on ne bloque jamais de valeur,
    on s'arrête juste avant le prochain label, quel qu'il soit.
    """
    # On trie par longueur décroissante pour qu'un label long (ex: "IMMATRICULATION") 
    # soit détecté avant un label court (ex: "N")
    labels_tries = sorted(list(_LABELS), key=len, reverse=True)
    labels_echappes = [re.escape(l) for l in labels_tries if l]
    # Regex : "un espace, suivi d'un label, suivi optionnellement de : ou - et d'un espace"
    return r"(?=\s+(?:" + "|".join(labels_echappes) + r")\s*[:\-]?\s)"

# =============================================================================
# Parsing de date tolérant
# =============================================================================
def _annee_complete(annee: str) -> Optional[int]:
    if not annee:
        return None
    if len(annee) == 2:
        a = int(annee)
        return 1900 + a if a >= 40 else 2000 + a
    return int(annee) if 1900 <= int(annee) <= 2100 else None

def _valider_jour_mois_annee(jour: int, mois: int, annee: int) -> bool:
    return 1 <= jour <= 31 and 1 <= mois <= 12 and 1900 <= annee <= 2100

def _parser_date(valeur: str) -> Optional[str]:
    """Parse une date très tolérante → 'JJ/MM/AAAA'."""
    if not valeur:
        return None
    v = valeur.strip().strip(".:;,")
    
    # 1) JJ/MM/AAAA ou JJ-MM-AAAA ou JJ.MM.AAAA
    m = re.search(r"(\d{1,2})\s*[/.\- ]\s*(\d{1,2})\s*[/.\- ]\s*(\d{2,4})", v)
    if m:
        jour, mois, annee = int(m.group(1)), int(m.group(2)), m.group(3)
        a4 = _annee_complete(annee)
        if a4 and _valider_jour_mois_annee(jour, mois, a4):
            return f"{jour:02d}/{mois:02d}/{a4:04d}"
    
    # 2) JJ Mois AAAA (mois en lettres, FR/EN)
    m = re.search(r"(\d{1,2})\s*[/.\- ]\s*([A-Za-zÀ-ÿ]{3,})\s*[/.\- ]\s*(\d{2,4})", v)
    if m:
        jour = int(m.group(1))
        mois_num = _MOIS.get(_sans_accents(m.group(2)).upper().rstrip("."))
        a4 = _annee_complete(m.group(3))
        if mois_num and a4 and _valider_jour_mois_annee(jour, mois_num, a4):
            return f"{jour:02d}/{mois_num:02d}/{a4:04d}"
    
    # 3) AAAA-MM-JJ (ISO)
    m = re.search(r"(\d{4})\s*[/.\- ]\s*(\d{1,2})\s*[/.\- ]\s*(\d{1,2})", v)
    if m:
        annee, mois, jour = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if _valider_jour_mois_annee(jour, mois, annee):
            return f"{jour:02d}/{mois:02d}/{annee:04d}"
    
    # 4) Compact JJMMAAAA (ou JJMMAA)
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
    """Nettoie et VALIDE la valeur pour empêcher les artefacts OCR / labels."""
    if not valeur:
        return None
    valeur = valeur.strip().strip(":;,.-\"'()|/ ")
    if not valeur:
        return None
    
    if contexte in ("nom", "prenoms"):
        if _ligne_est_que_labels(valeur):
            return None
        if re.fullmatch(r"\d+", valeur):
            return None
        propre = re.sub(r"[^a-zA-ZÀ-ÿ\s\-']", "", valeur).strip()
        if len(propre.strip()) >= 2:
            return propre
        return None
    
    if contexte == "numero":
        valeur = "".join(c for c in valeur.upper() if c.isalnum())
        return valeur if 5 <= len(valeur) <= 20 else None
    
    if contexte == "date":
        return _parser_date(valeur)
    
    if contexte == "sexe":
        v = valeur.upper()[:1]
        return "M" if v in ("M", "H") else "F" if v == "F" else None
    
    if contexte == "lieu":
        if _ligne_est_que_labels(valeur):
            return None
        propre = re.sub(r"[^a-zA-ZÀ-ÿ\s\-']", "", valeur).strip()
        return propre if len(propre) >= 2 else None
    
    return valeur if valeur else None

# =============================================================================
# Extraction de valeur depuis les lignes OCR
# =============================================================================
def _valeur_depuis_ligne(reste: str) -> Optional[str]:
    """Extrait la valeur dans le reste d'une ligne après un label."""
    if not reste:
        return None
    nettoye = reste.strip().strip(" \t:;,-/|·•\"'()")
    if not nettoye or _ligne_est_que_labels(nettoye):
        return None
    
    # 🚀 SOLUTION UNIVERSELLE : Couper la valeur au prochain label connu
    regex_fin = _construire_regex_fin_de_champ()
    valeur_coupee = re.split(regex_fin, nettoye, flags=re.IGNORECASE)[0].strip()
    
    nettoye = _retirer_mots_labels_prefixe(valeur_coupee).strip(" \t:;,-/|·•\"'()")
    return nettoye or None

def _chercher_valeur_lignes_suivantes(lignes: List[str], debut: int) -> Optional[str]:
    """Cherche la valeur sur les lignes suivantes en sautant les lignes-labels."""
    for j in range(debut, min(debut + 4, len(lignes))):
        ligne = lignes[j].strip()
        if not ligne:
            continue
        if _ligne_est_que_labels(ligne):
            continue
        premier = _mots(ligne)[0] if _mots(ligne) else ""
        if premier in _LABELS or premier in _NEUTRES:
            continue # En-tête / autre champ, pas une donnée
        return ligne
    return None

# =============================================================================
# Extraction spécifique : Permis de conduire (Format CEDEAO numéroté)
# =============================================================================
def extraire_permis_conduire(texte: str) -> Dict:
    """Extraction spécifique pour Permis de Conduire avec support des formats numérotés."""
    resultats = {}
    texte_upper = texte.upper()
    lignes = texte.split("\n")
    
    # 1. Numéro de permis (NNI ou numéro classique)
    match = re.search(r"(?:NNI|N[°O]|NUM[ÉE]RO|PERMIS)\s*(?:N[°O])?\s*[:\-]?\s*([A-Z0-9\-]{6,20})", texte_upper)
    if match:
        numero = _nettoyer_valeur_securisee(match.group(1), "numero")
        if numero:
            resultats["numero_document"] = numero
    
    # 2. Nom (supporte "1.Nom:" ou "Nom:")
    for ligne in lignes:
        match = re.search(r"(?:\d+\.)?\s*NOM\s*[:\-]?\s*(.+)", ligne, re.IGNORECASE)
        if match:
            valeur = _nettoyer_valeur_securisee(match.group(1).strip(), "nom")
            if valeur:
                resultats["nom_famille"] = valeur
                break
    
    # 3. Prénom(s) (supporte "2.Prénom(s):" ou "Prénom(s):")
    for ligne in lignes:
        match = re.search(r"(?:\d+\.)?\s*PR[ÉE]NOM(?:\(S\))?\s*[:\-]?\s*(.+)", ligne, re.IGNORECASE)
        if match:
            valeur = _nettoyer_valeur_securisee(match.group(1).strip(), "prenoms")
            if valeur:
                resultats["prenoms"] = valeur
                break
    
    # 4. Date et lieu de naissance composés (Gère "12.10.2002àPARAKOU" sans espace)
    for ligne in lignes:
        match = re.search(r"(?:\d+\.)?\s*DATE\s*(?:ET\s*)?LIEU\s*(?:DE\s*)?NAISS(?:ANCE)?\s*[:\-]?\s*(.+)", ligne, re.IGNORECASE)
        if match:
            valeur_composee = match.group(1).strip()
            # Extraire la date
            match_date = re.search(r"(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})", valeur_composee)
            if match_date:
                d = _parser_date(match_date.group(1))
                if d:
                    resultats["date_naissance"] = d
            # Extraire le lieu (après "à" ou "AT", avec ou sans espace)
            match_lieu = re.search(r"(?:à|AT)\s*([A-ZÀ-Ü\s\-]{3,30})", valeur_composee, re.IGNORECASE)
            if match_lieu:
                lieu = _nettoyer_valeur_securisee(match_lieu.group(1).strip(), "lieu")
                if lieu:
                    resultats["lieu_naissance"] = lieu
            break
    
    # 5. Date de délivrance (supporte "4a.Date délivr.:")
    for ligne in lignes:
        match = re.search(r"(?:\d+[a-z]?\.)?\s*DATE\s*(?:DE\s*)?D[ÉE]LIVR(?:ANCE|ÉE)?\s*[:\-]?\s*(.+)", ligne, re.IGNORECASE)
        if match:
            valeur = match.group(1).strip()
            match_date = re.search(r"(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})", valeur)
            if match_date:
                d = _parser_date(match_date.group(1))
                if d:
                    resultats["date_delivrance"] = d
                    break
    
    # 6. Date d'expiration (souvent après la date de délivrance sur la même ligne)
    for ligne in lignes:
        if "DELIVR" in ligne.upper() or "ISSUE" in ligne.upper():
            dates = re.findall(r"(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})", ligne)
            if len(dates) >= 2:
                d = _parser_date(dates[1])
                if d:
                    resultats["date_expiration"] = d
                    break
        # Fallback
        match = re.search(r"(?:\d+\.)?\s*(?:EXPIRATION|EXPIR[EÉ]|VALIDIT[EÉ])\s*[:\-]?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})", ligne, re.IGNORECASE)
        if match:
            d = _parser_date(match.group(1))
            if d:
                resultats["date_expiration"] = d
                break
    
    # 7. Catégories
    match_cat = re.search(r"(?:\d+\.)?\s*CAT[ÉE]GORIE(?:S)?\s*[:\-]?\s*([A-E, ]+)", texte, re.IGNORECASE)
    if match_cat:
        resultats["categories_permis"] = [c.strip() for c in match_cat.group(1).split(",") if c.strip()]
    
    # 8. Autorité de délivrance
    for ligne in lignes:
        match = re.search(r"(?:\d+[a-z]?\.)?\s*D[ÉE]LIVR[ÉE]\s*(?:PAR)?\s*[:\-]?\s*(.+)", ligne, re.IGNORECASE)
        if match:
            autorite = match.group(1).strip()
            if len(autorite) > 3 and not _ligne_est_que_labels(autorite):
                resultats["autorite_delivrance"] = autorite
                break
    
    return resultats

# =============================================================================
# Extraction spécifique : Carte d'assurance (Robuste au mélange OCR)
# =============================================================================
def extraire_carte_assurance(texte: str) -> Dict:
    """
    Extraction spécifique pour Cartes d'Assurance.
    Tolère le mélange des champs dû à la lecture OCR de gauche à droite.
    """
    resultats = {}
    texte_upper = texte.upper()
    
    # 1. Numéro de police / contrat
    match = re.search(r"(?:N[°O]?|POLICE|CONTRAT|CLIENT|QUITTANCE)\s*[:\-]?\s*([A-Z0-9\-/]{5,25})", texte_upper)
    if match:
        numero = re.sub(r'[^A-Z0-9\-/]', '', match.group(1)).strip()
        if len(numero) >= 5:
            resultats["numero_police"] = numero
            
    # 2. Immatriculation
    match_imm = re.search(r"(?:IMMAT|VEHICULE|W[°O]?|PLAQUE)\s*[:\-]?\s*([A-Z0-9\-]{5,15})", texte_upper)
    if match_imm:
        imm = re.sub(r'[^A-Z0-9]', '', match_imm.group(1)).strip()
        if len(imm) >= 5:
            resultats["immatriculation"] = imm
            
    # 3. 🚀 Nom du souscripteur : Extraction dynamique (s'arrête au prochain label)
    match_debut = re.search(
        r"(?:NOM\s*&\s*PR[ÉE]NOMS?|SOUSCRIPT|PRENEUR|ASSURE|TITULAIRE|PROPRIETAIRE)\s*[:\-]?\s*", 
        texte_upper
    )
    if match_debut:
        reste_ligne = texte_upper[match_debut.end():]
        # On utilise la même logique universelle : couper au prochain label connu
        regex_fin = _construire_regex_fin_de_champ()
        nom_coupe = re.split(regex_fin, reste_ligne, flags=re.IGNORECASE)[0].strip()
        
        nom = re.sub(r'\s+', ' ', nom_coupe).strip(" \t:;,-/|·•\"'()")
        
        # Validation basique : doit faire entre 3 et 60 caractères, pas que des chiffres
        if 3 <= len(nom) <= 60 and not nom.isdigit():
            resultats["nom_souscripteur"] = nom

    # 4. Compagnie d'assurance
    lignes = texte.split("\n")
    for ligne in lignes[:8]:
        ligne = ligne.strip()
        if any(mot in ligne.upper() for mot in ['ASSURANCE', 'SA', 'SARL', 'VIE', 'IARD']):
            if not _ligne_est_que_labels(ligne) and 4 <= len(ligne) <= 60:
                resultats["compagnie_assurance"] = ligne
                break

    # 5. Dates (Effet et Expiration)
    dates_trouvees = re.findall(r'(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})', texte)
    dates_valides = [d for d in dates_trouvees if _parser_date(d)]
    
    if len(dates_valides) >= 2:
        resultats["date_delivrance"] = dates_valides[0]
        resultats["date_expiration"] = dates_valides[-1]
    elif len(dates_valides) == 1:
        if re.search(r'(?:VALID|EXPIR|FIN|ECHEANCE)', texte, re.IGNORECASE):
            resultats["date_expiration"] = dates_valides[0]
        else:
            resultats["date_delivrance"] = dates_valides[0]

    return resultats


# =============================================================================
# Extraction générique par labels (tous types de documents)
# =============================================================================
def extraire_par_labels(texte: str, patterns: Dict[str, list]) -> Dict:
    """
    Extraction générique basée sur des labels.
    - Ne prend JAMAIS un label comme valeur.
    - Gère 'Label: valeur' sur la même ligne et 'Label\nvaleur' sur la ligne suivante.
    """
    resultats = {}
    lignes = (texte or "").split("\n")
    
    for champ, regex_list in patterns.items():
        contexte = _CONTEXTES_NETTOYAGE.get(champ, champ)
        for regex in regex_list:
            if not regex.startswith(r"\b"):
                regex = r"\b" + regex
            for i, ligne in enumerate(lignes):
                match = re.search(regex, ligne, re.IGNORECASE)
                if not match:
                    continue
                
                # 1) Valeur sur la même ligne après le label (utilise désormais la coupure dynamique)
                valeur = _valeur_depuis_ligne(ligne[match.end():])
                
                # 2) Sinon, valeur sur les lignes suivantes (en sautant les labels)
                if not valeur:
                    valeur = _chercher_valeur_lignes_suivantes(lignes, i + 1)
                    
                if not valeur:
                    continue
                
                nettoye = _nettoyer_valeur_securisee(valeur, contexte)
                if nettoye:
                    resultats[champ] = nettoye
                    break
            if champ in resultats:
                break
                
    return resultats