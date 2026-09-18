# -*- coding: utf-8 -*-
"""Extraction (regex + nettoyage) pour la Carte / Titre de Séjour."""
import re
from typing import Optional, List, Tuple

from src.modules.ocr_carte_sejour.schemas import DonneesCarteSejourExtraites
from src.noyau.journal import journal

LABELS_A_EXCLURE = {
    "SEJOUR", "TITRE", "CARTE", "RECEPISSE", "RESIDENT", "NUMERO", "NOM",
    "PRENOM", "PRENOMS", "DATE", "LIEU", "NAISSANCE", "NATIONALITE",
    "SEXE", "ADRESSE", "AUTORITE", "DELIVRANCE", "EXPIRATION", "VALABLE",
    "CATEGORIE", "DU", "AU",
}

CATEGORIES = ["SALARIE", "ETUDIANT", "CONJOINT", "VISITEUR", "RESIDENT", "REFUGIE", "TRAVAILLEUR"]


def _separer_mots_colles(texte: str) -> str:
    if not texte:
        return texte
    texte = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", texte)
    texte = re.sub(r"([A-Z])(\d)", r"\1 \2", texte)
    texte = re.sub(r"(\d)([A-Z])", r"\1 \2", texte)
    return texte


def _nettoyer_texte(texte: str) -> str:
    texte = _separer_mots_colles(texte or "").upper()
    texte = re.sub(r"[ \t]+", " ", texte)
    return texte.strip()


def _extraire_apres(texte: str, patterns: List[str], longueur: int = 60) -> Optional[str]:
    """Extrait la valeur qui suit un libellé (jusqu'à ponctuation forte)."""
    for pat in patterns:
        m = re.search(
            rf"{pat}\s*[:\-]?\s*([A-Z0-9À-Ÿ][A-Z0-9À-Ÿ\s\-\./']{{0,{longueur}}}?)"
            rf"(?=\n|\s{3,}|$)",
            texte,
        )
        if m:
            valeur = m.group(1).strip()
            if valeur and valeur.upper() not in LABELS_A_EXCLURE:
                return valeur
    return None


def _extraire_type_titre(texte: str) -> str:
    """Déduit le type de titre à partir des mots-clés présents."""
    if "RECEPISSE" in texte or "RÉCÉPISSÉ" in texte:
        return "RECEPISSE"
    if "CARTE DE RESIDENT" in texte or "RESIDENT" in texte:
        return "CARTE_RESIDENT"
    if "TITRE DE SEJOUR" in texte:
        return "TITRE_SEJOUR"
    return "CARTE_SEJOUR"


def _extraire_numero_titre(texte: str) -> Optional[str]:
    """Numéro de titre : alphanumérique 6-15 caractères."""
    for pat in [r"N\s*[°O]\s*(?:DU\s*)?TITRE", r"NUMERO\s*(?:DE\s*)?TITRE", r"N\s*[°O]\s*TITRE", r"TITRE"]:
        m = re.search(rf"{pat}\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-]{{5,14}})", texte)
        if m and m.group(1).upper() not in LABELS_A_EXCLURE:
            return m.group(1)
    # Fallback : premier jeton alphanum 6-15 contenant chiffres ET lettres.
    for m in re.finditer(r"\b([A-Z0-9][A-Z0-9\-]{5,14})\b", texte):
        jeton = m.group(1)
        if re.search(r"\d", jeton) and re.search(r"[A-Z]", jeton):
            return jeton
    return None


def _extraire_date_par_contexte(texte: str, contextes: List[str]) -> Optional[str]:
    for contexte in contextes:
        m = re.search(
            rf"{contexte}\s*[:\-]?\s*(\d{{1,2}}[./\-]\d{{1,2}}[./\-]\d{{2,4}})", texte
        )
        if m:
            return m.group(1)
    return None


def _parser_mrz_legere(mrz_lignes: Tuple) -> dict:
    """Parsing MRZ minimal (pays, nom/prénoms si TD1/TD3)."""
    resultat: dict = {}
    l1, l2, l3 = (list(mrz_lignes) + [None, None, None])[:3]
    if l1 and len(l1) >= 5:
        code_pays = l1[2:5].strip("<")
        if code_pays.isalpha():
            resultat["pays_emetteur"] = code_pays
    # Nom/prénoms : généralement sur la ligne 2 (TD1) ou ligne 1 (TD2/TD3).
    source = l3 or l2 or l1
    if source and "<" in source:
        blocs = [b.replace("<", " ").strip() for b in re.split(r"<<", source)]
        blocs = [b for b in blocs if b and b.isalpha()]
        if blocs:
            resultat["nom_famille"] = blocs[0].split()[0] if blocs[0].split() else None
            if len(blocs) > 1:
                resultat["prenoms"] = blocs[1]
    return {k: v for k, v in resultat.items() if v}


