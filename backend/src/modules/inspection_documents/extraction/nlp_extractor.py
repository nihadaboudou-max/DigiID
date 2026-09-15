# -*- coding: utf-8 -*-
"""
Extracteur NLP (Regex avancées) pour documents sans MRZ.
Gère : Permis de conduire, Cartes d'assurance, Anciennes CNI, passeports, etc.
Supporte les formats numérotés (1.Nom, 2.Prénom) et les champs composés.
"""
import re
from typing import Dict, List, Optional

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
# Labels de champs (FR/EN) à ignorer en tant que valeurs
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
    "MIN", "TRANS", "TRANSPORTS", "TERRESTRES", "CATÉGORIES", "CATEGORIES",
}

_NEUTRES = {
    "DE", "DU", "DES", "D", "L", "LE", "LA", "LES", "UN", "UNE",
    "AU", "AUX", "A", "ET", "EN", "N", "NO", "N°",
}

# =============================================================================
# Utilitaires
# =============================================================================
def _sans_accents(texte: str) -> str:
    for a, b in [("É", "E"), ("È", "E"), ("Ê", "E"), ("", "E"),
                 ("À", "A"), ("Â", "A"), ("Ä", "A"),
                 ("Î", "I"), ("", "I"),
                 ("Ô", "O"), ("Ö", "O"),
                 ("Ù", "U"), ("Û", "U"), ("Ü", "U"),
                 ("Ç", "C"), ("Œ", "OE"), ("Æ", "AE")]:
        texte = texte.replace(a, b)
    return texte

def _mots(texte: str) -> List[str]:
    """Découpe un texte en mots normalisés (majuscules, sans accents)."""
    return [w for w in re.split(r"[^A-Z0-9]+", _sans_accents((texte or "").upper())) if w]

def _ligne_est_que_labels(texte: str) -> bool:
    """True si la ligne ne contient QUE des labels / mots neutres."""
    mots = _mots(texte)
    if not mots:
        return True
    for m in mots:
        if m not in _LABELS and m not in _NEUTRES:
            return False
    return True

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
    
    # 1) JJ/MM/AAAA ou JJ-MM-AAAA ou JJ.MM.AAAA (séparateurs mixtes)
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
# Extraction spécifique : Permis de conduire (amélioré)
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
    
    # 4. Date et lieu de naissance (format composé: "12.10.2002 à PARAKOU")
    for ligne in lignes:
        match = re.search(r"(?:\d+\.)?\s*DATE\s*(?:ET\s*)?LIEU\s*(?:DE\s*)?NAISS(?:ANCE)?\s*[:\-]?\s*(.+)", ligne, re.IGNORECASE)
        if match:
            valeur_composee = match.group(1).strip()
            # Extraire la date (première partie)
            match_date = re.search(r"(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})", valeur_composee)
            if match_date:
                d = _parser_date(match_date.group(1))
                if d:
                    resultats["date_naissance"] = d
            # Extraire le lieu (après "à" ou "AT")
            match_lieu = re.search(r"(?:à|AT)\s+([A-ZÀ-Ü\s\-]{3,30})", valeur_composee, re.IGNORECASE)
            if match_lieu:
                lieu = _nettoyer_valeur_securisee(match_lieu.group(1).strip(), "lieu")
                if lieu:
                    resultats["lieu_naissance"] = lieu
            break
    
    # 5. Date de délivrance (supporte "4a.Date délivr.:" ou "Date de délivrance:")
    for ligne in lignes:
        match = re.search(r"(?:\d+[a-z]?\.)?\s*DATE\s*(?:DE\s*)?D[ÉE]LIVR(?:ANCE|ÉE)?\s*[:\-]?\s*(.+)", ligne, re.IGNORECASE)
        if match:
            valeur = match.group(1).strip()
            # Prendre la première date trouvée
            match_date = re.search(r"(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})", valeur)
            if match_date:
                d = _parser_date(match_date.group(1))
                if d:
                    resultats["date_delivrance"] = d
                    break
    
    # 6. Date d'expiration (souvent après la date de délivrance sur la même ligne)
    for ligne in lignes:
        if "DELIVR" in ligne.upper() or "ISSUE" in ligne.upper():
            # Chercher une deuxième date sur la même ligne
            dates = re.findall(r"(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})", ligne)
            if len(dates) >= 2:
                d = _parser_date(dates[1])
                if d:
                    resultats["date_expiration"] = d
                    break
        # Fallback : chercher "EXPIRATION" ou "VALIDITE"
        match = re.search(r"(?:\d+\.)?\s*(?:EXPIRATION|EXPIR[EÉ]|VALIDIT[EÉ])\s*[:\-]?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})", ligne, re.IGNORECASE)
        if match:
            d = _parser_date(match.group(1))
            if d:
                resultats["date_expiration"] = d
                break
    
    # 7. Catégories (A, B, C, D, E, etc.)
    match_cat = re.search(r"(?:\d+\.)?\s*CAT[ÉE]GORIE(?:S)?\s*[:\-]?\s*([A-E, ]+)", texte, re.IGNORECASE)
    if match_cat:
        resultats["categories_permis"] = [c.strip() for c in match_cat.group(1).split(",") if c.strip()]
    
    # 8. Autorité de délivrance
    for ligne in lignes:
        match = re.search(r"(?:\d+[a-z]?\.)?\s*D[ÉE]LIVR[ÉE]\s*(?:PAR)\s*[:\-]?\s*(.+)", ligne, re.IGNORECASE)
        if match:
            autorite = match.group(1).strip()
            if len(autorite) > 3 and not _ligne_est_que_labels(autorite):
                resultats["autorite_delivrance"] = autorite
                break
    
    return resultats

