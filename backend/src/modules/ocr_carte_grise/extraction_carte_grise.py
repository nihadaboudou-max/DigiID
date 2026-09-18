# -*- coding: utf-8 -*-
"""Extraction (regex + nettoyage) pour la Carte Grise.

⚠️ Point de vigilance : les champs d'une carte grise sont CODÉS
( D.1 = marque, D.3 = modèle, P.6 = puissance, S.1 = places,
  F.2 = PTAC, B = 1ère mise en circulation, E = formule ).
On mappe donc d'abord les CODES, puis on retombe sur les libellés.
"""
import re
from typing import Optional, List

from src.modules.ocr_carte_grise.schemas import DonneesCarteGriseExtraites
from src.noyau.journal import journal

# Mots qui ne sont JAMAIS des valeurs (intitulés/labels).
LABELS_A_EXCLURE = {
    "IMMATRICULATION", "MARQUE", "MODELE", "MODELE", "GENRE", "CARROSSERIE",
    "ENERGIE", "PUISSANCE", "PLACES", "POIDS", "CHASSIS", "VIN", "MOTEUR",
    "FORMULE", "TITULAIRE", "NOM", "PRENOM", "ADRESSE", "DATE", "PAYS",
    "TYPE", "CERTIFICAT", "VEHICULE", "MISE", "CIRCULATION", "NUMERO",
    "FISCALE", "TOTALE", "CHARGE",
}

# Normalisation des énergies (enum).
ENERGIES = {
    "ESSENCE": "ESSENCE", "DIESEL": "DIESEL", "GAZOLE": "DIESEL",
    "ELECTRIQUE": "ELECTRIQUE", "ELECTRICITE": "ELECTRIQUE",
    "HYBRIDE": "HYBRIDE", "GPL": "GPL",
}

# Le prochain code officiel ressemble à "D.1", "P.6", "F.2", "B ", "E ".
_CODE_SUIVANT = r"(?=\s+[A-Z]\s*\.?\s*\d|\s{3,}|\n|$)"


def _separer_mots_colles(texte: str) -> str:
    """Sépare les mots collés par l'OCR (ex: 'IMMATRICULATIONAB123CD')."""
    if not texte:
        return texte
    texte = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", texte)
    texte = re.sub(r"([A-Z])(\d)", r"\1 \2", texte)
    texte = re.sub(r"(\d)([A-Z])", r"\1 \2", texte)
    return texte


def _nettoyer_texte_carte_grise(texte: str) -> str:
    """Nettoie le texte OCR en préservant la structure (majuscules, espaces)."""
    texte = _separer_mots_colles(texte or "")
    texte = texte.upper()
    texte = re.sub(r"\n\s*\n", " § ", texte)
    texte = re.sub(r"[ \t]+", " ", texte)
    return texte.strip()


def _to_int(valeur: Optional[str]) -> Optional[int]:
    """Extrait un entier d'une chaîne (ex: '7 CV' -> 7)."""
    if not valeur:
        return None
    m = re.search(r"\d{1,6}", valeur)
    return int(m.group(0)) if m else None


def _extraire_apres_code(texte: str, codes: List[str], longueur: int = 80) -> Optional[str]:
    """Extrait la valeur qui suit un code officiel (ex: D.1) ou un libellé."""
    for code in codes:
        motif = rf"{code}\s*[:\-]?\s*([A-Z0-9À-Ÿ][A-Z0-9À-Ÿ\s\-\./']{{0,{longueur}}}?){_CODE_SUIVANT}"
        m = re.search(motif, texte)
        if m:
            valeur = m.group(1).strip()
            if valeur and valeur.upper() not in LABELS_A_EXCLURE:
                return valeur
    return None


def _nettoyer_immatriculation(valeur: Optional[str]) -> Optional[str]:
    """Normalise une immatriculation : SIV 'AB-123-CD' ou ancien '1234 AB 01'."""
    if not valeur:
        return None
    v = re.sub(r"[^A-Z0-9]", "", valeur.upper())
    m = re.match(r"^([A-Z]{2})(\d{3})([A-Z]{2})$", v)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r"^(\d{1,4})([A-Z]{2,3})(\d{2,3})$", v)
    if m:
        return f"{m.group(1)} {m.group(2)} {m.group(3)}"
    return v or None