def extraire_donnees_carte_sejour(
    texte_brut: str,
    confiance: float = 0.0,
    mrz_lignes: Tuple = (None, None, None),
) -> DonneesCarteSejourExtraites:
    """Extraction robuste des champs d'une carte / titre de séjour."""
    if not texte_brut and not any(mrz_lignes):
        return DonneesCarteSejourExtraites(texte_brut="", taux_confiance_moyen=confiance)

    texte = _nettoyer_texte(texte_brut)
    mrz = _parser_mrz_legere(mrz_lignes)

    type_titre = _extraire_type_titre(texte)
    numero_titre = _extraire_numero_titre(texte)

    nom_famille = _extraire_apres(texte, [r"NOM", r"NOM\s*/?\s*SURNAME", r"SURNAME"], 40)
    prenoms = _extraire_apres(texte, [r"PRENOM", r"PRENOMS", r"GIVEN\s*NAME"], 50)
    lieu_naissance = _extraire_apres(texte, [r"LIEU\s*DE\s*NAISSANCE", r"NE\s*A", r"LIEU"], 40)
    nationalite = _extraire_apres(texte, [r"NATIONALITE"], 30)
    adresse = _extraire_apres(texte, [r"ADRESSE"], 100)
    autorite = _extraire_apres(texte, [r"AUTORITE", r"PREFECTURE", r"DELIVRE\s*PAR"], 60)

    date_naissance = _extraire_date_par_contexte(texte, [r"NE\s*E?\s*LE", r"DATE\s*DE\s*NAISSANCE", r"NAISSANCE"])
    date_delivrance = _extraire_date_par_contexte(texte, [r"DELIVRANCE", r"DELIVRE\s*LE", r"DU"])
    date_expiration = _extraire_date_par_contexte(texte, [r"EXPIRATION", r"VALABLE\s*JUSQU", r"FIN\s*DE\s*VALIDITE"])

    sexe = None
    m = re.search(r"SEXE\s*[:\-]?\s*([MF])", texte)
    if m:
        sexe = m.group(1)
    if not sexe and mrz.get("sexe") in ("M", "F"):
        sexe = mrz["sexe"]

    categorie = next((c for c in CATEGORIES if c in texte), None)

    # La MRZ (source de vérité) complète/écrase les valeurs OCR faibles.
    nom_famille = mrz.get("nom_famille") or nom_famille
    prenoms = mrz.get("prenoms") or prenoms
    pays_emetteur = mrz.get("pays_emetteur") or next(
        (c for c in ["SEN", "CIV", "MLI", "BEN", "BFA", "TOG", "GHA", "NGA", "GIN", "NER", "CMR"]
         if re.search(rf"\b{c}\b", texte)),
        None,
    )

    champs_ok = sum([bool(numero_titre), bool(nom_famille), bool(prenoms),
                     bool(date_expiration), bool(nationalite)])
    journal.warning(f"Carte séjour — extraction terminée : {champs_ok}/5 champs principaux")

    return DonneesCarteSejourExtraites(
        type_titre=type_titre,
        numero_titre=numero_titre,
        categorie=categorie,
        nom_famille=nom_famille,
        prenoms=prenoms,
        sexe=sexe,
        date_naissance=date_naissance,
        lieu_naissance=lieu_naissance,
        nationalite=nationalite,
        adresse=adresse,
        autorite_delivrance=autorite,
        pays_emetteur=pays_emetteur,
        date_delivrance=date_delivrance,
        date_expiration=date_expiration,
        mrz_ligne_1=mrz_lignes[0] if mrz_lignes else None,
        mrz_ligne_2=mrz_lignes[1] if len(mrz_lignes or []) > 1 else None,
        mrz_ligne_3=mrz_lignes[2] if len(mrz_lignes or []) > 2 else None,
        texte_brut=texte_brut[:5000],
        taux_confiance_moyen=confiance,
    )
