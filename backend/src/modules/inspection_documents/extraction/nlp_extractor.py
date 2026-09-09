# -*- coding: utf-8 -*-
"""
Extracteur NLP (Regex avancées) pour documents sans MRZ.
Gère : Permis de conduire, Cartes d'assurance, Anciennes CNI, passeports, etc.

Règle anti-hallucination : ne retourne JAMAIS un label (NOM, SURNAME,
PRENOMS, GIVEN NAMES, DATE DE NAISSANCE, ...) comme valeur de champ.
La valeur réelle doit être une donnée (mots inconnus / chiffres).
"""
import re
from typing import Dict, List, Optional

# ---------------------------------------------------------------------------
# Mois (français / anglais) pour parser les dates en toutes lettres
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# Labels de champs (FR/EN) à ignorer en tant que valeurs + mots neutres
# ---------------------------------------------------------------------------
_LABELS = {
    # Identité
    "NOM", "NOMS", "SURNAME", "SURNAMES", "LASTNAME", "LASTNAMES", "FAMILYNAME",
    "PRENOM", "PRENOMS", "GIVENNAME", "GIVENNAMES", "FIRSTNAME", "FIRSTNAMES",
    "GIVEN", "FIRST", "LAST", "NAME", "NAMES", "NE", "NEE", "NÉ", "NÉE",
    "DATE", "NAISSANCE", "BIRTH", "DATEOFBIRTH", "DOB",
    "SEXE", "SEX", "GENDER",
    "LIEU", "LIEUDENAISSANCE", "PLACE", "PLACEOF", "PLACEOFBIRTH",
    "NATIONALITE", "NATIONALITY",
    # Document
    "NUMERO", "NUMBER", "N°", "DOCUMENT", "DOCUMENTNO", "DOCUMENTNUMBER",
    "NO", "N", "NUM", "CARTE", "DIDENTITE", "IDENTITE", "IDENTIFICATION",
    "IDENTITY", "IDENTIFIANT", "MATRICULE", "CODEPAYS", "CODE",
    # Validité
    "EXPIRATION", "EXPIRY", "EXPIREDATE", "EXPIRES", "EXP", "EXPIRE",
    "VALIDITE", "VALIDITY", "VALIDITEJUSQUAU", "VALID", "VALIDE",
    "DELIVRANCE", "DELIVREE", "DELIVRE", "ISSUE", "ISSUEDATE", "DATEOFISSUE",
    "SIGNATURE", "AUTORITE", "AUTHORITY", "EMETTEUR", "ISSUING",
    # Divers / en-têtes
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
}
_NEUTRES = {
    "DE", "DU", "DES", "D", "L", "LE", "LA", "LES", "UN", "UNE",
    "AU", "AUX", "A", "ET", "EN", "N", "NO", "N°", "I", "II", "III", "IV", "V",
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


# ---------------------------------------------------------------------------
# Parsing de date tolérant
# ---------------------------------------------------------------------------
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

    # 1) JJ/MM/AAAA ou JJ-MM-AAAA ou JJ.MM.AAAA (séparateurs mixtes autorisés)
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


# ---------------------------------------------------------------------------
# Nettoyage sécurisé des valeurs
# ---------------------------------------------------------------------------
def _nettoyer_valeur_securisee(valeur: str, contexte: str) -> Optional[str]:
    """Nettoie et VALIDE la valeur pour empêcher les artefacts OCR / labels."""
    if not valeur:
        return None
    valeur = valeur.strip().strip(":;,.-\"'()|/ ")

    if not valeur:
        return None

    if contexte in ("nom", "prenoms"):
        # Rejeter si la valeur est encore un label (ex : SURNAME, GIVEN NAMES)
        if _ligne_est_que_labels(valeur):
            return None
        if re.fullmatch(r"\d+", valeur):
            return None  # Rejeté : pas un nom
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


# ---------------------------------------------------------------------------
# Valeurs à partir des lignes OCR
# ---------------------------------------------------------------------------
def _valeur_depuis_ligne(reste: str) -> Optional[str]:
    """Extrait la valeur dans le reste d'une ligne après un label."""
    if not reste:
        return None
    nettoye = reste.strip().strip(" \t:;,-/|·•*\"'()")
    if not nettoye or _ligne_est_que_labels(nettoye):
        return None
    nettoye = _retirer_mots_labels_prefixe(nettoye).strip(" \t:;,-/|·•*\"'()")
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
            # En-tête / autre champ, pas une donnée
            continue
        return ligne
    return None


# ---------------------------------------------------------------------------
# Extraction spécifique : Permis de conduire
# ---------------------------------------------------------------------------
def extraire_permis_conduire(texte: str) -> Dict:
    """Extraction spécifique pour Permis de Conduire."""
    resultats = {}
    texte_upper = texte.upper()

    # Numéro de permis
    match = re.search(r"(?:N[°O]|NUM[ÉE]RO|PERMIS)\s*(?:N[°O])?\s*[:\-]?\s*([A-Z0-9\-]{6,20})", texte_upper)
    if match:
        numero = _nettoyer_valeur_securisee(match.group(1), "numero")
        if numero:
            resultats["numero_document"] = numero

    # Catégories (A, B, C, D, E)
    match_cat = re.search(r"CATEGORIE(?:S)?\s*[:\-]?\s*([A-E, ]+)", texte, re.IGNORECASE)
    if match_cat:
        resultats["categories_permis"] = [c.strip() for c in match_cat.group(1).split(",") if c.strip()]

    # Dates
    match_date = re.search(
        r"(?:D[ÉE]LIVR[ÉE]|DATE)\s*(?:LE|DE)?\s*[:\-]?\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})",
        texte, re.IGNORECASE,
    )
    if match_date:
        d = _parser_date(match_date.group(1))
        if d:
            resultats["date_delivrance"] = d

    match_exp = re.search(
        r"(?:EXPIRATION|EXPIR[EÉ]|VALABLE\s*(?:JUSQU|AU)|VALIDIT[EÉ]\s*(?:JUSQU)?)\s*[:\-]?\s*"
        r"(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})",
        texte, re.IGNORECASE,
    )
    if match_exp:
        d = _parser_date(match_exp.group(1))
        if d:
            resultats["date_expiration"] = d

    return resultats


# ---------------------------------------------------------------------------
# Extraction spécifique : Carte d'assurance
# ---------------------------------------------------------------------------
def extraire_carte_assurance(texte: str) -> Dict:
    """Extraction spécifique pour Cartes d'Assurance."""
    resultats = {}
    texte_upper = texte.upper()

    # Numéro de police / contrat
    match = re.search(
        r"(?:N[°O]\s*(?:DE\s*)?POLICE|CONTRAT|N[°O]\s*CLIENT)\s*[:\-]?\s*([A-Z0-9\-]{6,20})",
        texte_upper,
    )
    if match:
        numero = _nettoyer_valeur_securisee(match.group(1), "numero")
        if numero:
            resultats["numero_police"] = numero

    # Date d'expiration / validité
    match_exp = re.search(
        r"(?:VALABLE\s*(?:JUSQU|AU)|EXPIRATION|EXPIR[EÉ]|FIN\s*DE\s*VALIDIT[EÉ])\s*[:\-]?\s*"
        r"(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})",
        texte, re.IGNORECASE,
    )
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


# ---------------------------------------------------------------------------
# Extraction générique par labels (tous types de documents)
# ---------------------------------------------------------------------------
def extraire_par_labels(texte: str, patterns: Dict[str, list]) -> Dict:
    """
    Extraction générique basée sur des labels (NOM, PRÉNOM, DATE DE NAISSANCE...).
    - Ne prend JAMAIS un label comme valeur (saut des lignes d'en-têtes).
    - Gère 'Label: valeur' sur la même ligne et 'Label\\nvaleur' sur la ligne suivante.
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

                # 1) Valeur sur la même ligne après le label
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
