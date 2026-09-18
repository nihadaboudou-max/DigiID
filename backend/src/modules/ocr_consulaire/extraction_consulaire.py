# -*- coding: utf-8 -*-
"""Extraction (regex + nettoyage) pour la Carte d'Immatriculation Consulaire.

⚠️ Point de vigilance : le POSTE consulaire (consulat/ambassade) peut être
confondu avec l'ADRESSE du titulaire. On distingue les deux grâce à leurs
libellés respectifs, et on n'attribue « poste » qu'à un libellé explicite.
"""
import re
from typing import Optional, List

from src.modules.ocr_consulaire.schemas import DonneesConsulaireExtraites
from src.noyau.journal import journal

LABELS_A_EXCLURE = {
    "IMMATRICULATION", "CONSULAIRE", "CONSULAT", "AMBASSADE", "NUMERO",
    "NOM", "PRENOM", "PRENOMS", "DATE", "LIEU", "NAISSANCE", "NATIONALITE",
    "PROFESSION", "SITUATION", "MATRIMONIALE", "ADRESSE", "PASSEPORT",
    "CHARGE", "PERSONNES", "DELIVRANCE", "EXPIRATION", "DU", "AU", "LE",
}

SITUATIONS = ["CELIBATAIRE", "MARIE", "MARIEE", "DIVORCE", "DIVORCEE", "VEUF", "VEUVE"]


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


def _extraire_numero_immat(texte: str) -> Optional[str]:
    """Numéro d'immatriculation consulaire (alphanumérique)."""
    for pat in [
        r"N\s*[°O]\s*D['’]?\s*IMMATRICULATION",
        r"IMMATRICULATION\s*CONSULAIRE",
        r"NUMERO\s*D['’]?\s*IMMATRICULATION",
        r"IMMATRICULATION",
    ]:
        m = re.search(rf"{pat}\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]{{3,19}})", texte)
        if m and m.group(1).upper() not in LABELS_A_EXCLURE:
            return m.group(1)
    return None


def _extraire_poste_consulaire(texte: str) -> Optional[str]:
    """Poste consulaire (consulat/ambassade) — distinct de l'adresse."""
    for pat in [r"POSTE\s*CONSULAIRE", r"CONSULAT", r"AMBASSADE"]:
        m = re.search(rf"{pat}\s*[:\-]?\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿ\s\-\.']{{2,80}}?)(?=\n|\s{3,}|$)", texte)
        if m:
            valeur = m.group(1).strip()
            if valeur.upper() not in LABELS_A_EXCLURE:
                # Ré-injecter le mot-clé pour un libellé lisible ("CONSULAT DE ...").
                mot = "CONSULAT" if "CONSULAT" in pat else "AMBASSADE"
                return valeur if mot in valeur.upper() else f"{mot} {valeur}".strip()
    return None


def _extraire_situation(texte: str) -> Optional[str]:
    brut = _extraire_apres(texte, [r"SITUATION\s*MATRIMONIALE", r"SITUATION"], 30) or texte
    for mot in SITUATIONS:
        if mot in brut.upper():
            if mot.startswith("MARI"):
                return "MARIE"
            if mot.startswith("DIVORC"):
                return "DIVORCE"
            if mot.startswith("VEU"):
                return "VEUF"
            return "CELIBATAIRE"
    return None


def _extraire_date_par_contexte(texte: str, contextes: List[str]) -> Optional[str]:
    for contexte in contextes:
        m = re.search(
            rf"{contexte}\s*[:\-]?\s*(\d{{1,2}}[./\-]\d{{1,2}}[./\-]\d{{2,4}})", texte
        )
        if m:
            return m.group(1)
    return None


def extraire_donnees_consulaire(
    texte_brut: str,
    confiance: float = 0.0,
) -> DonneesConsulaireExtraites:
    """Extraction robuste des champs d'une carte d'immatriculation consulaire."""
    if not texte_brut:
        return DonneesConsulaireExtraites(texte_brut="", taux_confiance_moyen=confiance)

    texte = _nettoyer_texte(texte_brut)

    numero_immat = _extraire_numero_immat(texte)
    numero_passeport = _extraire_apres(texte, [r"PASSEPORT", r"N\s*[°O]\s*PASSEPORT"], 20)
    nom_famille = _extraire_apres(texte, [r"NOM", r"NOM\s*/?\s*SURNAME", r"SURNAME"], 40)
    prenoms = _extraire_apres(texte, [r"PRENOM", r"PRENOMS", r"GIVEN\s*NAME"], 50)
    lieu_naissance = _extraire_apres(texte, [r"LIEU\s*DE\s*NAISSANCE", r"NE\s*A", r"LIEU"], 40)
    nationalite = _extraire_apres(texte, [r"NATIONALITE"], 30)
    profession = _extraire_apres(texte, [r"PROFESSION"], 50)
    adresse = _extraire_apres(texte, [r"ADRESSE"], 100)
    poste_consulaire = _extraire_poste_consulaire(texte)
    situation = _extraire_situation(texte)

    personnes = None
    m = re.search(r"(?:PERSONNES?\s*(?:A\s*)?CHARGE|CHARGE(?:S)?)\s*[:\-]?\s*(\d{1,2})", texte)
    if m:
        personnes = int(m.group(1))

    date_naissance = _extraire_date_par_contexte(texte, [r"NE\s*E?\s*LE", r"DATE\s*DE\s*NAISSANCE", r"NAISSANCE"])
    date_delivrance = _extraire_date_par_contexte(texte, [r"DELIVRANCE", r"DELIVRE\s*LE", r"DU"])
    date_expiration = _extraire_date_par_contexte(texte, [r"EXPIRATION", r"VALABLE\s*JUSQU", r"FIN\s*DE\s*VALIDITE"])

    pays_emetteur = next(
        (c for c in ["SEN", "CIV", "MLI", "BEN", "BFA", "TOG", "GHA", "NGA", "GIN", "NER", "CMR"]
         if re.search(rf"\b{c}\b", texte)),
        None,
    )

    champs_ok = sum([bool(numero_immat), bool(nom_famille), bool(prenoms),
                     bool(poste_consulaire), bool(date_expiration)])
    journal.warning(f"Consulaire — extraction terminée : {champs_ok}/5 champs principaux")

    return DonneesConsulaireExtraites(
        numero_immatriculation_consulaire=numero_immat,
        numero_passeport=numero_passeport,
        nom_famille=nom_famille,
        prenoms=prenoms,
        date_naissance=date_naissance,
        lieu_naissance=lieu_naissance,
        nationalite=nationalite,
        profession=profession,
        situation_matrimoniale=situation,
        adresse=adresse,
        poste_consulaire=poste_consulaire,
        pays_emetteur=pays_emetteur,
        personnes_a_charge=personnes,
        date_delivrance=date_delivrance,
        date_expiration=date_expiration,
        texte_brut=texte_brut[:5000],
        taux_confiance_moyen=confiance,
    )