# =============================================================================
# Extraction spécifique : Carte d'assurance
# =============================================================================
def extraire_carte_assurance(texte: str) -> Dict:
    """Extraction spécifique pour Cartes d'Assurance."""
    resultats = {}
    texte_upper = texte.upper()
    
    # Numéro de police / contrat
    match = re.search(r"(?:N[°O]\s*(?:DE\s*)?POLICE|CONTRAT|N[°O]\s*CLIENT)\s*[:\-]?\s*([A-Z0-9\-]{6,20})", texte_upper)
    if match:
        numero = _nettoyer_valeur_securisee(match.group(1), "numero")
        if numero:
            resultats["numero_police"] = numero
    
    # Date d'expiration / validité
    match_exp = re.search(r"(?:VALABLE\s*(?:JUSQU|AU)|EXPIRATION|EXPIR[EÉ]|FIN\s*DE\s*VALIDIT[EÉ])\s*[:\-]?\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})", texte, re.IGNORECASE)
    if match_exp:
        d = _parser_date(match_exp.group(1))
        if d:
            resultats["date_expiration"] = d
    
    # Compagnie d'assurance : première ligne qui n'est pas un label
    lignes = texte.split("\n")
    for ligne in lignes[:6]:
        ligne = ligne.strip()
        if len(ligne) > 3 and not _ligne_est_que_labels(ligne) and not re.match(r"^\d+$", ligne):
            resultats["compagnie_assurance"] = ligne
            break
    
    return resultats

# =============================================================================
# Extraction générique par labels (tous types de documents)
# =============================================================================
def extraire_par_labels(texte: str, patterns: Dict[str, list]) -> Dict:
    """
    Extraction générique basée sur des labels (NOM, PRÉNOM, DATE DE NAISSANCE...).
    Supporte les formats numérotés (1.NOM, 2.PRÉNOM) et les champs composés.
    """
    resultats = {}
    lignes = (texte or "").split("\n")
    
    for champ, regex_list in patterns.items():
        for regex in regex_list:
            if not regex.startswith(r"\b"):
                regex = r"\b" + regex
            for i, ligne in enumerate(lignes):
                match = re.search(regex, ligne, re.IGNORECASE)
                if not match:
                    continue
                
                # Valeur sur la même ligne après le label
                reste = ligne[match.end():].strip()
                
                # Si le champ est une date composée (date + lieu), extraire les deux
                if champ == "date_naissance" and "LIEU" in ligne.upper():
                    match_date = re.search(r"(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})", reste)
                    if match_date:
                        d = _parser_date(match_date.group(1))
                        if d:
                            resultats["date_naissance"] = d
                    match_lieu = re.search(r"(?:à|AT)\s+([A-ZÀ-Ü\s\-]{3,30})", reste, re.IGNORECASE)
                    if match_lieu:
                        lieu = _nettoyer_valeur_securisee(match_lieu.group(1).strip(), "lieu")
                        if lieu:
                            resultats["lieu_naissance"] = lieu
                    if "date_naissance" in resultats:
                        break
                else:
                    # Valeur normale
                    if reste and not _ligne_est_que_labels(reste):
                        contexte = champ if champ in ("nom", "prenoms", "numero", "date", "sexe", "lieu") else champ
                        nettoye = _nettoyer_valeur_securisee(reste, contexte)
                        if nettoye:
                            resultats[champ] = nettoye
                            break
                    
                    # Sinon, chercher sur les lignes suivantes
                    for j in range(i + 1, min(i + 4, len(lignes))):
                        ligne_suiv = lignes[j].strip()
                        if ligne_suiv and not _ligne_est_que_labels(ligne_suiv):
                            contexte = champ if champ in ("nom", "prenoms", "numero", "date", "sexe", "lieu") else champ
                            nettoye = _nettoyer_valeur_securisee(ligne_suiv, contexte)
                            if nettoye:
                                resultats[champ] = nettoye
                                break
                    if champ in resultats:
                        break
            if champ in resultats:
                break
    
    return resultats