def _extraire_immatriculation(texte: str) -> Optional[str]:
    """Immatriculation : priorité au libellé, puis détection par motif."""
    brut = _extraire_apres_code(
        texte, [r"IMMATRICULATION", r"PLAQUE", r"N\s*\.?\s*IMMAT"], longueur=25
    )
    if brut:
        valeur = _nettoyer_immatriculation(brut)
        if valeur and re.search(r"\d", valeur) and re.search(r"[A-Z]", valeur):
            return valeur
    # Motif SIV : AB-123-CD
    m = re.search(r"\b([A-Z]{2}[\s\-]?\d{3}[\s\-]?[A-Z]{2})\b", texte)
    if m:
        return _nettoyer_immatriculation(m.group(1))
    # Ancien format : 1234 AB 01
    m = re.search(r"\b(\d{1,4}[\s\-]?[A-Z]{2,3}[\s\-]?\d{2,3})\b", texte)
    if m:
        return _nettoyer_immatriculation(m.group(1))
    return None


def _extraire_vin(texte: str) -> Optional[str]:
    """VIN : 17 caractères alphanumériques SANS I/O/Q."""
    # D'abord après un libellé explicite.
    brut = _extraire_apres_code(texte, [r"V\s*\.?\s*I\s*\.?\s*N", r"CHASSIS", r"NUMERO\s*CHASSIS"], longueur=25)
    candidat = None
    if brut:
        c = re.sub(r"[^A-Z0-9]", "", brut.upper())
        if len(c) == 17:
            candidat = c
    if not candidat:
        for m in re.finditer(r"\b([A-HJ-NPR-Z0-9]{17})\b", texte):
            c = m.group(1)
            # VIN : lettres ET chiffres (exclut un simple numéro ou un mot).
            if re.search(r"[A-HJ-NPR-Z]", c) and re.search(r"\d", c):
                candidat = c
                break
    return candidat


def _extraire_energie(texte: str) -> Optional[str]:
    """Énergie : enum ESSENCE / DIESEL / ELECTRIQUE / HYBRIDE / GPL."""
    zone = _extraire_apres_code(texte, [r"ENERGIE", r"P\s*\.?\s*3"], longueur=20) or texte
    zone = zone.upper()
    for mot, valeur in ENERGIES.items():
        if mot in zone:
            return valeur
    return None


def _extraire_date_par_contexte(texte: str, contextes: List[str]) -> Optional[str]:
    """Extrait une date (JJ.MM.AAAA / JJ/MM/AAAA) qui suit un contexte donné."""
    for contexte in contextes:
        m = re.search(
            rf"{contexte}\s*[:\-]?\s*(\d{{1,2}}[./\-]\d{{1,2}}[./\-]\d{{2,4}})", texte
        )
        if m:
            return m.group(1)
    return None


