# -*- coding: utf-8 -*-
"""Extraction (MRZ TD3 + regex) pour le Passeport.

Le passeport est un document de format TD3 (norme ICAO 9303) : la MRZ
(2 lignes de 44 caractères, la 1re commençant par `P<`) fournit l'identité
de façon fiable. Les regex servent uniquement de repli quand la MRZ est
illisible ou incomplète.
"""
import re
from typing import List, Optional, Tuple

from src.modules.inspection_documents.extraction.mrz_parser import parser_mrz_complet
from src.modules.ocr_passeport.schemas import DonneesPasseportExtraites
from src.noyau.journal import journal

LABELS_A_EXCLURE = {
    "PASSEPORT", "PASSPORT", "REPUBLIQUE", "NATIONALITE", "NOM", "PRENOM",
    "PRENOMS", "SURNAME", "GIVEN", "NAMES", "DATE", "LIEU", "NAISSANCE",
    "SEXE", "AUTORITE", "DELIVRANCE", "EXPIRATION", "DU", "AU", "LE", "TYPE",
    "CODE", "PAYS", "EMETTEUR", "VALABLE", "EMISSION",
}

TYPES_PASSEPORT = ("ORDINAIRE", "DIPLOMATIQUE", "SERVICE", "OFFICIEL", "SPECIAL", "MISSION")


# =============================================================================
# Nettoyage / helpers
# =============================================================================
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
            rf"(?=\n|\s{{3,}}|$)",
            texte,
        )
        if m:
            valeur = m.group(1).strip()
            if valeur and valeur.upper() not in LABELS_A_EXCLURE:
                return valeur
    return None


def _extraire_date_par_contexte(texte: str, contextes: List[str]) -> Optional[str]:
    for contexte in contextes:
        m = re.search(
            rf"{contexte}\s*[:\-]?\s*(\d{{1,2}}[./\-]\d{{1,2}}[./\-]\d{{2,4}})", texte
        )
        if m:
            return m.group(1)
    return None