def extraire_donnees_carte_grise(
    texte_brut: str,
    confiance: float = 0.0,
) -> DonneesCarteGriseExtraites:
    """Extraction robuste des champs d'une carte grise (codes + libellés)."""
    if not texte_brut:
        return DonneesCarteGriseExtraites(texte_brut="", taux_confiance_moyen=confiance)

    texte = _nettoyer_texte_carte_grise(texte_brut)
    journal.info(f"Carte grise — texte nettoyé ({len(texte)} chars)")

    immatriculation = _extraire_immatriculation(texte)
    vin = _extraire_vin(texte)

    # Marque (D.1) et modèle (D.3) : codes prioritaires puis libellés.
    marque = _extraire_apres_code(texte, [r"D\s*\.?\s*1", r"MARQUE"], longueur=40)
    modele = _extraire_apres_code(texte, [r"D\s*\.?\s*3", r"MODELE"], longueur=40)
    marque = marque.upper() if marque else None
    modele = modele.upper() if modele else None

    genre = _extraire_apres_code(texte, [r"D\s*\.?\s*2", r"GENRE"], longueur=20)
    carrosserie = _extraire_apres_code(texte, [r"CARROSSERIE", r"J\s*\.?\s*1"], longueur=20)
    numero_moteur = _extraire_apres_code(texte, [r"NUMERO\s*MOTEUR", r"MOTEUR", r"P\s*\.?\s*5"], longueur=25)

    puissance = _to_int(_extraire_apres_code(texte, [r"P\s*\.?\s*6", r"PUISSANCE"], longueur=15))
    places = _to_int(_extraire_apres_code(texte, [r"S\s*\.?\s*1", r"PLACES"], longueur=10))
    poids = _to_int(_extraire_apres_code(texte, [r"F\s*\.?\s*2", r"POIDS", r"PTAC"], longueur=15))
    energie = _extraire_energie(texte)

    # Date de 1ère mise en circulation (case B) — label prioritaire, sinon 1ère date.
    date_mec = _extraire_date_par_contexte(
        texte, [r"B\s*\.?\s*", r"1RE\s*MISE", r"PREMIERE\s*MISE", r"MISE\s*EN\s*CIRCULATION"]
    )
    if not date_mec:
        trouvees = re.findall(r"\b(\d{1,2}[./\-]\d{1,2}[./\-]\d{4})\b", texte)
        if trouvees:
            date_mec = trouvees[0]

    annee_vehicule = None
    if date_mec:
        m = re.search(r"(\d{4})$", date_mec)
        if m:
            annee_vehicule = int(m.group(1))

    formule = _extraire_apres_code(texte, [r"E\s*\.?\s*", r"FORMULE"], longueur=30)

    # Titulaire (C.1) : "NOM PRENOMS" ; adresse (C.3).
    titulaire = _extraire_apres_code(texte, [r"C\s*\.?\s*1", r"TITULAIRE", r"NOM\s*ET\s*PRENOM"], longueur=60)
    titulaire_nom = None
    titulaire_prenoms = None
    if titulaire:
        titulaire = re.sub(r"[^A-ZÀ-Ÿ\s\-]", "", titulaire).strip()
        mots = titulaire.split()
        if mots:
            titulaire_nom = mots[0]
            titulaire_prenoms = " ".join(mots[1:]) or None

    adresse = _extraire_apres_code(texte, [r"C\s*\.?\s*3", r"ADRESSE"], longueur=120)

    pays = None
    for code in ["SEN", "CIV", "MLI", "BEN", "BFA", "TOG", "GHA", "NGA", "GIN", "NER", "CMR"]:
        if re.search(rf"\b{code}\b", texte):
            pays = code
            break

    date_delivrance = _extraire_date_par_contexte(texte, [r"DATE\s*DE\s*DELIVRANCE", r"DELIVRE\s*LE"])
    date_expiration = _extraire_date_par_contexte(texte, [r"DATE\s*D['’]?EXPIRATION", r"EXPIRE\s*LE"])

    champs_ok = sum([
        bool(immatriculation), bool(vin), bool(marque), bool(modele),
        bool(date_mec), bool(puissance) is not None,
    ])
    journal.warning(f"Carte grise — extraction terminée : {champs_ok}/6 champs principaux")

    return DonneesCarteGriseExtraites(
        numero_immatriculation=immatriculation,
        numero_chassis=vin,
        numero_moteur=numero_moteur,
        marque=marque,
        modele=modele,
        genre=genre,
        carrosserie=carrosserie,
        energie=energie,
        puissance_fiscale_cv=puissance,
        nombre_places=places,
        poids_total_kg=poids,
        date_premiere_mise_circulation=date_mec,
        annee_vehicule=annee_vehicule,
        numero_formule=formule,
        titulaire_nom=titulaire_nom,
        titulaire_prenoms=titulaire_prenoms,
        titulaire_adresse=adresse,
        pays_emetteur=pays,
        date_delivrance=date_delivrance,
        date_expiration=date_expiration,
        texte_brut=texte_brut[:5000],
        taux_confiance_moyen=confiance,
    )