def _extraire_lignes_mrz_texte(texte_brut: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Repère les lignes MRZ dans le texte brut (repli si l'OCR ne les a pas isolées)."""
    lignes = [l.strip() for l in (texte_brut or "").splitlines() if l.strip()]
    candidats = [l for l in lignes if l.count("<") >= 5 and len(l) >= 30]
    if len(candidats) < 2:
        return None, None, None
    # Une MRZ de passeport commence par "P<" : on la place en tête.
    candidats.sort(key=lambda l: (0 if l.upper().startswith("P<") else 1))
    return candidats[0], candidats[1], None


def _nettoyer_nom(valeur: Optional[str]) -> Optional[str]:
    """Nettoie un nom/prénom : retire symboles, ``<`` résiduels et libellés avalés."""
    if not valeur:
        return None
    valeur = re.sub(r"[^A-Za-zÀ-ÿ'\- ]", " ", valeur)
    valeur = re.sub(r"\s+", " ", valeur).strip()
    # Si un mot-clé voisin a été capturé par erreur (ex: « DIOP PRENOM »), on coupe.
    valeur = re.split(
        r"\b(?:PRENOMS?|SURNAME|GIVEN|NAMES?|DATE|SEXE|NATIONALITE|LIEU|AUTORITE|EMETTEUR)\b",
        valeur,
    )[0].strip()
    return valeur.upper() if valeur else None


def _extraire_sexe(texte: str) -> Optional[str]:
    m = re.search(r"SEXE\s*[:\-]?\s*(M|F|MASCULIN|FEMININ|F[ÉE]MININ)", texte)
    if not m:
        return None
    valeur = m.group(1)
    if valeur.startswith("M"):
        return "M"
    if valeur.startswith("F"):
        return "F"
    return None


def _extraire_type_passeport(texte: str) -> Optional[str]:
    for type_p in TYPES_PASSEPORT:
        if re.search(rf"\bPASSEPORT\s*{type_p}\b", texte) or re.search(rf"\b{type_p}\b", texte):
            return type_p
    return None


# =============================================================================
# Fonction principale
# =============================================================================
def extraire_donnees_passeport(
    texte_brut: str,
    confiance: float = 0.0,
    mrz_lignes: tuple = (None, None, None),
) -> DonneesPasseportExtraites:
    """Extraction robuste des champs d'un passeport (MRZ prioritaire + regex)."""
    if not texte_brut and not any(mrz_lignes or (None,)):
        return DonneesPasseportExtraites(texte_brut="", taux_confiance_moyen=confiance)

    texte = _nettoyer_texte(texte_brut or "")

    # ── 1. MRZ (source prioritaire) ──
    l1, l2, l3 = mrz_lignes or (None, None, None)
    if not (l1 and l2):
        l1, l2, l3 = _extraire_lignes_mrz_texte(texte_brut or "")
    mrz: dict = {}
    if l1 and l2:
        try:
            mrz = parser_mrz_complet(l1, l2, l3) or {}
        except Exception as e:  # pragma: no cover - le parseur ne lève jamais
            journal.warning(f"Passeport : parsing MRZ échoué ({e})")
            mrz = {}
        # Un passeport a TOUJOURS une MRZ TD3 : si l'OCR a livré un autre format,
        # les champs MRZ sont douteux (source de lettres parasites) → repli texte.
        if mrz and mrz.get("format") != "TD3":
            journal.warning(
                f"Passeport : MRZ {mrz.get('format')} inattendue (TD3 attendu) → repli sur le texte"
            )
            mrz = {}

    # ── 2. Fusion MRZ > regex ──
    numero_passeport = mrz.get("numero_document") or _extraire_apres(
        texte, [r"N[°O]\s*(?:DE\s*)?PASSEPORT", r"PASSEPORT\s*N[°O]?", r"NUMERO"], 20
    )
    if numero_passeport:
        # Le nettoyage insère des espaces ("SN 1234567") : on les retire du numéro.
        numero_passeport = re.sub(r"\s+", "", numero_passeport)
    nom_famille = _nettoyer_nom(mrz.get("nom_famille")) or _nettoyer_nom(
        _extraire_apres(texte, [r"(?<![A-ZÀ-Ÿ])NOM\b", r"(?<![A-ZÀ-Ÿ])SURNAME\b"], 40)
    )
    prenoms = _nettoyer_nom(mrz.get("prenoms")) or _nettoyer_nom(
        _extraire_apres(texte, [r"(?<![A-ZÀ-Ÿ])PRENOMS?\b", r"GIVEN\s*NAMES?\b"], 50)
    )
    date_naissance = mrz.get("date_naissance_date") or _extraire_date_par_contexte(
        texte, [r"DATE\s*DE\s*NAISSANCE", r"NE\s*E?\s*LE", r"NAISSANCE"]
    )
    date_expiration = mrz.get("date_expiration_date") or _extraire_date_par_contexte(
        texte, [r"DATE\s*D?[’']?\s*EXPIRATION", r"EXPIR", r"VALABLE\s*JUSQU"]
    )
    date_delivrance = _extraire_date_par_contexte(
        texte, [r"DATE\s*DE\s*DELIVRANCE", r"DELIVRE\s*LE", r"DATE\s*D?[’']?\s*EMISSION", r"EMIS\s*LE"]
    )
    sexe = mrz.get("sexe")
    if not sexe or sexe == "non_detecte":
        sexe = _extraire_sexe(texte) or "non_detecte"
    lieu_naissance = _extraire_apres(texte, [r"LIEU\s*DE\s*NAISSANCE", r"NE\s*A", r"LIEU"], 40)
    nationalite = mrz.get("nationalite_nom") or mrz.get("nationalite") or _extraire_apres(
        texte, [r"NATIONALITE"], 30
    )
    pays_emetteur = mrz.get("pays_emetteur_nom") or mrz.get("pays_emetteur")
    autorite_delivrance = _extraire_apres(
        texte, [r"AUTORITE", r"DELIVRE\s*PAR", r"PAYS\s*EMETTEUR"], 60
    )
    type_passeport = _extraire_type_passeport(texte)

    mrz_valide = bool(mrz.get("mrz_valide"))

    champs_ok = sum([
        bool(numero_passeport), bool(nom_famille), bool(prenoms),
        bool(date_naissance), bool(date_expiration),
    ])
    journal.warning(f"Passeport — extraction terminée : {champs_ok}/5 champs principaux (MRZ={mrz_valide})")

    return DonneesPasseportExtraites(
        numero_passeport=numero_passeport,
        type_passeport=type_passeport,
        nom_famille=nom_famille,
        prenoms=prenoms,
        sexe=sexe,
        date_naissance=date_naissance,
        lieu_naissance=lieu_naissance,
        nationalite=nationalite,
        autorite_delivrance=autorite_delivrance,
        pays_emetteur=pays_emetteur,
        date_delivrance=date_delivrance,
        date_expiration=date_expiration,
        mrz_ligne_1=(l1 or None),
        mrz_ligne_2=(l2 or None),
        mrz_valide=mrz_valide,
        texte_brut=(texte_brut or "")[:5000],
        taux_confiance_moyen=confiance,
    )
